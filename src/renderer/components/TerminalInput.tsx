import {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react'

export interface TerminalInputHandle {
  focus: () => void
  clear: () => void
}

interface TerminalInputProps {
  onSubmit: (command: string) => void
  onSignal: (signal: string) => void
}

const TerminalInput = forwardRef<TerminalInputHandle, TerminalInputProps>(
  function TerminalInput({ onSubmit, onSignal }, ref) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const [value, setValue] = useState('')
    const [historyIndex, setHistoryIndex] = useState(-1)
    const historyRef = useRef<string[]>([])
    const isComposingRef = useRef(false)

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
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

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setValue(e.target.value)
      },
      []
    )

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isComposingRef.current) return

        // Ctrl+C
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

        // Enter without Shift → submit
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const cmd = value
          if (cmd.trim()) {
            historyRef.current.push(cmd)
          }
          onSubmit(cmd)
          setValue('')
          setHistoryIndex(-1)
          return
        }

        // Arrow Up: history prev (only if cursor is at first line)
        if (e.key === 'ArrowUp') {
          const el = textareaRef.current
          if (el) {
            const cursorPos = el.selectionStart
            const textBefore = value.slice(0, cursorPos)
            if (!textBefore.includes('\n')) {
              e.preventDefault()
              const history = historyRef.current
              if (history.length === 0) return
              const newIndex =
                historyIndex === -1
                  ? history.length - 1
                  : Math.max(0, historyIndex - 1)
              setHistoryIndex(newIndex)
              setValue(history[newIndex])
            }
          }
          return
        }

        // Arrow Down: history next (only if cursor is at last line)
        if (e.key === 'ArrowDown') {
          const el = textareaRef.current
          if (el) {
            const cursorPos = el.selectionStart
            const textAfter = value.slice(cursorPos)
            if (!textAfter.includes('\n')) {
              e.preventDefault()
              const history = historyRef.current
              if (historyIndex === -1) return
              const newIndex = historyIndex + 1
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
      [value, historyIndex, onSubmit, onSignal]
    )

    return (
      <div className="terminal-input-bar">
        <span className="terminal-input-prompt">&gt;</span>
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
          placeholder="Type a command..."
          rows={1}
          spellCheck={false}
          autoComplete="off"
        />
      </div>
    )
  }
)

export default TerminalInput
