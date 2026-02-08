import { useEffect, useRef, memo, useMemo } from 'react'
import ClaudeRenderer from './ClaudeRenderer'
import { useThemeStore } from '../store/theme'
import { useSettingsStore } from '../store/settings'
import { ansiToHtml } from '../utils/ansiToHtml'

export interface OutputBlock {
  id: string
  type: 'command' | 'output' | 'claude' | 'system' | 'teammate'
  content: string
  timestamp: number
  isStreaming: boolean
  teammateName?: string  // teammate block: who produced the output
}

interface OutputAreaProps {
  blocks: OutputBlock[]
}

const OutputArea = memo(function OutputArea({ blocks }: OutputAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScroll = useSettingsStore((state) => state.autoScroll)
  const userScrolledUp = useRef(false)
  const isAutoScrolling = useRef(false)

  // Auto-scroll on new content
  useEffect(() => {
    if (autoScroll && !userScrolledUp.current && scrollRef.current) {
      const el = scrollRef.current
      isAutoScrolling.current = true
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
        // Clear the flag after the scroll event has fired
        requestAnimationFrame(() => {
          isAutoScrolling.current = false
        })
      })
    }
  }, [blocks, autoScroll])

  // Detect user scroll-up (ignore programmatic scrolls)
  const handleScroll = () => {
    if (!scrollRef.current || isAutoScrolling.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const distFromBottom = scrollHeight - scrollTop - clientHeight
    userScrolledUp.current = distFromBottom > 50
  }

  return (
    <div className="output-area" ref={scrollRef} onScroll={handleScroll}>
      {blocks.map((block) => (
        <MemoizedOutputBlock key={block.id} block={block} />
      ))}
    </div>
  )
})

export default OutputArea

const MemoizedOutputBlock = memo(function OutputBlock({ block }: { block: OutputBlock }) {
  switch (block.type) {
    case 'command':
      return <CommandBlock content={block.content} />
    case 'output':
      return <OutputBlockRenderer content={block.content} isStreaming={block.isStreaming} />
    case 'claude':
      return (
        <div className="output-block output-block-claude">
          <ClaudeRenderer content={block.content} isStreaming={block.isStreaming} />
        </div>
      )
    case 'teammate':
      return <TeammateBlock content={block.content} name={block.teammateName} isStreaming={block.isStreaming} />
    case 'system':
      return (
        <div className="output-block output-block-system">
          {block.content}
        </div>
      )
    default:
      return null
  }
})

const CommandBlock = memo(function CommandBlock({ content }: { content: string }) {
  return (
    <div className="output-block output-block-command">
      <span className="command-prompt-icon">&gt;</span>
      <span className="command-text">{content}</span>
    </div>
  )
})

const OutputBlockRenderer = memo(function OutputBlockRenderer({
  content,
  isStreaming,
}: {
  content: string
  isStreaming: boolean
}) {
  const theme = useThemeStore((state) => state.currentTheme)

  const html = useMemo(() => ansiToHtml(content, theme), [content, theme])

  return (
    <div className="output-block output-block-output">
      <pre dangerouslySetInnerHTML={{ __html: html }} />
      {isStreaming && <span className="streaming-indicator" />}
    </div>
  )
})

const TeammateBlock = memo(function TeammateBlock({
  content,
  name,
  isStreaming,
}: {
  content: string
  name?: string
  isStreaming: boolean
}) {
  const theme = useThemeStore((state) => state.currentTheme)
  const html = useMemo(() => ansiToHtml(content, theme), [content, theme])

  return (
    <div className="output-block output-block-teammate">
      {name && <div className="teammate-block-header">🤖 {name}</div>}
      <pre dangerouslySetInnerHTML={{ __html: html }} />
      {isStreaming && <span className="streaming-indicator" />}
    </div>
  )
})
