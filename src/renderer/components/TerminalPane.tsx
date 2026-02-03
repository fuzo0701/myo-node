import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { useThemeStore } from '../store/theme'
import { useHistoryStore } from '../store/history'
import { useTabStore } from '../store/tabs'
import { createConversationParser, isClaudeCodeOutput } from '../utils/claudeParser'

interface TerminalPaneProps {
  tabId: string | null | undefined
}

export default function TerminalPane({ tabId }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const parserRef = useRef(createConversationParser())
  const [ptyId, setPtyId] = useState<number | null>(null)
  const theme = useThemeStore((state) => state.currentTheme)
  const { createConversation, addMessage } = useHistoryStore()
  const { tabs, setTerminalId } = useTabStore()
  const tab = tabs.find(t => t.id === tabId)
  const conversationIdRef = useRef<string | null>(null)
  const isClaudeSessionRef = useRef(false)

  // Handle captured messages from Claude
  const handleCapturedData = useCallback((data: string) => {
    // Check if this looks like Claude Code output
    if (!isClaudeSessionRef.current && isClaudeCodeOutput(data)) {
      isClaudeSessionRef.current = true
      conversationIdRef.current = createConversation(process.cwd?.() || '~')
    }

    if (isClaudeSessionRef.current && conversationIdRef.current) {
      const messages = parserRef.current.processData(data)
      for (const msg of messages) {
        addMessage(conversationIdRef.current, msg.role, msg.content)
      }
    }
  }, [createConversation, addMessage])

  useEffect(() => {
    if (!containerRef.current || !tabId) return

    const terminal = new Terminal({
      fontFamily: theme.fontFamily,
      fontSize: theme.fontSize,
      theme: {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        cursorAccent: theme.cursorAccent,
        selectionBackground: theme.selection,
        // ANSI colors
        black: theme.black,
        red: theme.red,
        green: theme.green,
        yellow: theme.yellow,
        blue: theme.blue,
        magenta: theme.magenta,
        cyan: theme.cyan,
        white: theme.white,
        brightBlack: theme.brightBlack,
        brightRed: theme.brightRed,
        brightGreen: theme.brightGreen,
        brightYellow: theme.brightYellow,
        brightBlue: theme.brightBlue,
        brightMagenta: theme.brightMagenta,
        brightCyan: theme.brightCyan,
        brightWhite: theme.brightWhite,
      },
      cursorBlink: true,
      cursorStyle: 'bar',
      cursorWidth: 2,
    })

    const fitAddon = new FitAddon()
    const webLinksAddon = new WebLinksAddon()

    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon

    // Create PTY with saved cwd
    const initPty = async () => {
      const { cols, rows } = terminal
      const savedCwd = tab?.cwd
      const id = await window.terminal.create(cols, rows, savedCwd)
      setPtyId(id)

      // Store terminal ID in tab
      if (tabId) {
        setTerminalId(tabId, id)
      }

      // Handle terminal input
      terminal.onData((data) => {
        window.terminal.write(id, data)
      })
    }

    initPty()

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (ptyId !== null) {
        const { cols, rows } = terminal
        window.terminal.resize(ptyId, cols, rows)
      }
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      terminal.dispose()
      if (ptyId !== null) {
        window.terminal.kill(ptyId)
      }
    }
  }, [tabId])

  // Handle PTY data
  useEffect(() => {
    if (ptyId === null) return

    const unsubData = window.terminal.onData((id, data) => {
      if (id === ptyId && terminalRef.current) {
        terminalRef.current.write(data)
        // Capture data for conversation history
        handleCapturedData(data)
      }
    })

    const unsubExit = window.terminal.onExit((id, exitCode) => {
      if (id === ptyId && terminalRef.current) {
        terminalRef.current.write(`\r\n[Process exited with code ${exitCode}]\r\n`)
      }
    })

    return () => {
      unsubData()
      unsubExit()
    }
  }, [ptyId, handleCapturedData])

  // Update theme
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.options.theme = {
        background: theme.background,
        foreground: theme.foreground,
        cursor: theme.cursor,
        cursorAccent: theme.cursorAccent,
        selectionBackground: theme.selection,
        // ANSI colors
        black: theme.black,
        red: theme.red,
        green: theme.green,
        yellow: theme.yellow,
        blue: theme.blue,
        magenta: theme.magenta,
        cyan: theme.cyan,
        white: theme.white,
        brightBlack: theme.brightBlack,
        brightRed: theme.brightRed,
        brightGreen: theme.brightGreen,
        brightYellow: theme.brightYellow,
        brightBlue: theme.brightBlue,
        brightMagenta: theme.brightMagenta,
        brightCyan: theme.brightCyan,
        brightWhite: theme.brightWhite,
      }
      terminalRef.current.options.fontFamily = theme.fontFamily
      terminalRef.current.options.fontSize = theme.fontSize
    }
  }, [theme])

  if (!tabId) {
    return <div className="terminal-pane empty">No terminal selected</div>
  }

  return <div ref={containerRef} className="terminal-pane" />
}
