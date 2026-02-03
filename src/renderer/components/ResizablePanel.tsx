import { useState, useRef, useCallback, useEffect, ReactNode } from 'react'

interface ResizablePanelProps {
  children: ReactNode
  side: 'left' | 'right'
  defaultWidth?: number
  defaultWidthPercent?: number // Percentage of parent container
  minWidth?: number
  maxWidth?: number
  isOpen: boolean
}

export default function ResizablePanel({
  children,
  side,
  defaultWidth,
  defaultWidthPercent,
  minWidth = 200,
  maxWidth = 600,
  isOpen,
}: ResizablePanelProps) {
  const [width, setWidth] = useState<number | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(0)

  // Calculate initial width based on percentage or fixed value
  useEffect(() => {
    if (width !== null) return // Already initialized

    if (defaultWidthPercent && panelRef.current?.parentElement) {
      const parentWidth = panelRef.current.parentElement.clientWidth
      const calculatedWidth = Math.round(parentWidth * (defaultWidthPercent / 100))
      setWidth(Math.max(minWidth, Math.min(maxWidth, calculatedWidth)))
    } else if (defaultWidth) {
      setWidth(defaultWidth)
    } else {
      setWidth(minWidth)
    }
  }, [defaultWidth, defaultWidthPercent, minWidth, maxWidth, width])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (width === null) return
    e.preventDefault()
    isDragging.current = true
    startX.current = e.clientX
    startWidth.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return

    const delta = side === 'left'
      ? e.clientX - startX.current
      : startX.current - e.clientX

    let newWidth = startWidth.current + delta
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    setWidth(newWidth)
  }, [side, minWidth, maxWidth])

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

  if (!isOpen) return null

  return (
    <div
      ref={panelRef}
      className={`resizable-panel resizable-panel-${side}`}
      style={{ width: width ?? defaultWidth ?? minWidth }}
    >
      <div className="resizable-panel-content">
        {children}
      </div>
      <div
        className={`resizable-handle resizable-handle-${side}`}
        onMouseDown={handleMouseDown}
      >
        <div className="resizable-handle-line" />
      </div>
    </div>
  )
}
