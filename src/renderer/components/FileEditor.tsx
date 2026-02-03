import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'

interface FileEditorProps {
  isOpen: boolean
  filePath: string | null
  onClose: () => void
}

// SVG Icons
const Icons = {
  close: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  save: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  ),
  file: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  edit: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  preview: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
}

// Check if file is markdown
function isMarkdownFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase()
  return ext === 'md' || ext === 'markdown'
}

// Get language from file extension
function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'TypeScript',
    tsx: 'TypeScript React',
    js: 'JavaScript',
    jsx: 'JavaScript React',
    json: 'JSON',
    css: 'CSS',
    scss: 'SCSS',
    html: 'HTML',
    md: 'Markdown',
    py: 'Python',
    go: 'Go',
    rs: 'Rust',
    vue: 'Vue',
    yaml: 'YAML',
    yml: 'YAML',
    toml: 'TOML',
    sh: 'Shell',
    bash: 'Bash',
    txt: 'Text',
  }
  return langMap[ext || ''] || 'Plain Text'
}

// Get file name from path
function getFileName(filePath: string): string {
  return filePath.split(/[/\\]/).pop() || filePath
}

export default function FileEditor({ isOpen, filePath, onClose }: FileEditorProps) {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isModified = content !== originalContent
  const isMarkdown = filePath ? isMarkdownFile(filePath) : false

  // Load file content
  useEffect(() => {
    if (!isOpen || !filePath) {
      setContent('')
      setOriginalContent('')
      setError(null)
      setIsEditMode(false)
      return
    }

    // Reset edit mode for new file (show preview for markdown)
    setIsEditMode(false)

    const loadFile = async () => {
      setLoading(true)
      setError(null)
      try {
        const fileContent = await window.fileSystem?.readFile(filePath)
        if (fileContent !== null && fileContent !== undefined) {
          setContent(fileContent)
          setOriginalContent(fileContent)
        } else {
          setError('Failed to load file (binary or unsupported format)')
        }
      } catch (err) {
        setError(`Error: ${err}`)
      } finally {
        setLoading(false)
      }
    }

    loadFile()
  }, [isOpen, filePath])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!filePath || !isModified) return

    setSaving(true)
    try {
      const success = await window.fileSystem?.writeFile(filePath, content)
      if (success) {
        setOriginalContent(content)
      } else {
        setError('Failed to save file')
      }
    } catch (err) {
      setError(`Save error: ${err}`)
    } finally {
      setSaving(false)
    }
  }, [filePath, content, isModified])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleSave])

  // Handle tab key in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const textarea = e.currentTarget
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newContent = content.substring(0, start) + '  ' + content.substring(end)
      setContent(newContent)
      // Set cursor position after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  if (!isOpen) return null

  return (
    <div className="file-editor">
      <div className="file-editor-header">
        <div className="file-editor-title">
          <span className="file-icon">{Icons.file}</span>
          <span className="file-name">
            {filePath ? getFileName(filePath) : 'No file selected'}
            {isModified && <span className="modified-indicator">*</span>}
          </span>
          {filePath && (
            <span className="file-language">{getLanguage(filePath)}</span>
          )}
        </div>
        <div className="file-editor-actions">
          {isMarkdown && (
            <button
              className={`editor-action-btn ${isEditMode ? '' : 'active'}`}
              onClick={() => setIsEditMode(!isEditMode)}
              title={isEditMode ? 'Preview' : 'Edit'}
            >
              {isEditMode ? Icons.preview : Icons.edit}
              <span>{isEditMode ? 'Preview' : 'Edit'}</span>
            </button>
          )}
          <button
            className={`editor-action-btn ${isModified ? 'can-save' : ''}`}
            onClick={handleSave}
            disabled={!isModified || saving}
            title="Save (Ctrl+S)"
          >
            {Icons.save}
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
          <button
            className="editor-action-btn close-btn"
            onClick={onClose}
            title="Close"
          >
            {Icons.close}
          </button>
        </div>
      </div>
      {filePath && (
        <div className="file-editor-path">
          {filePath}
        </div>
      )}
      <div className="file-editor-content">
        {loading ? (
          <div className="editor-loading">Loading...</div>
        ) : error ? (
          <div className="editor-error">{error}</div>
        ) : !filePath ? (
          <div className="editor-empty">
            <div className="empty-icon">{Icons.file}</div>
            <div className="empty-text">Select a file from the explorer to edit</div>
          </div>
        ) : isMarkdown && !isEditMode ? (
          <div className="markdown-preview">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="editor-wrapper">
            <div className="line-numbers">
              {(content || '').split('\n').map((_, i) => (
                <div key={i} className="line-number">{i + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              placeholder="File content..."
            />
          </div>
        )}
      </div>
    </div>
  )
}
