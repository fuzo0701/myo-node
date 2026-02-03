import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Message } from '../store/history'
import { formatDate } from '../utils/dateFormat'

interface ConversationViewProps {
  messages: Message[]
  isOpen: boolean
  onClose: () => void
}

export default function ConversationView({ messages, isOpen, onClose }: ConversationViewProps) {
  if (!isOpen) return null

  return (
    <div className="conversation-view">
      <div className="conversation-view-header">
        <h3>Conversation Detail</h3>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="conversation-view-content">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}

interface MessageBubbleProps {
  message: Message
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="message-header">
        <span className="message-author">{isUser ? 'You' : 'Claude'}</span>
        <span className="message-time">{formatDate(message.timestamp)}</span>
      </div>
      <div className="message-content">
        <ReactMarkdown
          components={{
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              const isInline = !match && !String(children).includes('\n')

              if (isInline) {
                return (
                  <code className="inline-code" {...props}>
                    {children}
                  </code>
                )
              }

              return (
                <div className="code-block-wrapper">
                  {match && <span className="code-language">{match[1]}</span>}
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match?.[1] || 'text'}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: '4px',
                      fontSize: '13px',
                    }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                  <button
                    className="copy-code-btn"
                    onClick={() => navigator.clipboard.writeText(String(children))}
                  >
                    Copy
                  </button>
                </div>
              )
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
