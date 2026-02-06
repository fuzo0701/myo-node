import { useEffect, useRef, memo, useMemo } from 'react'
import ClaudeRenderer from './ClaudeRenderer'
import { useThemeStore } from '../store/theme'
import { useSettingsStore } from '../store/settings'
import { ansiToHtml } from '../utils/ansiToHtml'

export interface OutputBlock {
  id: string
  type: 'command' | 'output' | 'claude' | 'system'
  content: string
  timestamp: number
  isStreaming: boolean
}

interface OutputAreaProps {
  blocks: OutputBlock[]
}

const OutputArea = memo(function OutputArea({ blocks }: OutputAreaProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScroll = useSettingsStore((state) => state.autoScroll)
  const userScrolledUp = useRef(false)

  // Auto-scroll on new content
  // Use rAF to ensure DOM has laid out new content before scrolling
  useEffect(() => {
    if (autoScroll && !userScrolledUp.current && scrollRef.current) {
      const el = scrollRef.current
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [blocks, autoScroll])

  // Detect user scroll-up
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    userScrolledUp.current = scrollHeight - scrollTop - clientHeight > 50
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
