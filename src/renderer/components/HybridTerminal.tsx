import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import ClaudeRenderer from './ClaudeRenderer'
import { useThemeStore } from '../store/theme'
import { useHistoryStore } from '../store/history'
import { useSettingsStore } from '../store/settings'
import { useTabStore } from '../store/tabs'

declare global {
  interface Window {
    terminal: {
      create: (cols: number, rows: number, cwd?: string) => Promise<number>
      write: (id: number, data: string) => void
      resize: (id: number, cols: number, rows: number) => void
      kill: (id: number) => void
      getCwd: (id: number) => Promise<string | null>
      onData: (callback: (id: number, data: string) => void) => () => void
      onExit: (callback: (id: number, exitCode: number) => void) => () => void
    }
  }
}

interface HybridTerminalProps {
  tabId: string | null | undefined
  isActive?: boolean
}

interface ClaudeBlock {
  id: string
  content: string
  isStreaming: boolean
}

// Throttle interval for streaming updates (ms)
const STREAMING_THROTTLE_MS = 16 // ~60fps

export default function HybridTerminal({ tabId, isActive = true }: HybridTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<number | null>(null)
  const [ptyId, setPtyId] = useState<number | null>(null)
  const theme = useThemeStore((state) => state.currentTheme)
  const renderMode = useSettingsStore((state) => state.renderMode)
  const { createConversation, addMessage } = useHistoryStore()
  const { tabs, setTerminalId, updateTabCwd } = useTabStore()

  // Get current tab's cwd
  const currentTab = tabs.find(t => t.id === tabId)
  const tabCwd = currentTab?.cwd || '~'

  // Claude detection state - use refs to avoid closure issues
  const [isClaudeActive, setIsClaudeActive] = useState(false)
  const isClaudeActiveRef = useRef(false)
  const [claudeBlocks, setClaudeBlocks] = useState<ClaudeBlock[]>([])
  const currentBlockRef = useRef<string>('')
  const conversationIdRef = useRef<string | null>(null)

  // Streaming optimization refs
  const pendingUpdateRef = useRef<string | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const lastUpdateTimeRef = useRef<number>(0)

  // Debounce timer for detecting end of Claude response
  const claudeEndTimerRef = useRef<NodeJS.Timeout | null>(null)
  const CLAUDE_END_DEBOUNCE_MS = 1000 // Wait 1 second of silence to consider response ended

  // Patterns to detect Claude Code - memoized
  // More specific patterns to detect Claude Code CLI output
  const claudePatterns = useMemo(() => [
    /Claude Code/i,           // Full "Claude Code" text
    /claude\.ai/i,            // Claude AI reference
    /╭─/,                     // Claude box drawing start
    /╰─/,                     // Claude box drawing end
    /│\s/,                    // Claude box content line
    /⏺\s*(?:Read|Write|Edit|Bash|Glob|Grep|Search|Task)/i,  // Tool indicators
    /●\s*(?:Read|Write|Edit|Bash|Glob|Grep|Search|Task)/i,  // Alternative tool indicators
    /\[Reading\]/i,           // Claude's reading indicator
    /\[Writing\]/i,           // Claude's writing indicator
    /\[Searching\]/i,         // Claude's searching indicator
    /Tool Result/i,
    /Anthropic/i,             // Company name
    /thinking\.\.\./i,        // Thinking indicator
    /Co-Authored-By:.*Claude/i, // Git commit pattern
  ], [])

  // For tracking directory changes from prompt
  const lastDetectedCwd = useRef<string>('')

  // Track isActive state in ref for use in callbacks
  const isActiveRef = useRef(isActive)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  // Store functions in refs to avoid closure issues
  const createConversationRef = useRef(createConversation)
  const addMessageRef = useRef(addMessage)
  const tabCwdRef = useRef(tabCwd)
  useEffect(() => {
    createConversationRef.current = createConversation
    addMessageRef.current = addMessage
    tabCwdRef.current = tabCwd
  }, [createConversation, addMessage, tabCwd])

  // Buffer for user input (save to history only on Enter)
  const userInputBuffer = useRef<string>('')

  // Strip ANSI escape codes from text
  const stripAnsi = useCallback((text: string): string => {
    // Remove all ANSI escape sequences
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
  }, [])


  const detectClaudeOutput = useCallback((data: string) => {
    return claudePatterns.some((pattern) => pattern.test(data))
  }, [claudePatterns])

  // Throttled update function for streaming content
  const scheduleBlockUpdate = useCallback((content: string, isStreaming: boolean) => {
    pendingUpdateRef.current = content

    const now = performance.now()
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current

    // If enough time has passed, update immediately
    if (timeSinceLastUpdate >= STREAMING_THROTTLE_MS) {
      lastUpdateTimeRef.current = now
      setClaudeBlocks((prev) => {
        const lastBlock = prev[prev.length - 1]
        if (lastBlock?.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...lastBlock, content, isStreaming },
          ]
        } else {
          return [
            ...prev,
            { id: Date.now().toString(), content, isStreaming },
          ]
        }
      })
      pendingUpdateRef.current = null
      return
    }

    // Otherwise, schedule update with RAF
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null
        lastUpdateTimeRef.current = performance.now()

        if (pendingUpdateRef.current !== null) {
          const pendingContent = pendingUpdateRef.current
          setClaudeBlocks((prev) => {
            const lastBlock = prev[prev.length - 1]
            if (lastBlock?.isStreaming) {
              return [
                ...prev.slice(0, -1),
                { ...lastBlock, content: pendingContent, isStreaming },
              ]
            } else {
              return [
                ...prev,
                { id: Date.now().toString(), content: pendingContent, isStreaming },
              ]
            }
          })
          pendingUpdateRef.current = null
        }
      })
    }
  }, [])

  // Finalize streaming block
  const finalizeBlock = useCallback(() => {
    // Cancel any pending RAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }

    // Apply any pending update immediately
    if (pendingUpdateRef.current !== null) {
      const finalContent = pendingUpdateRef.current
      setClaudeBlocks((prev) => {
        const lastBlock = prev[prev.length - 1]
        if (lastBlock?.isStreaming) {
          return [...prev.slice(0, -1), { ...lastBlock, content: finalContent, isStreaming: false }]
        }
        return prev
      })
      pendingUpdateRef.current = null
    } else {
      setClaudeBlocks((prev) => {
        const lastBlock = prev[prev.length - 1]
        if (lastBlock?.isStreaming) {
          return [...prev.slice(0, -1), { ...lastBlock, isStreaming: false }]
        }
        return prev
      })
    }

    currentBlockRef.current = ''
  }, [])

  // Extract Windows path from terminal output (PowerShell/CMD prompt)
  const extractPathFromPrompt = useCallback((data: string): string | null => {
    // Remove ANSI escape codes
    const cleanData = data.replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')

    // Match PowerShell prompt: "PS C:\path>" or CMD prompt: "C:\path>"
    // Use greedy match to get the full path before >
    const match = cleanData.match(/(?:PS\s+)?([A-Za-z]:\\[^<>"|?\r\n]*)>/)
    if (match && match[1]) {
      // Clean up the path - remove trailing spaces
      let path = match[1].trim()
      // Remove trailing backslash for consistency (except for root like D:\)
      if (path.length > 3 && path.endsWith('\\')) {
        path = path.slice(0, -1)
      }
      // Validate it looks like a real path (at least drive letter and colon)
      if (/^[A-Za-z]:\\/.test(path)) {
        return path
      }
    }
    return null
  }, [])

  const handleTerminalData = useCallback((data: string) => {
    // Always write to xterm - terminal output should always be visible
    terminalRef.current?.write(data)

    // Try to detect directory changes from prompt (only for active tab)
    if (tabId && isActiveRef.current) {
      const detectedPath = extractPathFromPrompt(data)
      if (detectedPath && detectedPath !== lastDetectedCwd.current) {
        lastDetectedCwd.current = detectedPath
        updateTabCwd(tabId, detectedPath)
      }
    }

    // Detect Claude output (for history and visual rendering)
    const isClaudeData = detectClaudeOutput(data)

    if (isClaudeData && !isClaudeActiveRef.current) {
      isClaudeActiveRef.current = true
      setIsClaudeActive(true)
      console.log('[History] Claude detected')

      // Create conversation if not exists
      if (!conversationIdRef.current) {
        const newId = createConversationRef.current(tabCwdRef.current)
        conversationIdRef.current = newId
        console.log('[History] Auto-created conversation:', newId)
      }
    }

    // Visual rendering for Claude output (hybrid/rendered mode only)
    if ((renderMode === 'hybrid' || renderMode === 'rendered') && isClaudeActiveRef.current) {
      currentBlockRef.current += data
      scheduleBlockUpdate(stripAnsi(currentBlockRef.current), true)

      // Reset debounce timer
      if (claudeEndTimerRef.current) {
        clearTimeout(claudeEndTimerRef.current)
      }

      claudeEndTimerRef.current = setTimeout(() => {
        finalizeBlock()
        isClaudeActiveRef.current = false
        setIsClaudeActive(false)
        claudeEndTimerRef.current = null
      }, CLAUDE_END_DEBOUNCE_MS)
    }
  }, [tabId, tabCwd, extractPathFromPrompt, updateTabCwd, renderMode, detectClaudeOutput, scheduleBlockUpdate, finalizeBlock, stripAnsi])

  // User input handler - uses refs to always have current values
  const handleUserInput = useCallback((data: string) => {
    if (ptyIdRef.current !== null) {
      window.terminal.write(ptyIdRef.current, data)

      // Buffer user input, save to history only on Enter
      if (data === '\r' || data === '\n') {
        // Enter pressed
        const input = userInputBuffer.current.trim()

        if (input) {
          // Detect if user is starting a Claude session
          const isClaudeCommand = input.match(/^claude\b/i)

          if (isClaudeCommand) {
            // Create new conversation for this Claude session
            const newId = createConversationRef.current(tabCwdRef.current)
            conversationIdRef.current = newId
            addMessageRef.current(conversationIdRef.current, 'user', input)
            console.log('[History] Started Claude session:', conversationIdRef.current)
          } else if (conversationIdRef.current) {
            // Save follow-up input to existing conversation
            addMessageRef.current(conversationIdRef.current, 'user', input)
            console.log('[History] Saved input:', input)
          } else if (isClaudeActiveRef.current) {
            // Claude is active but no conversation yet - create one
            const newId = createConversationRef.current(tabCwdRef.current)
            conversationIdRef.current = newId
            addMessageRef.current(conversationIdRef.current, 'user', input)
            console.log('[History] Created conversation from Claude session:', input)
          }
        }

        userInputBuffer.current = ''
      } else if (data === '\x7f' || data === '\b') {
        // Backspace - remove last character from buffer
        userInputBuffer.current = userInputBuffer.current.slice(0, -1)
      } else if (!data.match(/^\x1b/)) {
        // Regular input (not escape sequence) - add to buffer
        userInputBuffer.current += data
      }
    }
  }, []) // No dependencies - uses refs

  // Cleanup RAF and timers on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      if (claudeEndTimerRef.current !== null) {
        clearTimeout(claudeEndTimerRef.current)
      }
    }
  }, [])

  // Track if terminal is initialized
  const isInitializedRef = useRef(false)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  // Initialize terminal once when component mounts
  useEffect(() => {
    if (!terminalContainerRef.current || !tabId) return
    if (isInitializedRef.current) return

    isInitializedRef.current = true

    const terminal = new Terminal({
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      theme: {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        selectionBackground: theme.selection,
      },
      cursorBlink: true,
      cursorStyle: 'block',
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      // Open external URL with Ctrl+click
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        window.shell?.openExternal(uri)
      }
    })

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)

    // Delay opening to ensure DOM is ready
    const timerId = setTimeout(() => {
      if (!terminalContainerRef.current) return

      try {
        terminal.open(terminalContainerRef.current)
        fitAddon.fit()
      } catch (e) {
        console.error('Failed to open terminal:', e)
        return
      }

      terminalRef.current = terminal
      fitAddonRef.current = fitAddon

      // Handle user input
      terminal.onData(handleUserInput)

      // Create PTY with tab's cwd
      const initPty = async () => {
        const { cols, rows } = terminal
        const id = await window.terminal.create(cols, rows, tabCwd)
        ptyIdRef.current = id
        setPtyId(id)

        // Store terminal ID in tab
        if (tabId) {
          setTerminalId(tabId, id)
        }

        // Focus terminal after initialization
        terminal.focus()
      }

      initPty()

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit()
          if (ptyIdRef.current !== null) {
            const { cols, rows } = terminal
            window.terminal.resize(ptyIdRef.current, cols, rows)
          }
        } catch (e) {
          // Ignore resize errors
        }
      })
      resizeObserver.observe(terminalContainerRef.current!)
      resizeObserverRef.current = resizeObserver
    }, 0)

    return () => {
      clearTimeout(timerId)
      resizeObserverRef.current?.disconnect()
      terminal.dispose()
      if (ptyIdRef.current !== null) {
        window.terminal.kill(ptyIdRef.current)
        ptyIdRef.current = null
      }
      isInitializedRef.current = false
    }
  }, [tabId]) // Only re-run when tabId changes (component remount)

  // Handle PTY data
  useEffect(() => {
    if (ptyId === null) return

    const unsubData = window.terminal.onData((id, data) => {
      if (id === ptyId) {
        handleTerminalData(data)
      }
    })

    const unsubExit = window.terminal.onExit((id, exitCode) => {
      if (id === ptyId) {
        setIsClaudeActive(false)
        terminalRef.current?.write(`\r\n[Process exited with code ${exitCode}]\r\n`)
      }
    })

    return () => {
      unsubData()
      unsubExit()
    }
  }, [ptyId, handleTerminalData])

  // Update theme
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        selectionBackground: theme.selection,
      }
      terminalRef.current.options.fontFamily = theme.fontFamily
      terminalRef.current.options.fontSize = theme.fontSize
    }
  }, [theme])

  // Focus terminal when tab becomes active and refit
  useEffect(() => {
    if (terminalRef.current && tabId && isActive) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        // Refit in case window was resized while hidden
        fitAddonRef.current?.fit()
        terminalRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [tabId, isActive])

  // Listen for focus-terminal event (e.g., when closing command palette)
  useEffect(() => {
    const handleFocusTerminal = () => {
      if (isActive) {
        terminalRef.current?.focus()
      }
    }
    window.addEventListener('focus-terminal', handleFocusTerminal)
    return () => window.removeEventListener('focus-terminal', handleFocusTerminal)
  }, [isActive])

  // Memoize claude blocks rendering
  const claudeBlocksContent = useMemo(() => {
    if (renderMode !== 'hybrid' || claudeBlocks.length === 0) {
      return null
    }

    return (
      <div className="claude-output-area">
        {claudeBlocks.map((block) => (
          <div key={block.id} className="claude-block">
            <ClaudeRenderer content={block.content} isStreaming={block.isStreaming} />
          </div>
        ))}
      </div>
    )
  }, [renderMode, claudeBlocks])

  if (!tabId) {
    return <div className="terminal-pane empty">No terminal selected</div>
  }

  return (
    <div ref={containerRef} className={`hybrid-terminal ${isActive ? '' : 'hidden'}`}>
      {/* Claude rendered output */}
      {claudeBlocksContent}

      {/* Terminal (always present, may be hidden in pure render mode) */}
      <div
        ref={terminalContainerRef}
        className={`terminal-area ${renderMode === 'rendered' && isClaudeActive ? 'hidden' : ''}`}
        onClick={() => terminalRef.current?.focus()}
      />
    </div>
  )
}
