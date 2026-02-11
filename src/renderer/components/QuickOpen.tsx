import { useState, useEffect, useRef } from 'react'
import './QuickOpen.css'

interface QuickOpenProps {
  isOpen: boolean
  onClose: () => void
  onFileSelect: (path: string) => void
  rootPath: string
}

export default function QuickOpen({
  isOpen,
  onClose,
  onFileSelect,
  rootPath
}: QuickOpenProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      loadFiles()
    } else {
      setSearchQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen, rootPath])

  const loadFiles = async () => {
    if (!rootPath) return
    try {
      const fileList = await window.fs?.searchFiles(rootPath, '*')
      setFiles(fileList || [])
    } catch (err) {
      console.error('Failed to load files:', err)
      setFiles([])
    }
  }

  const filteredFiles = files.filter(file =>
    file.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 50)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredFiles.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filteredFiles[selectedIndex]) {
      onFileSelect(filteredFiles[selectedIndex])
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="quick-open-input"
          placeholder="파일 이름 검색... (Ctrl+P)"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setSelectedIndex(0)
          }}
          onKeyDown={handleKeyDown}
        />
        <div className="quick-open-results">
          {filteredFiles.length === 0 ? (
            <div className="quick-open-empty">파일을 찾을 수 없습니다</div>
          ) : (
            filteredFiles.map((file, index) => (
              <div
                key={file}
                className={`quick-open-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onFileSelect(file)
                  onClose()
                }}
              >
                <span className="quick-open-file-name">{file.split(/[/\\]/).pop()}</span>
                <span className="quick-open-file-path">{file}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
