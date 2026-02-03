import { Conversation } from '../store/history'

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString()
}

export function toMarkdown(conversation: Conversation): string {
  const lines: string[] = []

  // Header
  lines.push(`# ${conversation.title}`)
  lines.push('')
  lines.push(`**Created:** ${formatDate(conversation.createdAt)}`)
  lines.push(`**Updated:** ${formatDate(conversation.updatedAt)}`)
  lines.push(`**Working Directory:** \`${conversation.cwd}\``)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Messages
  for (const msg of conversation.messages) {
    const role = msg.role === 'user' ? '## 👤 User' : '## 🤖 Claude'
    lines.push(role)
    lines.push(`*${formatDate(msg.timestamp)}*`)
    lines.push('')
    lines.push(msg.content)
    lines.push('')
    lines.push('---')
    lines.push('')
  }

  return lines.join('\n')
}

export function toJSON(conversation: Conversation): string {
  const exportData = {
    title: conversation.title,
    cwd: conversation.cwd,
    createdAt: new Date(conversation.createdAt).toISOString(),
    updatedAt: new Date(conversation.updatedAt).toISOString(),
    messages: conversation.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp).toISOString(),
    })),
  }

  return JSON.stringify(exportData, null, 2)
}

export function getExportFilename(conversation: Conversation, format: 'md' | 'json'): string {
  // Sanitize title for filename
  const sanitized = conversation.title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 50)

  const date = new Date(conversation.createdAt)
    .toISOString()
    .slice(0, 10)

  return `${sanitized}_${date}.${format}`
}
