import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import mermaid from 'mermaid'
import SearchBar from './SearchBar'
import { highlightMatches, clearHighlights, activateMatch } from '../utils/domSearch'

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'var(--font-family)',
})

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

// Check if file is an image
function isImageFile(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase()
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico']
  return imageExts.includes(ext || '')
}

// Mermaid render queue to prevent concurrent rendering conflicts
let mermaidIdCounter = 0
let mermaidRenderQueue: Promise<void> = Promise.resolve()

// Mermaid code block component
function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${++mermaidIdCounter}`

    // Queue renders sequentially to avoid conflicts
    mermaidRenderQueue = mermaidRenderQueue.then(async () => {
      if (cancelled) return
      try {
        const { svg } = await mermaid.render(id, code)
        if (!cancelled) {
          setSvg(svg)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setError(`Mermaid error: ${err}`)
          setSvg('')
        }
      }
      // Clean up temp element mermaid leaves behind
      const temp = document.getElementById('d' + id)
      temp?.remove()
    })

    return () => { cancelled = true }
  }, [code])

  if (error) {
    return <pre className="mermaid-error">{error}</pre>
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
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
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const markdownPreviewRef = useRef<HTMLDivElement>(null)

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchMatchInfo, setSearchMatchInfo] = useState<{ current: number; total: number }>({ current: 0, total: 0 })
  const searchTermRef = useRef('')
  const searchIndexRef = useRef(0)

  const isModified = content !== originalContent
  const isMarkdown = filePath ? isMarkdownFile(filePath) : false
  const isImage = filePath ? isImageFile(filePath) : false

  // Load file content
  useEffect(() => {
    if (!isOpen || !filePath) {
      setContent('')
      setOriginalContent('')
      setError(null)
      setIsEditMode(false)
      setImageDataUrl(null)
      return
    }

    // Reset edit mode for new file (show preview for markdown)
    setIsEditMode(false)

    // Handle image files
    if (isImageFile(filePath)) {
      setLoading(true)
      setError(null)
      const loadImage = async () => {
        try {
          const dataUrl = await window.fileSystem?.readFileBase64(filePath)
          if (dataUrl) {
            setImageDataUrl(dataUrl)
          } else {
            setError('Failed to load image')
          }
        } catch (err) {
          setError(`Error loading image: ${err}`)
        } finally {
          setLoading(false)
        }
      }
      loadImage()
      setContent('')
      setOriginalContent('')
      return
    }

    setImageDataUrl(null)

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

  // === Search handlers ===
  const handleSearchChange = useCallback((term: string) => {
    searchTermRef.current = term
    searchIndexRef.current = 0

    if (isMarkdown && !isEditMode) {
      // DOM search on markdown preview
      const container = markdownPreviewRef.current
      if (!container) { setSearchMatchInfo({ current: 0, total: 0 }); return }
      const total = highlightMatches(container, term)
      if (total > 0) {
        searchIndexRef.current = 1
        activateMatch(container, 0)
      }
      setSearchMatchInfo({ current: total > 0 ? 1 : 0, total })
    } else {
      // String search on textarea content
      if (!term) { setSearchMatchInfo({ current: 0, total: 0 }); return }
      const lowerContent = content.toLowerCase()
      const lowerTerm = term.toLowerCase()
      let count = 0
      let pos = 0
      while ((pos = lowerContent.indexOf(lowerTerm, pos)) !== -1) {
        count++
        pos += lowerTerm.length
      }
      if (count > 0) {
        searchIndexRef.current = 1
        // Select first match in textarea
        const firstIdx = lowerContent.indexOf(lowerTerm)
        if (firstIdx !== -1 && textareaRef.current) {
          textareaRef.current.setSelectionRange(firstIdx, firstIdx + term.length)
          textareaRef.current.focus()
        }
      }
      setSearchMatchInfo({ current: count > 0 ? 1 : 0, total: count })
    }
  }, [content, isMarkdown, isEditMode])

  const handleFindNext = useCallback(() => {
    const term = searchTermRef.current
    if (!term) return

    if (isMarkdown && !isEditMode) {
      const container = markdownPreviewRef.current
      if (!container) return
      const marks = container.querySelectorAll('mark.search-highlight')
      if (marks.length === 0) return
      let idx = searchIndexRef.current
      idx = idx >= marks.length ? 1 : idx + 1
      searchIndexRef.current = idx
      activateMatch(container, idx - 1)
      setSearchMatchInfo({ current: idx, total: marks.length })
    } else {
      // Navigate textarea matches
      const lowerContent = content.toLowerCase()
      const lowerTerm = term.toLowerCase()
      const positions: number[] = []
      let pos = 0
      while ((pos = lowerContent.indexOf(lowerTerm, pos)) !== -1) {
        positions.push(pos)
        pos += lowerTerm.length
      }
      if (positions.length === 0) return
      let idx = searchIndexRef.current
      idx = idx >= positions.length ? 1 : idx + 1
      searchIndexRef.current = idx
      const matchPos = positions[idx - 1]
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(matchPos, matchPos + term.length)
        textareaRef.current.focus()
      }
      setSearchMatchInfo({ current: idx, total: positions.length })
    }
  }, [content, isMarkdown, isEditMode])

  const handleFindPrev = useCallback(() => {
    const term = searchTermRef.current
    if (!term) return

    if (isMarkdown && !isEditMode) {
      const container = markdownPreviewRef.current
      if (!container) return
      const marks = container.querySelectorAll('mark.search-highlight')
      if (marks.length === 0) return
      let idx = searchIndexRef.current
      idx = idx <= 1 ? marks.length : idx - 1
      searchIndexRef.current = idx
      activateMatch(container, idx - 1)
      setSearchMatchInfo({ current: idx, total: marks.length })
    } else {
      const lowerContent = content.toLowerCase()
      const lowerTerm = term.toLowerCase()
      const positions: number[] = []
      let pos = 0
      while ((pos = lowerContent.indexOf(lowerTerm, pos)) !== -1) {
        positions.push(pos)
        pos += lowerTerm.length
      }
      if (positions.length === 0) return
      let idx = searchIndexRef.current
      idx = idx <= 1 ? positions.length : idx - 1
      searchIndexRef.current = idx
      const matchPos = positions[idx - 1]
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(matchPos, matchPos + term.length)
        textareaRef.current.focus()
      }
      setSearchMatchInfo({ current: idx, total: positions.length })
    }
  }, [content, isMarkdown, isEditMode])

  const handleSearchClose = useCallback(() => {
    setSearchOpen(false)
    searchTermRef.current = ''
    searchIndexRef.current = 0
    setSearchMatchInfo({ current: 0, total: 0 })
    if (markdownPreviewRef.current) {
      clearHighlights(markdownPreviewRef.current)
    }
  }, [])

  // Listen for open-search event
  useEffect(() => {
    if (!isOpen) return
    const handleOpenSearch = () => {
      setSearchOpen(true)
    }
    window.addEventListener('open-search', handleOpenSearch)
    return () => window.removeEventListener('open-search', handleOpenSearch)
  }, [isOpen])

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
      <SearchBar
        isOpen={searchOpen}
        onClose={handleSearchClose}
        onSearchChange={handleSearchChange}
        onFindNext={handleFindNext}
        onFindPrev={handleFindPrev}
        matchInfo={searchMatchInfo}
      />
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
        ) : isImage && imageDataUrl ? (
          <div className="image-preview">
            <img src={imageDataUrl} alt={getFileName(filePath)} />
          </div>
        ) : isMarkdown && !isEditMode ? (
          <div className="markdown-preview" ref={markdownPreviewRef}>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const lang = match?.[1]
                  const codeString = String(children).replace(/\n$/, '')

                  // Render Mermaid diagrams
                  if (lang === 'mermaid') {
                    return <MermaidBlock code={codeString} />
                  }

                  // Check if it's inline code (no className usually)
                  const isInline = !className && !String(children).includes('\n')
                  if (isInline) {
                    return <code className="inline-code" {...props}>{children}</code>
                  }

                  // Regular code block
                  return (
                    <pre className="code-block">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  )
                },
                table({ children }) {
                  return (
                    <div className="table-wrapper">
                      <table>{children}</table>
                    </div>
                  )
                },
              }}
            >
              {content}
            </ReactMarkdown>
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
