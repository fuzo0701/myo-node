import { useState } from 'react'
import './SearchPanel.css'

interface SearchPanelProps {
  isOpen: boolean
  onClose: () => void
  rootPath?: string
  onFileSelect: (path: string) => void
}

export default function SearchPanel({
  isOpen,
  onClose,
  rootPath,
  onFileSelect
}: SearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Array<{ file: string; line: number; content: string }>>([])
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async () => {
    if (!searchQuery.trim() || !rootPath) return

    setIsSearching(true)
    try {
      // TODO: Implement actual file search
      // For now, just show empty results
      setResults([])
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <h3>파일 검색</h3>
        <button className="close-button" onClick={onClose}>×</button>
      </div>
      <div className="search-panel-input">
        <input
          type="text"
          placeholder="검색어 입력..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <button onClick={handleSearch} disabled={isSearching}>
          {isSearching ? '검색 중...' : '검색'}
        </button>
      </div>
      <div className="search-panel-results">
        {results.length === 0 ? (
          <div className="search-panel-empty">
            {searchQuery ? '검색 결과가 없습니다' : '검색어를 입력하세요'}
          </div>
        ) : (
          results.map((result, index) => (
            <div
              key={`${result.file}-${index}`}
              className="search-result-item"
              onClick={() => onFileSelect(result.file)}
            >
              <div className="search-result-file">{result.file}</div>
              <div className="search-result-line">Line {result.line}: {result.content}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
