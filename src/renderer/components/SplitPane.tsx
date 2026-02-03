import { useState, useRef, useCallback, useEffect, ReactNode } from 'react'

interface SplitPaneProps {
  direction: 'horizontal' | 'vertical'
  children: [ReactNode, ReactNode]
  defaultSplit?: number // 0-100 percentage
  minSize?: number // minimum size in pixels
}

export default function SplitPane({
  direction,
  children,
  defaultSplit = 50,
  minSize = 100,
}: SplitPaneProps) {
  const [splitPercent, setSplitPercent] = useState(defaultSplit)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
  }, [direction])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()

    let newPercent: number
    if (direction === 'horizontal') {
      const x = e.clientX - rect.left
      newPercent = (x / rect.width) * 100
    } else {
      const y = e.clientY - rect.top
      newPercent = (y / rect.height) * 100
    }

    // Enforce minimum sizes
    const containerSize = direction === 'horizontal' ? rect.width : rect.height
    const minPercent = (minSize / containerSize) * 100
    const maxPercent = 100 - minPercent

    newPercent = Math.max(minPercent, Math.min(maxPercent, newPercent))
    setSplitPercent(newPercent)
  }, [direction, minSize])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      ref={containerRef}
      className={`split-pane ${direction}`}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
      }}
    >
      <div
        className="split-pane-first"
        style={{
          [isHorizontal ? 'width' : 'height']: `${splitPercent}%`,
          [isHorizontal ? 'height' : 'width']: '100%',
          overflow: 'hidden',
        }}
      >
        {children[0]}
      </div>
      <div
        className="split-resizer"
        onMouseDown={handleMouseDown}
        style={{
          [isHorizontal ? 'width' : 'height']: '6px',
          [isHorizontal ? 'height' : 'width']: '100%',
          background: 'var(--border)',
          cursor: isHorizontal ? 'col-resize' : 'row-resize',
          flexShrink: 0,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          className="split-resizer-line"
          style={{
            position: 'absolute',
            [isHorizontal ? 'left' : 'top']: '50%',
            [isHorizontal ? 'top' : 'left']: '50%',
            transform: 'translate(-50%, -50%)',
            [isHorizontal ? 'width' : 'height']: '2px',
            [isHorizontal ? 'height' : 'width']: '40px',
            background: 'var(--text-muted)',
            borderRadius: '1px',
            opacity: 0.5,
          }}
        />
      </div>
      <div
        className="split-pane-second"
        style={{
          flex: 1,
          overflow: 'hidden',
        }}
      >
        {children[1]}
      </div>
    </div>
  )
}
