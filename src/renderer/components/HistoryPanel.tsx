import { useState } from 'react'
import { useHistoryStore, Conversation } from '../store/history'
import { formatDistanceToNow } from '../utils/dateFormat'
import { toMarkdown, toJSON, getExportFilename } from '../utils/exportConversation'

interface HistoryPanelProps {
  isOpen: boolean
  onClose: () => void
  onSelectConversation: (id: string) => void
}

export default function HistoryPanel({ isOpen, onClose, onSelectConversation }: HistoryPanelProps) {
  const {
    searchQuery,
    setSearchQuery,
    getFilteredConversations,
    deleteConversation,
    clearAllConversations,
    activeConversationId,
    setActiveConversation,
    filterMode,
    setFilterMode,
    tagFilter,
    setTagFilter,
    toggleFavorite,
    addTag,
    removeTag,
    getAllTags,
  } = useHistoryStore()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const conversations = getFilteredConversations()
  const allTags = getAllTags()

  const handleExport = async (conv: Conversation, format: 'md' | 'json') => {
    const content = format === 'md' ? toMarkdown(conv) : toJSON(conv)
    const defaultFilename = getExportFilename(conv, format)

    const filePath = await window.dialog.saveFile({
      title: `Export Conversation as ${format === 'md' ? 'Markdown' : 'JSON'}`,
      defaultPath: defaultFilename,
      filters: format === 'md'
        ? [{ name: 'Markdown', extensions: ['md'] }]
        : [{ name: 'JSON', extensions: ['json'] }],
    })

    if (filePath) {
      const success = await window.fileSystem.writeFile(filePath, content)
      if (!success) {
        alert('Failed to export conversation')
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="history-panel">
      <div className="history-header">
        <h2>Conversation History</h2>
        <div className="history-header-actions">
          {conversations.length > 0 && (
            <button
              className="clear-all-btn"
              onClick={() => {
                if (confirm('Delete all conversations?')) {
                  clearAllConversations()
                }
              }}
              aria-label="Clear all"
              title="Clear all conversations"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          )}
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
      </div>

      <div className="history-search">
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery('')}>
            ×
          </button>
        )}
      </div>

      <div className="history-filters">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All
          </button>
          <button
            className={`filter-tab ${filterMode === 'favorites' ? 'active' : ''}`}
            onClick={() => setFilterMode('favorites')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={filterMode === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Favorites
          </button>
        </div>
        {allTags.length > 0 && (
          <div className="tag-filter-dropdown">
            <button
              className={`tag-filter-btn ${tagFilter ? 'active' : ''}`}
              onClick={() => setShowTagDropdown(!showTagDropdown)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
              </svg>
              {tagFilter || 'Tags'}
              {tagFilter && (
                <span
                  className="tag-clear"
                  onClick={(e) => {
                    e.stopPropagation()
                    setTagFilter(null)
                    setShowTagDropdown(false)
                  }}
                >
                  ×
                </span>
              )}
            </button>
            {showTagDropdown && (
              <div className="tag-dropdown-menu">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    className={`tag-option ${tagFilter === tag ? 'selected' : ''}`}
                    onClick={() => {
                      setTagFilter(tag)
                      setShowTagDropdown(false)
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="history-list">
        {conversations.length === 0 ? (
          <div className="history-empty">
            {searchQuery ? 'No matching conversations' : 'No conversations yet'}
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === activeConversationId}
              isExpanded={conv.id === expandedId}
              onSelect={() => {
                setActiveConversation(conv.id)
                onSelectConversation(conv.id)
              }}
              onExpand={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
              onDelete={() => deleteConversation(conv.id)}
              onExport={(format) => handleExport(conv, format)}
              onToggleFavorite={() => toggleFavorite(conv.id)}
              onAddTag={(tag) => addTag(conv.id, tag)}
              onRemoveTag={(tag) => removeTag(conv.id, tag)}
              searchQuery={searchQuery}
            />
          ))
        )}
      </div>
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isActive: boolean
  isExpanded: boolean
  onSelect: () => void
  onExpand: () => void
  onDelete: () => void
  onExport: (format: 'md' | 'json') => void
  onToggleFavorite: () => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  searchQuery: string
}

function ConversationItem({
  conversation,
  isActive,
  isExpanded,
  onSelect,
  onExpand,
  onDelete,
  onExport,
  onToggleFavorite,
  onAddTag,
  onRemoveTag,
  searchQuery,
}: ConversationItemProps) {
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [newTag, setNewTag] = useState('')
  const messageCount = conversation.messages.length

  const handleAddTag = () => {
    if (newTag.trim()) {
      onAddTag(newTag.trim())
      setNewTag('')
      setShowTagInput(false)
    }
  }

  return (
    <div className={`conversation-item ${isActive ? 'active' : ''}`}>
      <div className="conversation-header" onClick={onSelect}>
        <div className="conversation-info">
          <div className="conversation-title-row">
            <button
              className={`favorite-btn ${conversation.favorite ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFavorite()
              }}
              aria-label={conversation.favorite ? 'Remove from favorites' : 'Add to favorites'}
              title={conversation.favorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={conversation.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
            <span className="conversation-title">{conversation.title}</span>
          </div>
          <span className="conversation-meta">
            {messageCount} messages · {formatDistanceToNow(conversation.updatedAt)}
          </span>
          {conversation.tags && conversation.tags.length > 0 && (
            <div className="conversation-tags">
              {conversation.tags.map((tag) => (
                <span key={tag} className="tag">
                  #{tag}
                  <button
                    className="tag-remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveTag(tag)
                    }}
                    aria-label={`Remove tag ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="conversation-actions">
          <button
            className="add-tag-btn"
            onClick={(e) => {
              e.stopPropagation()
              setShowTagInput(!showTagInput)
            }}
            aria-label="Add tag"
            title="Add tag"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
              <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
          </button>
          <button
            className="expand-btn"
            onClick={(e) => {
              e.stopPropagation()
              onExpand()
            }}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <div className="export-dropdown">
            <button
              className="export-btn"
              onClick={(e) => {
                e.stopPropagation()
                setShowExportMenu(!showExportMenu)
              }}
              aria-label="Export"
              title="Export conversation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="export-menu" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => {
                    onExport('md')
                    setShowExportMenu(false)
                  }}
                >
                  Markdown (.md)
                </button>
                <button
                  onClick={() => {
                    onExport('json')
                    setShowExportMenu(false)
                  }}
                >
                  JSON (.json)
                </button>
              </div>
            )}
          </div>
          <button
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>
        </div>
      </div>

      {showTagInput && (
        <div className="tag-input-row" onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            placeholder="Add tag..."
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddTag()
              if (e.key === 'Escape') {
                setShowTagInput(false)
                setNewTag('')
              }
            }}
            autoFocus
            className="tag-input"
          />
          <button className="tag-add-btn" onClick={handleAddTag}>
            Add
          </button>
        </div>
      )}

      {isExpanded && (
        <div className="conversation-preview">
          <div className="preview-header">
            <span className="preview-count">{messageCount} items</span>
            <button
              className="copy-all-btn"
              onClick={(e) => {
                e.stopPropagation()
                const text = conversation.messages.map((m) => m.content).join('\n')
                navigator.clipboard.writeText(text)
              }}
              title="Copy all"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </button>
          </div>
          <ul className="message-list">
            {conversation.messages.map((msg) => (
              <li key={msg.id} className="message-item">
                {highlightSearch(truncate(msg.content, 150), searchQuery)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function truncate(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return cleaned.slice(0, maxLength) + '...'
}

function highlightSearch(text: string, query: string): React.ReactNode {
  if (!query) return text

  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i}>{part}</mark>
    ) : (
      part
    )
  )
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
