import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { SearchAddon } from '@xterm/addon-search'
import '@xterm/xterm/css/xterm.css'
import ClaudeRenderer from './ClaudeRenderer'
import OutputArea, { OutputBlock } from './OutputArea'
import TerminalInput, { TerminalInputHandle } from './TerminalInput'
import ClaudeInfoBar from './ClaudeInfoBar'
import SearchBar from './SearchBar'
import TmuxLayout from './TmuxLayout'
import { highlightMatches, clearHighlights, activateMatch } from '../utils/domSearch'
import { useThemeStore } from '../store/theme'
import { useHistoryStore } from '../store/history'
import { useSettingsStore } from '../store/settings'
import { useTabStore } from '../store/tabs'
import { useClaudeInfoStore } from '../store/claudeInfo'
import { useNotificationStore } from '../store/notifications'
import { useAgentTeamsStore } from '../store/agentTeams'
import { parseClaudeInfo } from '../utils/claudeInfoParser'

type ShellType = 'default' | 'powershell' | 'cmd' | 'bash' | 'zsh'

declare global {
  interface Window {
    terminal: {
      create: (cols: number, rows: number, cwd?: string, shell?: ShellType) => Promise<number>
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

let outputBlockIdCounter = 0
function nextBlockId(): string {
  return `blk-${Date.now()}-${++outputBlockIdCounter}`
}

// Module-level cache: persists outputBlocks across component remounts
// This ensures tab content survives if React unmounts/remounts a HybridTerminal
const outputBlocksCache = new Map<string, OutputBlock[]>()
// Also cache the current output accumulation buffer per tab
const currentOutputCache = new Map<string, string>()

export default function HybridTerminal({ tabId, isActive = true }: HybridTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const ptyIdRef = useRef<number | null>(null)
  const [ptyId, setPtyId] = useState<number | null>(null)
  const theme = useThemeStore((state) => state.currentTheme)
  const renderMode = useSettingsStore((state) => state.renderMode)
  const shell = useSettingsStore((state) => state.shell)
  const autoScroll = useSettingsStore((state) => state.autoScroll)
  const { createConversation, addMessage } = useHistoryStore()
  const { tabs, setTerminalId, updateTabCwd, updateTabTitle, setClaudeStatus } = useTabStore()
  const updateClaudeSession = useClaudeInfoStore((s) => s.updateSession)

  // Get current tab's cwd and team info
  const currentTab = tabs.find(t => t.id === tabId)
  const tabCwd = currentTab?.cwd || '~'
  const tabTeamName = currentTab?.teamName
  const teams = useAgentTeamsStore(s => s.teams)
  const activeTeam = tabTeamName ? teams[tabTeamName] : null

  // Get teammate mode setting from Claude config
  const [teammateMode, setTeammateMode] = useState<string>('auto')
  useEffect(() => {
    window.claude?.readAgentTeamsConfig().then(config => {
      setTeammateMode(config.teammateMode || 'auto')
    }).catch(() => {})
  }, [])

  // Claude detection state - use refs to avoid closure issues
  // Only update React state in 'rendered' mode (where we need it for conditional CSS)
  // In other modes, use ref only to avoid unnecessary re-renders that steal xterm focus
  const [isClaudeActive, _setIsClaudeActive] = useState(false)
  const isClaudeActiveRef = useRef(false)
  const setIsClaudeActive = useCallback((active: boolean) => {
    isClaudeActiveRef.current = active
    if (renderModeRef.current === 'rendered') {
      _setIsClaudeActive(active)
    }
  }, [])
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

  // Throttle parseClaudeInfo to avoid excessive store updates
  const lastClaudeInfoUpdateRef = useRef<number>(0)
  const CLAUDE_INFO_THROTTLE_MS = 2000 // Only update status info every 2 seconds

  // Cooldown: prevent rapid isClaudeActive toggling (e.g., /status output)
  const claudeDeactivatedAtRef = useRef<number>(0)
  const CLAUDE_REACTIVATION_COOLDOWN_MS = 3000 // Don't re-trigger Claude detection for 3s after deactivation

  // Claude status tracking for tab indicator
  const claudeLoadingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const CLAUDE_LOADING_DEBOUNCE_MS = 2000 // Wait 2 seconds of silence to show "loading" status
  const lastPermissionNotiRef = useRef<number>(0) // Deduplicate permission notifications
  const lastCompletedNotiRef = useRef<number>(0) // Deduplicate completed notifications
  const setClaudeStatusRef = useRef(setClaudeStatus)
  const tabIdRef = useRef(tabId)
  useEffect(() => {
    setClaudeStatusRef.current = setClaudeStatus
    tabIdRef.current = tabId
  }, [setClaudeStatus, tabId])

  // === Abstracted mode state ===
  // Initialize from module-level cache to survive component remounts
  const [outputBlocks, setOutputBlocks] = useState<OutputBlock[]>(
    () => (tabId ? outputBlocksCache.get(tabId) ?? [] : [])
  )
  const currentOutputRef = useRef<string>(tabId ? currentOutputCache.get(tabId) ?? '' : '')
  const currentBlockTypeRef = useRef<'output' | 'claude' | 'teammate'>('output')
  const currentTeammateNameRef = useRef<string | null>(null)
  const echoSuppressRef = useRef<string | null>(null)
  const terminalInputRef = useRef<TerminalInputHandle>(null)
  // Track xterm buffer row where Claude output started (for reading clean text)
  const claudeBufferStartRowRef = useRef<number>(0)
  // Keep renderMode in a ref for use inside callbacks
  const renderModeRef = useRef(renderMode)
  useEffect(() => {
    renderModeRef.current = renderMode
  }, [renderMode])

  // === Agent Split View - TODO: tmux 모드 구현 예정 ===
  // const [agentViewOpen, setAgentViewOpen] = useState(false)
  // const [teammateMode, setTeammateMode] = useState<string>('auto')

  // === Search state ===
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const outputAreaRef = useRef<HTMLDivElement>(null)
  const [searchMatchInfo, setSearchMatchInfo] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const searchTermRef = useRef('')
  const searchIndexRef = useRef(0)

  // === Abstracted mode: xterm reveal for Claude TUI ===
  const xtermRevealedRef = useRef(false)
  const [xtermRevealed, setXtermRevealed] = useState(false)

  const revealXterm = useCallback(() => {
    if (xtermRevealedRef.current) return
    xtermRevealedRef.current = true
    setXtermRevealed(true)
    console.log('🔓 Revealing xterm (Claude TUI active)')
    // Refit xterm to fill the now-visible container
    setTimeout(() => {
      fitAddonRef.current?.fit()
      // Focus xterm for Claude TUI interaction (allows Y/n permission responses)
      const term = terminalRef.current
      if (term) {
        console.log('✅ Auto-focusing xterm for Claude interaction')
        term.focus()
      }
      // Sync PTY size after fit
      if (ptyIdRef.current !== null && terminalRef.current) {
        const { cols, rows } = terminalRef.current
        if (cols > 10 && rows > 5) {
          window.terminal.resize(ptyIdRef.current, cols, rows)
        }
      }
    }, 50)
  }, [])

  const hideXterm = useCallback(() => {
    if (!xtermRevealedRef.current) return
    xtermRevealedRef.current = false
    setXtermRevealed(false)
    // Restore focus to TerminalInput
    setTimeout(() => {
      terminalInputRef.current?.focus()
    }, 50)
  }, [])

  // Patterns to detect command prompt (Claude session ended)
  // These are tested against the LAST LINE of data only, to avoid false matches mid-stream
  const promptPatterns = useMemo(() => [
    /\$\s*$/,                    // bash prompt ending with $
    /^[A-Z]:\\[^>]+>\s*$/,       // Windows CMD: C:\path>
    /^PS [^>]+>\s*$/,            // PowerShell prompt: PS C:\path>
    /❯\s*$/,                     // oh-my-zsh prompt
    /➜\s*$/,                     // oh-my-zsh arrow
    /╰─>\s*$/,                   // Custom prompt
    /\]\$\s*$/,                  // [user@host path]$
    /\]\s*%\s*$/,                // zsh prompt ending with %
  ], [])

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

  // Patterns to detect Agent Teams teammate output
  // Claude Code teammate output typically includes agent name headers or [teammate] markers
  const teammatePatterns = useMemo(() => [
    /\[teammate:?\s*([^\]]+)\]/i,           // [teammate: AgentName] or [teammate AgentName]
    /^🤖\s*(.+?)(?:\s*[-:]|$)/m,            // 🤖 AgentName: ... or 🤖 AgentName
    /Agent\s+"([^"]+)"\s+(?:started|working|completed)/i, // Agent "Name" started/working/completed
    /teammate\s+"([^"]+)"/i,                 // teammate "Name" ...
    /Spawning teammate:?\s*(.+)/i,           // Spawning teammate: Name
    /\[Agent\s+([^\]]+)\]/i,                 // [Agent Name]
  ], [])

  // Detect if data contains teammate output, returns teammate name or null
  const detectTeammateOutput = useCallback((data: string): string | null => {
    for (const pattern of teammatePatterns) {
      const match = data.match(pattern)
      if (match && match[1]) {
        return match[1].trim()
      }
    }
    return null
  }, [teammatePatterns])

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

  // IME composition state for Korean input
  const isComposingRef = useRef(false)
  const compositionJustEndedRef = useRef(false)

  // Strip ANSI escape codes from text
  const stripAnsi = useCallback((text: string): string => {
    // Remove all ANSI escape sequences
    return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
  }, [])


  const detectClaudeOutput = useCallback((data: string) => {
    return claudePatterns.some((pattern) => pattern.test(data))
  }, [claudePatterns])

  // Read clean text from xterm buffer (cursor movements already processed)
  const readTerminalBuffer = useCallback((fromRow: number): string => {
    const terminal = terminalRef.current
    if (!terminal) return ''
    const buffer = terminal.buffer.active
    const cursorRow = buffer.baseY + buffer.cursorY
    const lines: string[] = []
    for (let i = fromRow; i <= cursorRow; i++) {
      const line = buffer.getLine(i)
      if (line) {
        lines.push(line.translateToString(true))
      }
    }
    // Trim trailing empty lines
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop()
    }
    return lines.join('\n')
  }, [])

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

  // === Abstracted mode: finalize current output block ===
  const finalizeOutputBlock = useCallback(() => {
    const content = currentOutputRef.current
    if (content.trim()) {
      setOutputBlocks((prev) => {
        const last = prev[prev.length - 1]
        if (last?.isStreaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content, isStreaming: false },
          ]
        }
        return prev
      })
    }
    currentOutputRef.current = ''
    currentBlockTypeRef.current = 'output'
    currentTeammateNameRef.current = null
  }, [])

  // === Abstracted mode: schedule streaming update for output blocks ===
  const scheduleOutputBlockUpdate = useCallback((content: string, blockType: 'output' | 'claude' | 'teammate', teammateName?: string) => {
    setOutputBlocks((prev) => {
      const last = prev[prev.length - 1]
      if (last?.isStreaming && last.type === blockType && (blockType !== 'teammate' || last.teammateName === teammateName)) {
        return [
          ...prev.slice(0, -1),
          { ...last, content, isStreaming: true },
        ]
      } else {
        return [
          ...prev,
          { id: nextBlockId(), type: blockType, content, timestamp: Date.now(), isStreaming: true, teammateName },
        ]
      }
    })
  }, [])

  // === Search handlers ===
  const handleSearchChange = useCallback((term: string) => {
    searchTermRef.current = term
    searchIndexRef.current = 0

    if (renderModeRef.current === 'abstracted' && !xtermRevealedRef.current) {
      // DOM search on output area
      const container = outputAreaRef.current
      if (!container) { setSearchMatchInfo({ current: 0, total: 0 }); return }
      const total = highlightMatches(container, term)
      if (total > 0) {
        searchIndexRef.current = 1
        activateMatch(container, 0)
      }
      setSearchMatchInfo({ current: total > 0 ? 1 : 0, total })
    } else {
      // xterm SearchAddon
      const addon = searchAddonRef.current
      if (!addon) return
      if (!term) {
        addon.clearDecorations()
        setSearchMatchInfo({ current: 0, total: 0 })
        return
      }
      addon.findNext(term, { regex: false, caseSensitive: false, incremental: true })
    }
  }, [])

  const handleFindNext = useCallback(() => {
    const term = searchTermRef.current
    if (!term) return

    if (renderModeRef.current === 'abstracted' && !xtermRevealedRef.current) {
      const container = outputAreaRef.current
      if (!container) return
      const marks = container.querySelectorAll('mark.search-highlight')
      if (marks.length === 0) return
      let idx = searchIndexRef.current
      idx = idx >= marks.length ? 1 : idx + 1
      searchIndexRef.current = idx
      activateMatch(container, idx - 1)
      setSearchMatchInfo({ current: idx, total: marks.length })
    } else {
      searchAddonRef.current?.findNext(term, { regex: false, caseSensitive: false, incremental: false })
    }
  }, [])

  const handleFindPrev = useCallback(() => {
    const term = searchTermRef.current
    if (!term) return

    if (renderModeRef.current === 'abstracted' && !xtermRevealedRef.current) {
      const container = outputAreaRef.current
      if (!container) return
      const marks = container.querySelectorAll('mark.search-highlight')
      if (marks.length === 0) return
      let idx = searchIndexRef.current
      idx = idx <= 1 ? marks.length : idx - 1
      searchIndexRef.current = idx
      activateMatch(container, idx - 1)
      setSearchMatchInfo({ current: idx, total: marks.length })
    } else {
      searchAddonRef.current?.findPrevious(term, { regex: false, caseSensitive: false, incremental: false })
    }
  }, [])

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    searchTermRef.current = ''
    searchIndexRef.current = 0
    setSearchMatchInfo({ current: 0, total: 0 })

    // Clear highlights
    if (renderModeRef.current === 'abstracted' && !xtermRevealedRef.current) {
      const container = outputAreaRef.current
      if (container) clearHighlights(container)
    } else {
      searchAddonRef.current?.clearDecorations()
    }

    // Restore focus
    if (renderModeRef.current === 'abstracted') {
      // If xterm is revealed (Claude TUI active), keep focus on xterm
      if (xtermRevealedRef.current) {
        terminalRef.current?.focus()
      } else {
        terminalInputRef.current?.focus()
      }
    } else {
      terminalRef.current?.focus()
    }
  }, [])

  // Listen for open-search event
  useEffect(() => {
    const handleOpenSearch = () => {
      if (!isActiveRef.current) return
      setSearchOpen(true)
    }
    window.addEventListener('open-search', handleOpenSearch)
    return () => window.removeEventListener('open-search', handleOpenSearch)
  }, [])

  // Page Up/Down scrolling for abstracted mode
  useEffect(() => {
    if (renderMode !== 'abstracted' || !isActive) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const wrapper = outputAreaRef.current
      if (!wrapper || xtermRevealedRef.current) return

      // Find the actual scrollable .output-area element inside the wrapper
      const scrollable = wrapper.querySelector('.output-area') as HTMLElement
      if (!scrollable) return

      if (e.key === 'PageUp') {
        e.preventDefault()
        scrollable.scrollBy({ top: -scrollable.clientHeight * 0.9, behavior: 'smooth' })
      } else if (e.key === 'PageDown') {
        e.preventDefault()
        scrollable.scrollBy({ top: scrollable.clientHeight * 0.9, behavior: 'smooth' })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [renderMode, isActive])

  // Listen for xterm SearchAddon result events
  useEffect(() => {
    const addon = searchAddonRef.current
    if (!addon) return
    const disposable = addon.onDidChangeResults?.((e: { resultIndex: number; resultCount: number }) => {
      if (e) {
        setSearchMatchInfo({
          current: e.resultCount > 0 ? e.resultIndex + 1 : 0,
          total: e.resultCount,
        })
      }
    })
    return () => disposable?.dispose()
  }, [ptyId]) // Re-subscribe when ptyId changes (terminal re-initialized)

  const handleTerminalData = useCallback((data: string) => {
    // Always write to xterm - terminal output should always be visible
    const term = terminalRef.current
    if (term) {
      term.write(data)
      // Auto-scroll to bottom if enabled
      if (autoScroll) {
        term.scrollToBottom()
      }
    }

    // Detect Claude output (for history and visual rendering)
    const isClaudeData = detectClaudeOutput(data)
    const strippedData = stripAnsi(data)

    // Parse Claude info (model, tokens, cost, context) from output
    // Always parse every chunk, but throttle store updates
    if (tabIdRef.current) {
      const info = parseClaudeInfo(strippedData)
      if (info) {
        const now = Date.now()
        if (now - lastClaudeInfoUpdateRef.current >= CLAUDE_INFO_THROTTLE_MS) {
          lastClaudeInfoUpdateRef.current = now
        }
        updateClaudeSession(tabIdRef.current, info)
      }
    }

    // Permission request detection (Claude Code uses "Allow Tool(...)" + "(Y/n)" format)
    if (/\(Y\/n\)/i.test(strippedData) || /\(Y\)es.*\(N\)o/i.test(strippedData) || /Allow\s+(Read|Write|Edit|Bash|Glob|Grep|Search|Task|mcp_)/i.test(strippedData)) {
      const now = Date.now()
      if (now - lastPermissionNotiRef.current > 5000) {
        lastPermissionNotiRef.current = now
        // Notifications disabled
        // useNotificationStore.getState().addNotification({
        //   type: 'warning',
        //   title: 'Permission request',
        //   tabId: tabIdRef.current ?? undefined,
        // })
      }
    }

    // Check if prompt has returned (Claude session ended)
    // Only test the LAST non-empty line to avoid false matches from Claude's streaming output
    const dataLines = strippedData.split('\n')
    let lastLine = ''
    for (let i = dataLines.length - 1; i >= 0; i--) {
      if (dataLines[i].trim()) {
        lastLine = dataLines[i].trim()
        break
      }
    }
    // Only consider prompt return on small data chunks (large chunks = still streaming)
    // When Claude is active, skip size check — TUI exit screen redraws can be large
    const isPromptReturn = lastLine.length > 0 &&
      (isClaudeActiveRef.current || strippedData.length < 500) &&
      promptPatterns.some(pattern => pattern.test(lastLine))

    if (isClaudeData && !isClaudeActiveRef.current) {
      // Cooldown: skip re-activation if we just deactivated (prevents /status toggle loop)
      const timeSinceDeactivation = Date.now() - claudeDeactivatedAtRef.current
      if (timeSinceDeactivation < CLAUDE_REACTIVATION_COOLDOWN_MS) {
        // Still in cooldown — don't re-trigger, just parse info if needed
      } else {
      setIsClaudeActive(true)
      console.log('[History] Claude detected')

      // Set tab status to "running"
      if (tabIdRef.current) {
        setClaudeStatusRef.current(tabIdRef.current, 'running')
      }

      // Create conversation if not exists
      if (!conversationIdRef.current) {
        const newId = createConversationRef.current(tabCwdRef.current)
        conversationIdRef.current = newId
        console.log('[History] Auto-created conversation:', newId)
      }

      // Abstracted mode: finalize any pending output block and reveal xterm for TUI
      if (renderModeRef.current === 'abstracted') {
        finalizeOutputBlock()
        revealXterm()
      }
      } // end else (cooldown check)
    }

    // Update status when Claude is active
    if (isClaudeActiveRef.current && tabIdRef.current) {
      // Cancel loading timer since we got output
      if (claudeLoadingTimerRef.current) {
        clearTimeout(claudeLoadingTimerRef.current)
        claudeLoadingTimerRef.current = null
      }

      // Set to running (we're receiving data)
      setClaudeStatusRef.current(tabIdRef.current, 'running')

      // Check for prompt return (completion)
      if (isPromptReturn) {
        // Prompt detected - Claude session completed
        if (claudeEndTimerRef.current) {
          clearTimeout(claudeEndTimerRef.current)
          claudeEndTimerRef.current = null
        }
        setClaudeStatusRef.current(tabIdRef.current, 'completed')
        const nowComp = Date.now()
        if (nowComp - lastCompletedNotiRef.current > 5000) {
          lastCompletedNotiRef.current = nowComp
          // Notifications disabled
          // useNotificationStore.getState().addNotification({
          //   type: 'success',
          //   title: 'Claude completed',
          //   tabId: tabIdRef.current ?? undefined,
          // })
        }
        claudeDeactivatedAtRef.current = Date.now()
        setIsClaudeActive(false)
        finalizeBlock()
        console.log('[Status] Claude completed (prompt returned)')

        // Abstracted mode: hide xterm TUI, finalize output block on prompt return
        if (renderModeRef.current === 'abstracted') {
          hideXterm()
          finalizeOutputBlock()
        }
      } else {
        // Start loading timer - if no output for 2 seconds, show "loading"
        claudeLoadingTimerRef.current = setTimeout(() => {
          if (isClaudeActiveRef.current && tabIdRef.current) {
            setClaudeStatusRef.current(tabIdRef.current, 'loading')
            console.log('[Status] Claude loading (waiting for response)')
          }
        }, CLAUDE_LOADING_DEBOUNCE_MS)

        // Abstracted mode: detect response-end via silence debounce
        // In interactive Claude TUI, shell prompt never returns, so prompt-based
        // detection doesn't work. Use 1s silence debounce to detect response end.
        if (renderModeRef.current === 'abstracted') {
          if (claudeEndTimerRef.current) {
            clearTimeout(claudeEndTimerRef.current)
          }
          claudeEndTimerRef.current = setTimeout(() => {
            if (isClaudeActiveRef.current && tabIdRef.current) {
              setClaudeStatusRef.current(tabIdRef.current, 'completed')
              const nowComp = Date.now()
              if (nowComp - lastCompletedNotiRef.current > 5000) {
                lastCompletedNotiRef.current = nowComp
                // Notifications disabled
                // useNotificationStore.getState().addNotification({
                //   type: 'success',
                //   title: 'Claude completed',
                //   tabId: tabIdRef.current ?? undefined,
                // })
              }
              console.log('[Status] Claude response ended (abstracted debounce)')
            }
            claudeEndTimerRef.current = null
          }, CLAUDE_END_DEBOUNCE_MS)
        }
      }
    }

    // === Abstracted mode: accumulate output into blocks ===
    if (renderModeRef.current === 'abstracted') {
      // Ensure xterm is revealed when Claude is active (safety net)
      if (isClaudeActiveRef.current && !xtermRevealedRef.current) {
        revealXterm()
      }
      // When xterm is revealed (Claude TUI active), skip block accumulation —
      // xterm handles all rendering directly
      if (xtermRevealedRef.current) {
        return
      }

      // Echo suppression: skip data that matches the command we just sent
      if (echoSuppressRef.current) {
        const stripped = strippedData.trim()
        if (stripped && echoSuppressRef.current.includes(stripped)) {
          echoSuppressRef.current = null
          return
        }
        // If we get a newline right after command, suppress it
        if (stripped === '') {
          return
        }
        echoSuppressRef.current = null
      }

      // Detect teammate output and update block type accordingly
      const detectedTeammate = detectTeammateOutput(strippedData)
      if (detectedTeammate) {
        // If switching from a different block type or different teammate, finalize current
        if (currentBlockTypeRef.current !== 'teammate' || currentTeammateNameRef.current !== detectedTeammate) {
          if (currentOutputRef.current.trim()) {
            finalizeOutputBlock()
          }
          currentBlockTypeRef.current = 'teammate'
          currentTeammateNameRef.current = detectedTeammate
        }
      }

      // Accumulate raw data FIRST (before prompt return check to avoid data loss)
      currentOutputRef.current += data

      // Schedule a streaming update with detected block type
      const blockType = currentBlockTypeRef.current
      const teammateName = blockType === 'teammate' ? currentTeammateNameRef.current ?? undefined : undefined
      scheduleOutputBlockUpdate(currentOutputRef.current, blockType, teammateName)

      // Prompt return in abstracted mode: finalize after data is accumulated
      if (isPromptReturn && !isClaudeActiveRef.current) {
        finalizeOutputBlock()
      }
      return
    }

    // Visual rendering for Claude output (hybrid/rendered mode only)
    if ((renderMode === 'hybrid' || renderMode === 'rendered') && isClaudeActiveRef.current) {
      currentBlockRef.current += data
      scheduleBlockUpdate(strippedData, true)

      // Reset debounce timer for block finalization
      if (claudeEndTimerRef.current) {
        clearTimeout(claudeEndTimerRef.current)
      }

      claudeEndTimerRef.current = setTimeout(() => {
        finalizeBlock()
        claudeDeactivatedAtRef.current = Date.now()
        setIsClaudeActive(false)
        claudeEndTimerRef.current = null
        // Set to completed when Claude response ends
        if (tabIdRef.current) {
          setClaudeStatusRef.current(tabIdRef.current, 'completed')
          const nowComp = Date.now()
          if (nowComp - lastCompletedNotiRef.current > 5000) {
            lastCompletedNotiRef.current = nowComp
            // Notifications disabled
            // useNotificationStore.getState().addNotification({
            //   type: 'success',
            //   title: 'Claude completed',
            //   tabId: tabIdRef.current ?? undefined,
            // })
          }
        }
      }, CLAUDE_END_DEBOUNCE_MS)
    }
  }, [renderMode, detectClaudeOutput, detectTeammateOutput, scheduleBlockUpdate, finalizeBlock, stripAnsi, promptPatterns, finalizeOutputBlock, scheduleOutputBlockUpdate, updateClaudeSession, setIsClaudeActive, revealXterm, hideXterm, autoScroll])

  // === Abstracted mode: command submit handler ===
  const handleCommandSubmit = useCallback((command: string) => {
    if (ptyIdRef.current === null) return

    // Finalize any in-progress output block
    finalizeOutputBlock()

    // Add command block
    setOutputBlocks((prev) => [
      ...prev,
      {
        id: nextBlockId(),
        type: 'command',
        content: command,
        timestamp: Date.now(),
        isStreaming: false,
      },
    ])

    // Set up echo suppression for the command (use first line for multiline)
    echoSuppressRef.current = command.split('\n')[0]

    // Reset block type (keep 'claude' if Claude is active so response renders correctly)
    if (!isClaudeActiveRef.current) {
      currentBlockTypeRef.current = 'output'
    }
    currentOutputRef.current = ''

    // Send to PTY - handle multiline commands by sending each line separately.
    // TUI apps (like Claude Code) may not process bulk "text+\r" correctly
    // because they expect character-by-character input from the terminal.
    const id = ptyIdRef.current
    const lines = command.split('\n')

    if (lines.length === 1) {
      // Single line: write text, then Enter after short delay
      window.terminal.write(id, command)
      setTimeout(() => {
        if (ptyIdRef.current === id) {
          window.terminal.write(id, '\r')
        }
      }, 10)
    } else {
      // Multiline: send each line with Enter, staggered with delays
      lines.forEach((line, i) => {
        setTimeout(() => {
          if (ptyIdRef.current !== id) return
          window.terminal.write(id, line)
          setTimeout(() => {
            if (ptyIdRef.current === id) {
              window.terminal.write(id, '\r')
            }
          }, 10)
        }, i * 50) // 50ms between lines for reliable processing
      })
    }

    // Claude command detection for history
    const isClaudeCommand = command.match(/^claude\b/i)
    if (isClaudeCommand) {
      const newId = createConversationRef.current(tabCwdRef.current)
      conversationIdRef.current = newId
      addMessageRef.current(conversationIdRef.current, 'user', command)
      if (tabIdRef.current) {
        setClaudeStatusRef.current(tabIdRef.current, 'running')
        setIsClaudeActive(true)
      }
      // Don't reveal xterm yet — wait for actual Claude TUI data to arrive.
      // The data handler's safety net (line ~606) will call revealXterm()
      // when Claude output is detected, preventing a blank screen flash.
    } else if (conversationIdRef.current) {
      addMessageRef.current(conversationIdRef.current, 'user', command)
    }
  }, [finalizeOutputBlock, setIsClaudeActive])

  // === Abstracted mode: signal handler ===
  const handleSignal = useCallback((signal: string) => {
    // Ctrl+C: if xterm has selected text, copy to clipboard instead of sending SIGINT
    if (signal === '\x03' && terminalRef.current?.hasSelection()) {
      const selectedText = terminalRef.current.getSelection()
      if (selectedText) {
        navigator.clipboard.writeText(selectedText)
        terminalRef.current.clearSelection()
        return
      }
    }
    // Also check DOM text selection (output area text selected before xterm reveal)
    if (signal === '\x03') {
      const sel = window.getSelection()
      if (sel && sel.toString().length > 0) {
        navigator.clipboard.writeText(sel.toString())
        sel.removeAllRanges()
        return
      }
    }
    if (ptyIdRef.current !== null) {
      window.terminal.write(ptyIdRef.current, signal)
    }
  }, [])

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
            // Set status to running when Claude command is started
            if (tabIdRef.current) {
              setClaudeStatusRef.current(tabIdRef.current, 'running')
              setIsClaudeActive(true)
            }
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

  // Sync outputBlocks to module-level cache so they survive remounts
  useEffect(() => {
    if (tabId) {
      outputBlocksCache.set(tabId, outputBlocks)
    }
  }, [tabId, outputBlocks])

  // Sync currentOutput buffer to cache
  // Use an interval since the ref changes without triggering re-renders
  useEffect(() => {
    if (!tabId) return
    const interval = setInterval(() => {
      currentOutputCache.set(tabId, currentOutputRef.current)
    }, 500)
    return () => {
      clearInterval(interval)
      // Save final state on unmount
      if (tabId) {
        currentOutputCache.set(tabId, currentOutputRef.current)
      }
    }
  }, [tabId])

  // Cleanup RAF and timers on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
      if (claudeEndTimerRef.current !== null) {
        clearTimeout(claudeEndTimerRef.current)
      }
      if (claudeLoadingTimerRef.current !== null) {
        clearTimeout(claudeLoadingTimerRef.current)
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

    const searchAddon = new SearchAddon()
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(searchAddon)
    searchAddonRef.current = searchAddon

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

      // Handle user input with IME composition support
      terminal.onData((data) => {
        // Skip if IME is composing (Korean, Japanese, Chinese input)
        if (isComposingRef.current) {
          return
        }
        // Skip duplicated input right after composition ends
        if (compositionJustEndedRef.current) {
          compositionJustEndedRef.current = false
          // Only allow control characters (Enter, Space, etc.) through
          if (data.length > 1 || data.charCodeAt(0) > 127) {
            return
          }
        }
        handleUserInput(data)
      })

      // Handle IME composition events for Korean input
      const textareaEl = terminalContainerRef.current?.querySelector('textarea')
      if (textareaEl) {
        textareaEl.addEventListener('compositionstart', () => {
          isComposingRef.current = true
        })
        textareaEl.addEventListener('compositionend', (e: CompositionEvent) => {
          isComposingRef.current = false
          compositionJustEndedRef.current = true
          // Send the composed text to PTY
          if (e.data && ptyIdRef.current !== null) {
            window.terminal.write(ptyIdRef.current, e.data)
            // Also add to user input buffer
            userInputBuffer.current += e.data
          }
        })
      }

      // Handle terminal title changes (OSC sequences)
      terminal.onTitleChange((title) => {
        if (tabId && title) {
          // Clean up the title - extract meaningful part
          // Windows terminal often sets title like "path && command"
          // We want to show just the directory name or a clean title
          let cleanTitle = title

          // If title contains command chains (&&), extract the path part
          if (title.includes('&&')) {
            const parts = title.split('&&')
            cleanTitle = parts[0].trim()
          }

          // Extract just the folder name if it's a full path
          const pathMatch = cleanTitle.match(/([A-Za-z]:\\[^\s]+|\/[^\s]+)/)
          if (pathMatch) {
            const fullPath = pathMatch[1]
            const folderName = fullPath.split(/[/\\]/).filter(Boolean).pop() || fullPath
            cleanTitle = folderName
          }

          // Limit title length
          if (cleanTitle.length > 30) {
            cleanTitle = cleanTitle.substring(0, 27) + '...'
          }

          // Only update if we have a meaningful title
          if (cleanTitle && cleanTitle.length > 0) {
            updateTabTitle(tabId, cleanTitle)
          }
        }
      })

      // Create PTY with tab's cwd
      const initPty = async () => {
        // In abstracted mode, xterm is hidden (1px) so cols/rows are tiny.
        // Use reasonable defaults so PTY output isn't wrapped at 1-2 chars.
        const cols = terminal.cols > 10 ? terminal.cols : 120
        const rows = terminal.rows > 5 ? terminal.rows : 30
        const id = await window.terminal.create(cols, rows, tabCwd, shell)
        ptyIdRef.current = id
        setPtyId(id)

        // Store terminal ID in tab
        if (tabId) {
          setTerminalId(tabId, id)

          // Get actual cwd from PTY and update tab
          const actualCwd = await window.terminal.getCwd(id)
          if (actualCwd) {
            console.log('[HybridTerminal] PTY started in:', actualCwd)
            updateTabCwd(tabId, actualCwd)
          }
        }

        // Focus: in abstracted mode focus the textarea, otherwise focus xterm
        if (renderModeRef.current === 'abstracted') {
          terminalInputRef.current?.focus()
        } else {
          terminal.focus()
        }
      }

      initPty()

      // Handle resize
      const resizeObserver = new ResizeObserver(() => {
        try {
          fitAddon.fit()
          if (ptyIdRef.current !== null) {
            const { cols, rows } = terminal
            // Don't send tiny sizes to PTY (happens in abstracted mode where xterm is 1px)
            if (cols > 10 && rows > 5) {
              window.terminal.resize(ptyIdRef.current, cols, rows)
            }
          }
        } catch (e) {
          // Ignore resize errors
        }
      })
      resizeObserver.observe(terminalContainerRef.current!)
      resizeObserverRef.current = resizeObserver
    }, 0)

    return () => {
      // Cleanup terminal and PTY
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

        // Abstracted mode: hide xterm TUI if revealed, add system block
        if (renderModeRef.current === 'abstracted') {
          hideXterm()
          finalizeOutputBlock()
          setOutputBlocks((prev) => [
            ...prev,
            {
              id: nextBlockId(),
              type: 'system',
              content: `[Process exited with code ${exitCode}]`,
              timestamp: Date.now(),
              isStreaming: false,
            },
          ])
        }
      }
    })

    return () => {
      unsubData()
      unsubExit()
    }
  }, [ptyId, handleTerminalData, finalizeOutputBlock, hideXterm])

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

  // When tab becomes active, restore outputBlocks from cache if they were lost
  // This is a defensive measure against any state reset during tab switching
  useEffect(() => {
    if (tabId && isActive && renderMode === 'abstracted') {
      const cached = outputBlocksCache.get(tabId)
      if (cached && cached.length > 0 && outputBlocks.length === 0) {
        // Restore from cache
        setOutputBlocks(cached)
      }
    }
  }, [tabId, isActive, renderMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Focus input and refit terminal when tab becomes active
  useEffect(() => {
    if (!tabId || !isActive) return
    const term = terminalRef.current
    if (renderMode === 'abstracted') {
      // Only focus input if xterm is NOT revealed
      if (xtermRevealedRef.current) {
        if (term) {
          fitAddonRef.current?.fit()
          term.refresh(0, term.rows - 1)
          term.focus() // Keep focus on xterm when it's active
        }
      } else {
        terminalInputRef.current?.focus()
      }
    } else {
      fitAddonRef.current?.fit()
      term?.focus()
      if (term) {
        term.refresh(0, term.rows - 1)
      }
    }
  }, [tabId, isActive, renderMode])

  // Listen for focus-terminal event (e.g., when closing command palette)
  useEffect(() => {
    const handleFocusTerminal = () => {
      if (isActive) {
        if (renderMode === 'abstracted' && !xtermRevealedRef.current) {
          terminalInputRef.current?.focus()
        } else {
          terminalRef.current?.focus()
        }
      }
    }
    window.addEventListener('focus-terminal', handleFocusTerminal)
    return () => window.removeEventListener('focus-terminal', handleFocusTerminal)
  }, [isActive, renderMode])

  // Auto-focus input when mouse enters the app window (abstracted mode)
  useEffect(() => {
    if (renderMode !== 'abstracted' || !isActive) return
    const el = containerRef.current
    if (!el) return
    const handleMouseEnter = () => {
      // Don't steal focus if user is selecting text (for copy)
      const sel = window.getSelection()
      if (sel && sel.toString().length > 0) return
      // Don't steal focus if xterm is revealed (Claude TUI active)
      if (xtermRevealedRef.current) return
      terminalInputRef.current?.focus()
    }
    el.addEventListener('mouseenter', handleMouseEnter)
    return () => el.removeEventListener('mouseenter', handleMouseEnter)
  }, [isActive, renderMode])

  // Abstracted mode: ensure textarea stays focused when output arrives
  // Re-renders from outputBlocks updates can steal focus from the textarea
  useEffect(() => {
    if (renderMode !== 'abstracted' || !isActive || xtermRevealedRef.current) return
    // After output blocks update, restore focus to input
    const timer = setTimeout(() => {
      const active = document.activeElement
      const textarea = terminalInputRef.current
      // Don't steal focus if user has text selected (for copy)
      const sel = window.getSelection()
      if (sel && sel.toString().length > 0) return
      // Only refocus if nothing else important is focused (e.g., not a settings panel input)
      if (textarea && (!active || active === document.body || active.closest('.hybrid-terminal'))) {
        textarea.focus()
      }
    }, 0)
    return () => clearTimeout(timer)
  }, [outputBlocks, isActive, renderMode])

  // Edge case: if renderMode changes while xterm is revealed, hide it
  useEffect(() => {
    if (renderMode !== 'abstracted' && xtermRevealedRef.current) {
      hideXterm()
    }
  }, [renderMode, hideXterm])

  // Listen for command-from-palette event (App.tsx sends commands)
  useEffect(() => {
    const handlePaletteCommand = (e: Event) => {
      const command = (e as CustomEvent<string>).detail
      if (command && isActive && renderMode === 'abstracted') {
        handleCommandSubmit(command)
      }
    }
    window.addEventListener('command-from-palette', handlePaletteCommand)
    return () => window.removeEventListener('command-from-palette', handlePaletteCommand)
  }, [isActive, renderMode, handleCommandSubmit])

  // Listen for write-to-pty event (e.g., model change from ClaudeInfoBar)
  useEffect(() => {
    const handleWriteToPty = (e: Event) => {
      const data = (e as CustomEvent<string>).detail
      if (data && isActive && ptyIdRef.current !== null) {
        window.terminal.write(ptyIdRef.current, data)
      }
    }
    window.addEventListener('write-to-pty', handleWriteToPty)
    return () => window.removeEventListener('write-to-pty', handleWriteToPty)
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

  // === Abstracted mode: extract command history for autocomplete ===
  // Use ref to keep stable reference — only update when command list actually changes
  const commandHistoryRef = useRef<string[]>([])
  const commandHistory = useMemo(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (let i = outputBlocks.length - 1; i >= 0; i--) {
      const block = outputBlocks[i]
      if (block.type === 'command' && block.content.trim() && !seen.has(block.content)) {
        seen.add(block.content)
        result.push(block.content)
      }
    }
    // Compare with previous to avoid unnecessary re-renders of TerminalInput
    const prev = commandHistoryRef.current
    if (prev.length === result.length && prev.every((v, i) => v === result[i])) {
      return prev
    }
    commandHistoryRef.current = result
    return result
  }, [outputBlocks])

  // === Abstracted mode render ===
  if (renderMode === 'abstracted') {
    // Check if tmux mode should be active
    const useTmuxMode = activeTeam && teammateMode === 'tmux' && currentTab

    // Terminal content (shared between tmux and normal mode)
    const terminalContent = (
      <>
        {/* xterm — hidden by default, revealed full-size when Claude TUI is active */}
        <div
          ref={terminalContainerRef}
          className="xterm-abstracted"
          onClick={(e) => {
            console.log('🖱️ Terminal clicked, xtermRevealed:', xtermRevealed)
            if (xtermRevealed) {
              e.stopPropagation() // Prevent parent onClick from focusing input
              const term = terminalRef.current
              if (term) {
                console.log('✅ Focusing terminal (xterm)')
                term.focus()
              } else {
                console.warn('⚠️ Terminal ref is null!')
              }
            } else {
              console.log('ℹ️ xterm is hidden, skipping focus')
            }
          }}
        />
        {/* Output blocks area - mousedown blurs textarea so Ctrl+C does native copy */}
        <div ref={outputAreaRef} className="output-area-wrapper" onMouseDown={() => terminalInputRef.current?.blur()}>
          <OutputArea blocks={outputBlocks} />
        </div>
        {/* Claude session info bar */}
        <ClaudeInfoBar tabId={tabId} />
        {/* Input bar */}
        <div
          className="input-bar-wrapper"
          onClick={(e) => {
            console.log('🖱️ Input bar clicked')
            e.stopPropagation() // Prevent parent onClick
            terminalInputRef.current?.focus()
          }}
        >
          <TerminalInput
            ref={terminalInputRef}
            onSubmit={handleCommandSubmit}
            onSignal={handleSignal}
            commandHistory={commandHistory}
            claudeActiveRef={isClaudeActiveRef}
            cwd={tabCwd}
          />
        </div>
      </>
    )

    return (
      <div
        ref={containerRef}
        className={`hybrid-terminal ${isActive ? '' : 'hidden'} ${xtermRevealed ? 'xterm-tui-active' : ''}`}
        onClick={() => {
          // Don't steal focus if user is selecting text (for copy)
          const sel = window.getSelection()
          if (sel && sel.toString().length > 0) {
            console.log('🔍 Text selected, not focusing input')
            return
          }
          // If xterm is revealed, don't auto-focus input (let explicit clicks handle it)
          if (xtermRevealed) {
            console.log('🖱️ Container clicked (xterm active), no auto-focus')
            return
          }
          console.log('🖱️ Container clicked, focusing input')
          terminalInputRef.current?.focus()
        }}
      >
        {/* Search bar */}
        <SearchBar
          isOpen={searchOpen}
          onClose={handleSearchClose}
          onSearchChange={handleSearchChange}
          onFindNext={handleFindNext}
          onFindPrev={handleFindPrev}
          matchInfo={searchMatchInfo}
        />

        {/* tmux mode: Split layout with team info */}
        {useTmuxMode ? (
          <TmuxLayout team={activeTeam} currentTab={currentTab}>
            {terminalContent}
          </TmuxLayout>
        ) : (
          terminalContent
        )}
      </div>
    )
  }

  // === Existing modes render ===
  return (
    <div ref={containerRef} className={`hybrid-terminal ${isActive ? '' : 'hidden'}`}>
      {/* Search bar */}
      <SearchBar
        isOpen={searchOpen}
        onClose={handleSearchClose}
        onSearchChange={handleSearchChange}
        onFindNext={handleFindNext}
        onFindPrev={handleFindPrev}
        matchInfo={searchMatchInfo}
      />
      {/* Claude rendered output */}
      {claudeBlocksContent}

      {/* Terminal (always present, may be hidden in pure render mode) */}
      <div
        ref={terminalContainerRef}
        className={`terminal-area ${renderMode === 'rendered' && isClaudeActive ? 'hidden' : ''}`}
        onClick={() => {
          console.log('🖱️ Terminal area clicked (non-abstracted mode)')
          const term = terminalRef.current
          if (term) {
            console.log('✅ Focusing terminal')
            term.focus()
          } else {
            console.warn('⚠️ Terminal ref is null!')
          }
        }}
      />

      {/* Claude session info bar */}
      <ClaudeInfoBar tabId={tabId} />

      {/* Agent Split View - tmux 모드 구현 예정 */}
    </div>
  )
}
