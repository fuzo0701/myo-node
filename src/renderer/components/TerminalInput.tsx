import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
  type RefObject,
} from 'react'
import { paletteCommands, slashCommands, CommandSuggestion } from '../data/commands'

export interface TerminalInputHandle {
  focus: () => void
  blur: () => void
  clear: () => void
}

interface TerminalInputProps {
  onSubmit: (command: string) => void
  onSignal: (signal: string) => void
  commandHistory?: string[]
  claudeActiveRef?: RefObject<boolean>
}

const MAX_SUGGESTIONS = 6

const TerminalInput = forwardRef<TerminalInputHandle, TerminalInputProps>(
  function TerminalInput({ onSubmit, onSignal, commandHistory = [], claudeActiveRef }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [value, setValue] = useState('')
    const [historyIndex, setHistoryIndex] = useState(-1)
    const historyRef = useRef<string[]>([])
    const isComposingRef = useRef(false)

    // Autocomplete state
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)

    // Keep refs for keyboard handler to avoid dependency churn
    const showSuggestionsRef = useRef(false)
    const suggestionsRef = useRef<CommandSuggestion[]>([])
    const selectedIdxRef = useRef(0)
    const valueRef = useRef('')
    const historyIndexRef = useRef(-1)

    // claudeActiveRef is passed directly from parent to avoid stale prop issues

    useEffect(() => { showSuggestionsRef.current = showSuggestions }, [showSuggestions])
    useEffect(() => { selectedIdxRef.current = selectedSuggestionIndex }, [selectedSuggestionIndex])
    useEffect(() => { valueRef.current = value }, [value])
    useEffect(() => { historyIndexRef.current = historyIndex }, [historyIndex])

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      blur: () => textareaRef.current?.blur(),
      clear: () => setValue(''),
    }))

    // Auto-resize textarea
    const adjustHeight = useCallback(() => {
      const el = textareaRef.current
      if (!el) return
      el.style.height = 'auto'
      const newHeight = Math.min(Math.max(el.scrollHeight, 38), 200)
      el.style.height = `${newHeight}px`
    }, [])

    useEffect(() => {
      adjustHeight()
    }, [value, adjustHeight])

    // Build history suggestions from commandHistory prop
    const historySuggestions = useMemo<CommandSuggestion[]>(() => {
      return commandHistory.map((cmd, i) => ({
        id: `h-${i}`,
        label: cmd,
        command: cmd,
        source: 'history' as const,
      }))
    }, [commandHistory])

    // Compute suggestions based on current input (pure computation, no side effects)
    const suggestions = useMemo<CommandSuggestion[]>(() => {
      const input = value.trim()
      if (!input) return []

      const lower = input.toLowerCase()
      let candidates: CommandSuggestion[]

      if (input.startsWith('/')) {
        candidates = slashCommands
      } else {
        candidates = [...historySuggestions, ...paletteCommands]
      }

      type Scored = { item: CommandSuggestion; score: number }
      const scored: Scored[] = []

      for (const item of candidates) {
        const cmdLower = item.command.toLowerCase()
        const labelLower = item.label.toLowerCase()

        let score = 0
        if (cmdLower.startsWith(lower) || labelLower.startsWith(lower)) {
          score = 2
        } else if (cmdLower.includes(lower) || labelLower.includes(lower)) {
          score = 1
        }

        if (score > 0) {
          if (item.source === 'history') score += 3
          scored.push({ item, score })
        }
      }

      scored.sort((a, b) => b.score - a.score)

      const seen = new Set<string>()
      const result: CommandSuggestion[] = []
      for (const { item } of scored) {
        if (!seen.has(item.command) && result.length < MAX_SUGGESTIONS) {
          seen.add(item.command)
          result.push(item)
        }
      }

      return result
    }, [value, historySuggestions])

    // Sync suggestions ref
    useEffect(() => { suggestionsRef.current = suggestions }, [suggestions])

    // Show/hide suggestions based on computed results
    useEffect(() => {
      if (suggestions.length > 0 && value.trim()) {
        setShowSuggestions(true)
        setSelectedSuggestionIndex(0)
      } else {
        setShowSuggestions(false)
      }
    }, [suggestions, value])

    const acceptSuggestion = useCallback((command: string) => {
      setValue(command)
      setShowSuggestions(false)
      textareaRef.current?.focus()
    }, [])

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value)
        setHistoryIndex(-1)
      },
      []
    )

    // Use refs in keyboard handler so it doesn't need to be recreated on every state change
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isComposingRef.current) return

        // Ctrl+C: send SIGINT (copy is handled by blurring textarea when selecting in output area)
        if (e.ctrlKey && e.key === 'c') {
          e.preventDefault()
          onSignal('\x03')
          return
        }
        // Ctrl+D
        if (e.ctrlKey && e.key === 'd') {
          e.preventDefault()
          onSignal('\x04')
          return
        }
        // Ctrl+Z
        if (e.ctrlKey && e.key === 'z') {
          e.preventDefault()
          onSignal('\x1a')
          return
        }

        // Escape: send to PTY (stop Claude Code), also close suggestions
        if (e.key === 'Escape') {
          e.preventDefault()
          setShowSuggestions(false)
          onSignal('\x1b') // Send ESC to PTY
          return
        }

        const isSuggestionsOpen = showSuggestionsRef.current
        const currentSuggestions = suggestionsRef.current

        // === Autocomplete keyboard interactions ===
        if (isSuggestionsOpen && currentSuggestions.length > 0) {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setSelectedSuggestionIndex((prev) =>
              prev <= 0 ? currentSuggestions.length - 1 : prev - 1
            )
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setSelectedSuggestionIndex((prev) =>
              prev >= currentSuggestions.length - 1 ? 0 : prev + 1
            )
            return
          }
          if (e.key === 'Tab') {
            e.preventDefault()
            const idx = selectedIdxRef.current
            if (currentSuggestions[idx]) {
              acceptSuggestion(currentSuggestions[idx].command)
            }
            return
          }
        }

        // Enter without Shift → submit (always, regardless of dropdown)
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          setShowSuggestions(false)
          const cmd = valueRef.current
          if (cmd.trim()) {
            historyRef.current.push(cmd)
          }
          onSubmit(cmd)
          setValue('')
          setHistoryIndex(-1)
          return
        }

        // When Claude is active, forward arrow keys to PTY as escape sequences
        if (claudeActiveRef?.current) {
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            onSignal('\x1b[A')
            return
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            onSignal('\x1b[B')
            return
          }
          if (e.key === 'ArrowRight') {
            e.preventDefault()
            onSignal('\x1b[C')
            return
          }
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            onSignal('\x1b[D')
            return
          }
        }

        // Arrow Up: history prev (only if cursor is at first line and dropdown is closed)
        if (e.key === 'ArrowUp' && !isSuggestionsOpen) {
          const el = textareaRef.current
          if (el) {
            const cursorPos = el.selectionStart
            const textBefore = valueRef.current.slice(0, cursorPos)
            if (!textBefore.includes('\n')) {
              e.preventDefault()
              const history = historyRef.current
              if (history.length === 0) return
              const hIdx = historyIndexRef.current
              const newIndex =
                hIdx === -1
                  ? history.length - 1
                  : Math.max(0, hIdx - 1)
              setHistoryIndex(newIndex)
              setValue(history[newIndex])
            }
          }
          return
        }

        // Arrow Down: history next (only if cursor is at last line and dropdown is closed)
        if (e.key === 'ArrowDown' && !isSuggestionsOpen) {
          const el = textareaRef.current
          if (el) {
            const cursorPos = el.selectionStart
            const textAfter = valueRef.current.slice(cursorPos)
            if (!textAfter.includes('\n')) {
              e.preventDefault()
              const history = historyRef.current
              const hIdx = historyIndexRef.current
              if (hIdx === -1) return
              const newIndex = hIdx + 1
              if (newIndex >= history.length) {
                setHistoryIndex(-1)
                setValue('')
              } else {
                setHistoryIndex(newIndex)
                setValue(history[newIndex])
              }
            }
          }
          return
        }
      },
      [onSubmit, onSignal, acceptSuggestion]
    )

    // Source icon helper
    const sourceIcon = (source: CommandSuggestion['source']) => {
      switch (source) {
        case 'history': return '⟳'
        case 'slash': return '⌘'
        case 'palette': return '>'
      }
    }

    // Line count for multiline indicator
    const lineCount = value.split('\n').length
    const isMultiline = lineCount > 1

    return (
      <div className="terminal-input-bar">
        {/* Autocomplete dropdown (rendered above input) */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="autocomplete-dropdown">
            {suggestions.map((s, i) => (
              <div
                key={s.id}
                className={`autocomplete-item ${i === selectedSuggestionIndex ? 'selected' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault()
                  acceptSuggestion(s.command)
                }}
                onMouseEnter={() => setSelectedSuggestionIndex(i)}
              >
                <span className="autocomplete-icon">{sourceIcon(s.source)}</span>
                <span className="autocomplete-label">{s.source === 'history' ? s.command : s.label}</span>
                {s.source !== 'history' && s.label !== s.command && (
                  <span className="autocomplete-command">{s.command}</span>
                )}
              </div>
            ))}
          </div>
        )}
        <span className="terminal-input-prompt">&gt;</span>
        <div className="terminal-input-wrapper">
          <textarea
            ref={textareaRef}
            className="terminal-input"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => {
              isComposingRef.current = true
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false
            }}
            onBlur={() => {
              setTimeout(() => setShowSuggestions(false), 150)
            }}
            placeholder="Type a command..."
            rows={1}
            spellCheck={false}
            autoComplete="off"
          />
          <div className="terminal-input-hints">
            {isMultiline && (
              <span className="terminal-input-line-count">{lineCount} lines</span>
            )}
            <span className="terminal-input-hint">
              {isMultiline ? 'Enter: submit' : 'Shift+Enter: new line'}
            </span>
          </div>
        </div>
      </div>
    )
  }
)

export default TerminalInput
