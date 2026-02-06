import { useState, useRef, useEffect } from 'react'
import { useClaudeInfoStore } from '../store/claudeInfo'

interface ClaudeInfoBarProps {
  tabId: string
}

const MODEL_OPTIONS = [
  { label: 'Opus 4.5', value: 'opus' },
  { label: 'Sonnet 4.5', value: 'sonnet' },
  { label: 'Haiku 4.5', value: 'haiku' },
]

function formatModel(model: string): string {
  const m = model.match(/claude-(\w+)-([\d]+)-([\d]+)/)
  if (m) {
    const name = m[1].charAt(0).toUpperCase() + m[1].slice(1)
    return `${name} ${m[2]}.${m[3]}`
  }
  return model
}

export default function ClaudeInfoBar({ tabId }: ClaudeInfoBarProps) {
  const session = useClaudeInfoStore((s) => s.getSession(tabId))
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLSpanElement>(null)

  // Close on outside click or Escape
  useEffect(() => {
    if (!dropdownOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDropdownOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [dropdownOpen])

  // Don't render if no model or token data
  if (!session.model && !session.inputTokens) return null

  const contextPercent = session.contextMax > 0
    ? Math.min(100, (session.contextUsed / session.contextMax) * 100)
    : 0

  const handleModelSelect = (value: string) => {
    setDropdownOpen(false)
    window.dispatchEvent(new CustomEvent('write-to-pty', { detail: `/model ${value}\r` }))
  }

  return (
    <div className="claude-info-bar">
      {session.model && (
        <span
          ref={dropdownRef}
          className={`claude-info-model clickable${dropdownOpen ? ' active' : ''}`}
          title="Click to change model"
          onClick={() => setDropdownOpen(!dropdownOpen)}
        >
          {formatModel(session.model)}
          <span className="model-chevron">{dropdownOpen ? '\u25B4' : '\u25BE'}</span>
          {dropdownOpen && (
            <div className="model-dropdown">
              {MODEL_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className={`model-option${session.model.toLowerCase().includes(opt.value) ? ' current' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleModelSelect(opt.value)
                  }}
                >
                  {opt.label}
                </div>
              ))}
            </div>
          )}
        </span>
      )}
      {(session.inputTokens > 0 || session.outputTokens > 0) && (
        <span className="claude-info-tokens" title="Tokens (input / output)">
          <span className="token-in">{formatNum(session.inputTokens)}</span>
          <span className="token-sep">/</span>
          <span className="token-out">{formatNum(session.outputTokens)}</span>
        </span>
      )}
      {session.contextUsed > 0 && (
        <span className="claude-info-context" title={`Context: ${formatNum(session.contextUsed)} / ${formatNum(session.contextMax)}`}>
          <span className="context-label">{Math.round(contextPercent)}%</span>
          <span className="context-bar">
            <span className="context-fill" style={{ width: `${contextPercent}%` }} />
          </span>
        </span>
      )}
      {session.totalCost > 0 && (
        <span className="claude-info-cost" title="Session cost">
          ${session.totalCost.toFixed(4)}
        </span>
      )}
    </div>
  )
}

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}
