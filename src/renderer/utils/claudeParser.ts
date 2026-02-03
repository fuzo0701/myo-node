/**
 * Enhanced parser for detecting Claude Code conversations from terminal output
 * Supports Claude Code CLI output patterns
 */

export interface ParsedMessage {
  role: 'user' | 'assistant'
  content: string
  toolUse?: ToolUse[]
  thinking?: string
}

export interface ToolUse {
  type: 'read' | 'write' | 'edit' | 'bash' | 'search' | 'glob' | 'grep' | 'unknown'
  target: string
  status?: 'running' | 'complete' | 'error'
}

// ANSI escape code stripper
const stripAnsi = (str: string): string => {
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
}

// Patterns to detect Claude Code interaction
const PATTERNS = {
  // User input prompt (Claude Code uses > or ❯)
  userPrompt: /^[❯>]\s*(.+)$/,

  // Message boundaries (Claude Code box drawing)
  messageStart: /^[╭┌]/,
  messageEnd: /^[╰└]/,
  messageContinue: /^[│┃]/,

  // Tool use patterns
  toolRead: /[⏺●]\s*Read\s*\((.+)\)/i,
  toolWrite: /[⏺●]\s*Write\s*\((.+)\)/i,
  toolEdit: /[⏺●]\s*Edit\s*\((.+)\)/i,
  toolBash: /[⏺●]\s*(?:Bash|Run|Execute)\s*[:\(]?\s*(.+)?/i,
  toolSearch: /[⏺●]\s*(?:Search|Grep|Glob)\s*\((.+)\)/i,
  toolAgent: /[⏺●]\s*(?:Task|Agent)\s*\((.+)\)/i,

  // Thinking block
  thinkingStart: /<thinking>/i,
  thinkingEnd: /<\/thinking>/i,

  // Code block
  codeBlock: /```(\w*)\n([\s\S]*?)```/g,

  // Status indicators
  success: /[✓✔]\s*(.+)/,
  error: /[✗✘❌]\s*(.+)/,
  spinner: /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/,

  // Claude Code specific patterns
  claudeHeader: /Claude Code|claude-code|anthropic/i,
  assistantMarker: /^(Claude|Assistant|AI)[\s:]/i,
}

interface ParserState {
  isClaudeSession: boolean
  isCapturing: boolean
  currentRole: 'user' | 'assistant' | null
  buffer: string
  toolBuffer: ToolUse[]
  thinkingBuffer: string
  isInThinking: boolean
  lastUserInput: string
}

export function createConversationParser() {
  const state: ParserState = {
    isClaudeSession: false,
    isCapturing: false,
    currentRole: null,
    buffer: '',
    toolBuffer: [],
    thinkingBuffer: '',
    isInThinking: false,
    lastUserInput: '',
  }

  const parseToolUse = (line: string): ToolUse | null => {
    const cleanLine = stripAnsi(line)

    let match = cleanLine.match(PATTERNS.toolRead)
    if (match) return { type: 'read', target: match[1].trim() }

    match = cleanLine.match(PATTERNS.toolWrite)
    if (match) return { type: 'write', target: match[1].trim() }

    match = cleanLine.match(PATTERNS.toolEdit)
    if (match) return { type: 'edit', target: match[1].trim() }

    match = cleanLine.match(PATTERNS.toolBash)
    if (match) return { type: 'bash', target: match[1]?.trim() || 'command' }

    match = cleanLine.match(PATTERNS.toolSearch)
    if (match) return { type: 'search', target: match[1].trim() }

    match = cleanLine.match(PATTERNS.toolAgent)
    if (match) return { type: 'unknown', target: match[1].trim() }

    return null
  }

  const flushBuffer = (): ParsedMessage | null => {
    if (!state.buffer.trim() && state.toolBuffer.length === 0) {
      return null
    }

    const message: ParsedMessage = {
      role: state.currentRole || 'assistant',
      content: state.buffer.trim(),
    }

    if (state.toolBuffer.length > 0) {
      message.toolUse = [...state.toolBuffer]
    }

    if (state.thinkingBuffer.trim()) {
      message.thinking = state.thinkingBuffer.trim()
    }

    // Reset buffers
    state.buffer = ''
    state.toolBuffer = []
    state.thinkingBuffer = ''

    return message
  }

  return {
    /**
     * Process incoming terminal data and extract conversation messages
     */
    processData(data: string): ParsedMessage[] {
      const newMessages: ParsedMessage[] = []
      const lines = data.split('\n')

      for (const line of lines) {
        const cleanLine = stripAnsi(line).trim()

        // Skip empty lines and spinner characters
        if (!cleanLine || PATTERNS.spinner.test(cleanLine)) {
          continue
        }

        // Detect Claude session start
        if (PATTERNS.claudeHeader.test(cleanLine)) {
          state.isClaudeSession = true
        }

        // Detect thinking block boundaries
        if (PATTERNS.thinkingStart.test(cleanLine)) {
          state.isInThinking = true
          continue
        }
        if (PATTERNS.thinkingEnd.test(cleanLine)) {
          state.isInThinking = false
          continue
        }
        if (state.isInThinking) {
          state.thinkingBuffer += cleanLine + '\n'
          continue
        }

        // Detect user input
        const userMatch = cleanLine.match(PATTERNS.userPrompt)
        if (userMatch && userMatch[1].trim()) {
          // Flush previous assistant message
          if (state.currentRole === 'assistant') {
            const msg = flushBuffer()
            if (msg && msg.content) {
              newMessages.push(msg)
            }
          }

          state.lastUserInput = userMatch[1].trim()
          state.currentRole = 'user'
          state.buffer = state.lastUserInput
          state.isCapturing = true

          // Immediately push user message
          newMessages.push({
            role: 'user',
            content: state.lastUserInput,
          })

          // Reset for assistant response
          state.currentRole = 'assistant'
          state.buffer = ''
          continue
        }

        // Detect tool use
        const tool = parseToolUse(cleanLine)
        if (tool) {
          state.toolBuffer.push(tool)
          state.isCapturing = true
          state.currentRole = 'assistant'
          continue
        }

        // Message boundaries
        if (PATTERNS.messageStart.test(cleanLine)) {
          // Flush previous message
          const msg = flushBuffer()
          if (msg && msg.content) {
            newMessages.push(msg)
          }
          state.currentRole = 'assistant'
          continue
        }

        if (PATTERNS.messageEnd.test(cleanLine)) {
          // End of message block
          const msg = flushBuffer()
          if (msg && msg.content) {
            newMessages.push(msg)
          }
          state.currentRole = null
          continue
        }

        // Continue capturing content
        if (state.isCapturing && state.currentRole === 'assistant') {
          // Remove box drawing characters from content
          let content = cleanLine
          if (PATTERNS.messageContinue.test(content)) {
            content = content.replace(/^[│┃]\s*/, '')
          }

          if (content) {
            state.buffer += (state.buffer ? '\n' : '') + content
          }
        }
      }

      return newMessages
    },

    /**
     * Flush remaining buffer as a message
     */
    flush(): ParsedMessage | null {
      return flushBuffer()
    },

    /**
     * Reset parser state
     */
    reset() {
      state.isClaudeSession = false
      state.isCapturing = false
      state.currentRole = null
      state.buffer = ''
      state.toolBuffer = []
      state.thinkingBuffer = ''
      state.isInThinking = false
      state.lastUserInput = ''
    },

    /**
     * Check if parser detected a Claude session
     */
    isClaudeSession(): boolean {
      return state.isClaudeSession
    },
  }
}

/**
 * Enhanced heuristic to detect if terminal output looks like Claude Code
 */
export function isClaudeCodeOutput(data: string): boolean {
  const cleanData = stripAnsi(data)

  const indicators = [
    /claude[\s-]?code/i,
    /anthropic/i,
    /[⏺●]\s*(?:Read|Write|Edit|Bash|Search|Glob|Grep)/i,
    /```[\w]*\n/,  // Code blocks
    /<thinking>/i,
    /[╭╰│]/,  // Box drawing characters
    /\bClaude\b/,
  ]

  // Count matches - require at least 2 indicators
  const matchCount = indicators.filter(pattern => pattern.test(cleanData)).length
  return matchCount >= 1
}

/**
 * Extract code blocks from content
 */
export function extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
  const blocks: Array<{ language: string; code: string }> = []
  const regex = /```(\w*)\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    })
  }

  return blocks
}

/**
 * Parse tool use from Claude output
 */
export function parseToolFromLine(line: string): ToolUse | null {
  const cleanLine = stripAnsi(line)

  const patterns: [RegExp, ToolUse['type']][] = [
    [/Read\s*\((.+)\)/i, 'read'],
    [/Write\s*\((.+)\)/i, 'write'],
    [/Edit\s*\((.+)\)/i, 'edit'],
    [/Bash\s*[:\(]?\s*(.+)?/i, 'bash'],
    [/(?:Search|Grep)\s*\((.+)\)/i, 'search'],
    [/Glob\s*\((.+)\)/i, 'glob'],
  ]

  for (const [pattern, type] of patterns) {
    const match = cleanLine.match(pattern)
    if (match) {
      return {
        type,
        target: match[1]?.trim() || '',
      }
    }
  }

  return null
}

/**
 * Format tool use for display
 */
export function formatToolUse(tool: ToolUse): { icon: string; label: string } {
  const icons: Record<ToolUse['type'], string> = {
    read: '📖',
    write: '✏️',
    edit: '📝',
    bash: '⚡',
    search: '🔍',
    glob: '📁',
    grep: '🔎',
    unknown: '🔧',
  }

  const labels: Record<ToolUse['type'], string> = {
    read: 'Reading',
    write: 'Writing',
    edit: 'Editing',
    bash: 'Running',
    search: 'Searching',
    glob: 'Finding files',
    grep: 'Searching content',
    unknown: 'Processing',
  }

  return {
    icon: icons[tool.type],
    label: `${labels[tool.type]} ${tool.target}`,
  }
}
