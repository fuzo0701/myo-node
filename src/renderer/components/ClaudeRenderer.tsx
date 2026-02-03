import { useMemo, memo, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface ClaudeRendererProps {
  content: string
  isStreaming?: boolean
}

// Memoized renderer to prevent unnecessary re-renders
const ClaudeRenderer = memo(function ClaudeRenderer({ content, isStreaming }: ClaudeRendererProps) {
  const segments = useMemo(() => parseClaudeOutput(content), [content])

  return (
    <div className="claude-renderer">
      {segments.map((segment, index) => (
        <MemoizedSegmentRenderer key={`${segment.type}-${index}`} segment={segment} />
      ))}
      {isStreaming && <span className="streaming-cursor">▊</span>}
    </div>
  )
})

export default ClaudeRenderer

type SegmentType =
  | 'text'
  | 'thinking'
  | 'tool-use'
  | 'tool-result'
  | 'code-block'
  | 'diff'
  | 'error'
  | 'success'

interface Segment {
  type: SegmentType
  content: string
  meta?: {
    language?: string
    toolName?: string
    filePath?: string
    status?: 'running' | 'done' | 'error'
  }
}

// Pre-compiled regex patterns for better performance
const PATTERNS = {
  thinking: /^<thinking>([\s\S]*?)<\/thinking>/m,
  codeBlock: /^```(\w*)\n([\s\S]*?)```/m,
  error: /^(Error|ERROR|Failed|FAILED)[:\s](.+?)(?:\n|$)/m,
  success: /^(Success|SUCCESS|Done|DONE|✓|✔)[:\s]?(.+?)(?:\n|$)/m,
  nextSpecial: /```|<thinking>|^(Reading|Writing|Running|Searching|Error|Success)/m,
  toolPatterns: [
    { pattern: /^(Reading|Read) (?:file[s]? )?["']?([^"'\n]+)["']?\.{0,3}/m, tool: 'read' },
    { pattern: /^(Writing|Wrote|Edit|Editing) (?:to )?["']?([^"'\n]+)["']?\.{0,3}/m, tool: 'write' },
    { pattern: /^(Searching|Search|Grep) (?:for )?["']?([^"'\n]+)["']?\.{0,3}/m, tool: 'search' },
    { pattern: /^(Running|Run|Executing|Bash)[:\s]+(.+)$/m, tool: 'bash' },
    { pattern: /^(Creating|Created) ["']?([^"'\n]+)["']?\.{0,3}/m, tool: 'create' },
  ] as const,
}

function parseClaudeOutput(content: string): Segment[] {
  const segments: Segment[] = []
  let remaining = content

  while (remaining.length > 0) {
    // Check for thinking blocks
    const thinkingMatch = remaining.match(PATTERNS.thinking)
    if (thinkingMatch) {
      segments.push({ type: 'thinking', content: thinkingMatch[1].trim() })
      remaining = remaining.slice(thinkingMatch[0].length)
      continue
    }

    // Check for tool use patterns
    let toolMatched = false
    for (const { pattern, tool } of PATTERNS.toolPatterns) {
      const match = remaining.match(pattern)
      if (match) {
        segments.push({
          type: 'tool-use',
          content: match[0],
          meta: { toolName: tool, filePath: match[2] },
        })
        remaining = remaining.slice(match[0].length)
        toolMatched = true
        break
      }
    }
    if (toolMatched) continue

    // Check for code blocks
    const codeMatch = remaining.match(PATTERNS.codeBlock)
    if (codeMatch) {
      const language = codeMatch[1] || 'text'
      const code = codeMatch[2]

      // Check if it's a diff
      if (language === 'diff' || code.includes('@@') && (code.includes('+') || code.includes('-'))) {
        segments.push({ type: 'diff', content: code, meta: { language: 'diff' } })
      } else {
        segments.push({ type: 'code-block', content: code, meta: { language } })
      }
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Check for error messages
    const errorMatch = remaining.match(PATTERNS.error)
    if (errorMatch) {
      segments.push({ type: 'error', content: errorMatch[0].trim() })
      remaining = remaining.slice(errorMatch[0].length)
      continue
    }

    // Check for success messages
    const successMatch = remaining.match(PATTERNS.success)
    if (successMatch) {
      segments.push({ type: 'success', content: successMatch[0].trim() })
      remaining = remaining.slice(successMatch[0].length)
      continue
    }

    // Regular text - take until next special pattern or newline
    const nextSpecial = remaining.search(PATTERNS.nextSpecial)
    if (nextSpecial > 0) {
      segments.push({ type: 'text', content: remaining.slice(0, nextSpecial) })
      remaining = remaining.slice(nextSpecial)
    } else if (nextSpecial === -1) {
      segments.push({ type: 'text', content: remaining })
      remaining = ''
    } else {
      // nextSpecial === 0 but no pattern matched, take one character
      const lineEnd = remaining.indexOf('\n')
      const chunk = lineEnd > 0 ? remaining.slice(0, lineEnd + 1) : remaining
      segments.push({ type: 'text', content: chunk })
      remaining = remaining.slice(chunk.length)
    }
  }

  return segments
}

// Memoized segment renderer to prevent unnecessary re-renders
const MemoizedSegmentRenderer = memo(function SegmentRenderer({ segment }: { segment: Segment }) {
  switch (segment.type) {
    case 'thinking':
      return <ThinkingBlock content={segment.content} />

    case 'tool-use':
      return <ToolUseBlock segment={segment} />

    case 'code-block':
      return <CodeBlock content={segment.content} language={segment.meta?.language} />

    case 'diff':
      return <DiffBlock content={segment.content} />

    case 'error':
      return (
        <div className="message-error">
          <span className="error-icon">✗</span>
          {segment.content}
        </div>
      )

    case 'success':
      return (
        <div className="message-success">
          <span className="success-icon">✓</span>
          {segment.content}
        </div>
      )

    case 'text':
    default:
      return <TextBlock content={segment.content} />
  }
})

// Memoized sub-components
const ThinkingBlock = memo(function ThinkingBlock({ content }: { content: string }) {
  return (
    <details className="thinking-block">
      <summary>
        <span className="thinking-icon">💭</span>
        Thinking...
      </summary>
      <div className="thinking-content">{content}</div>
    </details>
  )
})

const ToolUseBlock = memo(function ToolUseBlock({ segment }: { segment: Segment }) {
  return (
    <div className={`tool-use tool-${segment.meta?.toolName}`}>
      <span className="tool-icon">{getToolIcon(segment.meta?.toolName)}</span>
      <span className="tool-action">{segment.content}</span>
      {segment.meta?.status === 'running' && <span className="tool-spinner">⟳</span>}
    </div>
  )
})

const CodeBlock = memo(function CodeBlock({ content, language }: { content: string; language?: string }) {
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(content)
  }, [content])

  return (
    <div className="code-block-container">
      <div className="code-header">
        <span className="code-language">{language}</span>
        <button className="copy-btn" onClick={handleCopy}>
          Copy
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          borderRadius: '0 0 6px 6px',
          fontSize: '13px',
        }}
      >
        {content.trim()}
      </SyntaxHighlighter>
    </div>
  )
})

const DiffBlock = memo(function DiffBlock({ content }: { content: string }) {
  return (
    <div className="diff-container">
      <div className="diff-header">
        <span className="diff-icon">±</span>
        Changes
      </div>
      <DiffRenderer content={content} />
    </div>
  )
})

const TextBlock = memo(function TextBlock({ content }: { content: string }) {
  return (
    <div className="claude-text">
      <ReactMarkdown
        components={{
          code({ className, children, ...props }) {
            const isInline = !String(children).includes('\n')
            if (isInline) {
              return <code className="inline-code" {...props}>{children}</code>
            }
            return <code {...props}>{children}</code>
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="claude-link">
                {children}
              </a>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
})

const DiffRenderer = memo(function DiffRenderer({ content }: { content: string }) {
  const lines = useMemo(() => content.split('\n'), [content])

  return (
    <div className="diff-content">
      {lines.map((line, i) => {
        let className = 'diff-line'
        if (line.startsWith('+') && !line.startsWith('+++')) {
          className += ' diff-add'
        } else if (line.startsWith('-') && !line.startsWith('---')) {
          className += ' diff-remove'
        } else if (line.startsWith('@@')) {
          className += ' diff-info'
        }
        return (
          <div key={i} className={className}>
            <span className="diff-line-number">{i + 1}</span>
            <span className="diff-line-content">{line}</span>
          </div>
        )
      })}
    </div>
  )
})

function getToolIcon(toolName?: string): string {
  switch (toolName) {
    case 'read': return '📖'
    case 'write': return '✏️'
    case 'search': return '🔍'
    case 'bash': return '⚡'
    case 'create': return '📄'
    default: return '🔧'
  }
}
