import { useState } from 'react'
import { Tab, ClaudeStatus } from '../store/tabs'

type SplitMode = 'none' | 'horizontal' | 'vertical'

interface TabBarProps {
  tabs: Tab[]
  activeTabId: string | null
  onAddTab: () => void
  onRemoveTab: (id: string) => void
  onSelectTab: (id: string) => void
  onReorderTabs: (fromIndex: number, toIndex: number) => void
  splitMode: SplitMode
  onSplitModeChange: (mode: SplitMode) => void
  onExplorerToggle: () => void
  explorerOpen: boolean
  onHistoryToggle: () => void
  historyOpen: boolean
  onSettingsToggle: () => void
  settingsOpen: boolean
  onClaudeSettingsToggle: () => void
  claudeSettingsOpen: boolean
  isDashboardActive?: boolean
}

// Claude status indicator colors
const getStatusColor = (status: ClaudeStatus): string | null => {
  switch (status) {
    case 'running':
      return '#3b82f6' // blue
    case 'loading':
      return '#eab308' // yellow
    case 'completed':
      return '#22c55e' // green
    default:
      return null
  }
}

// Refined SVG Icons
const Icons = {
  terminal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  home: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  explorer: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 3" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  ),
  splitHorizontal: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  ),
  splitVertical: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  ),
  settings: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  ),
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  close: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  claude: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 015 5v1h1a3 3 0 010 6h-1v1a5 5 0 01-10 0v-1H6a3 3 0 010-6h1V7a5 5 0 015-5z" />
      <circle cx="9.5" cy="10.5" r="1" fill="currentColor" />
      <circle cx="14.5" cy="10.5" r="1" fill="currentColor" />
      <path d="M9 14.5c.5.8 1.5 1.5 3 1.5s2.5-.7 3-1.5" />
    </svg>
  ),
}

export default function TabBar({
  tabs,
  activeTabId,
  onAddTab,
  onRemoveTab,
  onSelectTab,
  onReorderTabs,
  splitMode,
  onSplitModeChange,
  onExplorerToggle,
  explorerOpen,
  onHistoryToggle,
  historyOpen,
  onSettingsToggle,
  settingsOpen,
  onClaudeSettingsToggle,
  claudeSettingsOpen,
  isDashboardActive,
}: TabBarProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    // Add a slight delay to show the dragging style
    setTimeout(() => {
      const target = e.target as HTMLElement
      target.classList.add('dragging')
    }, 0)
  }

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.target as HTMLElement
    target.classList.remove('dragging')
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault()
    const fromIndex = draggedIndex
    if (fromIndex !== null && fromIndex !== toIndex) {
      onReorderTabs(fromIndex, toIndex)
    }
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="tab-bar">
      <div className="tabs">
        {tabs.map((tab, index) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${
              draggedIndex === index ? 'dragging' : ''
            } ${dragOverIndex === index ? 'drag-over' : ''} ${
              dragOverIndex !== null && draggedIndex !== null && draggedIndex < dragOverIndex && index === dragOverIndex
                ? 'drag-over-right'
                : ''
            } ${
              dragOverIndex !== null && draggedIndex !== null && draggedIndex > dragOverIndex && index === dragOverIndex
                ? 'drag-over-left'
                : ''
            }`}
            onClick={() => onSelectTab(tab.id)}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
          >
            <span className="tab-icon">{tab.isDashboard ? Icons.home : Icons.terminal}</span>
            <span className="tab-title">{tab.title}</span>
            {tab.claudeStatus !== 'idle' && (
              <span
                className="tab-status-indicator"
                style={{ backgroundColor: getStatusColor(tab.claudeStatus) || undefined }}
                title={`Claude: ${tab.claudeStatus}`}
              />
            )}
            {!tab.isDashboard && (
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation()
                  onRemoveTab(tab.id)
                }}
                aria-label="Close tab"
              >
                {Icons.close}
              </button>
            )}
          </div>
        ))}
        <button className="add-tab" onClick={(e) => { e.stopPropagation(); onAddTab(); }} aria-label="New tab">
          {Icons.plus}
        </button>
      </div>
      <div className="tab-actions">
        <button
          className={`action-btn icon-btn ${explorerOpen ? 'active' : ''}`}
          onClick={onExplorerToggle}
          title="File Explorer (Ctrl+B)"
          disabled={isDashboardActive}
        >
          {Icons.explorer}
        </button>
        <button
          className={`action-btn icon-btn ${historyOpen ? 'active' : ''}`}
          onClick={onHistoryToggle}
          title="Conversation History"
          disabled={isDashboardActive}
        >
          {Icons.history}
        </button>
        <button
          className={`action-btn icon-btn ${claudeSettingsOpen ? 'active' : ''}`}
          onClick={onClaudeSettingsToggle}
          title="Claude Code Settings (Ctrl+Shift+L)"
          disabled={isDashboardActive}
        >
          {Icons.claude}
        </button>
        <span className="action-divider" />
        <button
          className={`action-btn icon-btn ${splitMode === 'horizontal' ? 'active' : ''}`}
          onClick={() => onSplitModeChange(splitMode === 'horizontal' ? 'none' : 'horizontal')}
          title="Split horizontal"
          disabled={isDashboardActive}
        >
          {Icons.splitHorizontal}
        </button>
        <button
          className={`action-btn icon-btn ${splitMode === 'vertical' ? 'active' : ''}`}
          onClick={() => onSplitModeChange(splitMode === 'vertical' ? 'none' : 'vertical')}
          title="Split vertical"
          disabled={isDashboardActive}
        >
          {Icons.splitVertical}
        </button>
        <span className="action-divider" />
        <button
          className={`action-btn icon-btn ${settingsOpen ? 'active' : ''}`}
          onClick={onSettingsToggle}
          title="Settings"
          disabled={isDashboardActive}
        >
          {Icons.settings}
        </button>
      </div>
    </div>
  )
}
