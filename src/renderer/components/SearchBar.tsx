import { useState, useEffect, useRef, useCallback } from 'react'

interface SearchBarProps {
  isOpen: boolean
  onClose: () => void
  onSearchChange: (term: string) => void
  onFindNext: () => void
  onFindPrev: () => void
  matchInfo?: { current: number; total: number }
}

export default function SearchBar({ isOpen, onClose, onSearchChange, onFindNext, onFindPrev, matchInfo }: SearchBarProps) {
  const [term, setTerm] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setTerm('')
    }
  }, [isOpen])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Stop propagation to prevent xterm from capturing keys
    e.stopPropagation()

    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        onFindPrev()
      } else {
        onFindNext()
      }
    }
  }, [onClose, onFindNext, onFindPrev])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTerm(val)
    onSearchChange(val)
  }, [onSearchChange])

  if (!isOpen) return null

  const matchText = matchInfo
    ? matchInfo.total > 0
      ? `${matchInfo.current}/${matchInfo.total}`
      : term ? 'No results' : ''
    : ''

  return (
    <div className="search-bar" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        className="search-bar-input"
        type="text"
        value={term}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Search..."
        spellCheck={false}
      />
      {matchText && <span className="search-bar-info">{matchText}</span>}
      <button className="search-bar-btn" onClick={onFindPrev} title="Previous (Shift+Enter)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 15 12 9 6 15" /></svg>
      </button>
      <button className="search-bar-btn" onClick={onFindNext} title="Next (Enter)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      <button className="search-bar-btn" onClick={onClose} title="Close (Escape)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
      </button>
    </div>
  )
}
