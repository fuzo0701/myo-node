import { useState } from 'react'
import { useHistoryStore, Conversation } from '../store/history'
import { formatDistanceToNow } from '../utils/dateFormat'

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
  } = useHistoryStore()

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const conversations = getFilteredConversations()

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
  searchQuery: string
}

function ConversationItem({
  conversation,
  isActive,
  isExpanded,
  onSelect,
  onExpand,
  onDelete,
  searchQuery,
}: ConversationItemProps) {
  const messageCount = conversation.messages.length
  const lastMessage = conversation.messages[conversation.messages.length - 1]

  return (
    <div className={`conversation-item ${isActive ? 'active' : ''}`}>
      <div className="conversation-header" onClick={onSelect}>
        <div className="conversation-info">
          <span className="conversation-title">{conversation.title}</span>
          <span className="conversation-meta">
            {messageCount} messages · {formatDistanceToNow(conversation.updatedAt)}
          </span>
        </div>
        <div className="conversation-actions">
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
          <button
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            aria-label="Delete"
          >
            🗑
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="conversation-preview">
          {conversation.messages.slice(0, 5).map((msg) => (
            <div key={msg.id} className={`preview-message ${msg.role}`}>
              <span className="message-role">{msg.role === 'user' ? 'You' : 'Claude'}:</span>
              <span className="message-preview">
                {highlightSearch(truncate(msg.content, 100), searchQuery)}
              </span>
            </div>
          ))}
          {messageCount > 5 && (
            <div className="preview-more">+{messageCount - 5} more messages</div>
          )}
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
