import { useState, useEffect, useCallback, useRef } from 'react'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  expanded?: boolean
}

interface FileExplorerProps {
  isOpen: boolean
  onClose: () => void
  onFileSelect?: (path: string) => void
  currentCwd?: string
}

// SVG Icons
const Icons = {
  folder: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  folderOpen: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2v1" />
      <path d="M4 11h16l-2 8H6l-2-8z" />
    </svg>
  ),
  file: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  chevronRight: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  chevronDown: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  home: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  close: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
}

// File type icon mapping
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  const iconColors: Record<string, string> = {
    ts: '#3178C6',
    tsx: '#3178C6',
    js: '#F7DF1E',
    jsx: '#F7DF1E',
    json: '#CBCB41',
    css: '#264DE4',
    scss: '#CC6699',
    html: '#E34F26',
    md: '#083FA1',
    py: '#3776AB',
    go: '#00ADD8',
    rs: '#DEA584',
    vue: '#4FC08D',
    svg: '#FFB13B',
  }
  return iconColors[ext || ''] || 'var(--text-muted)'
}

function FileTreeItem({
  node,
  depth,
  onToggle,
  onSelect,
}: {
  node: FileNode
  depth: number
  onToggle: (path: string) => void
  onSelect: (path: string) => void
}) {
  const isDirectory = node.type === 'directory'
  const paddingLeft = 12 + depth * 16

  return (
    <>
      <div
        className="file-tree-item"
        style={{ paddingLeft }}
        onClick={() => {
          if (isDirectory) {
            onToggle(node.path)
          } else {
            onSelect(node.path)
          }
        }}
      >
        <span className="file-tree-chevron">
          {isDirectory && (node.expanded ? Icons.chevronDown : Icons.chevronRight)}
        </span>
        <span
          className="file-tree-icon"
          style={{ color: isDirectory ? 'var(--accent)' : getFileIcon(node.name) }}
        >
          {isDirectory ? (node.expanded ? Icons.folderOpen : Icons.folder) : Icons.file}
        </span>
        <span className="file-tree-name">{node.name}</span>
      </div>
      {isDirectory && node.expanded && node.children && (
        <div className="file-tree-children">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function FileExplorer({ isOpen, onClose, onFileSelect, currentCwd }: FileExplorerProps) {
  const [rootPath, setRootPath] = useState<string>('')
  const [tree, setTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)

  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true)
    try {
      // Use Electron IPC to read directory
      const entries = await window.fileSystem?.readDirectory(dirPath)
      if (entries) {
        const nodes: FileNode[] = entries
          .filter((entry: { name: string }) => !entry.name.startsWith('.'))
          .sort((a: { type: string; name: string }, b: { type: string; name: string }) => {
            // Directories first, then files
            if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
            return a.name.localeCompare(b.name)
          })
          .map((entry: { name: string; type: 'file' | 'directory' }) => ({
            name: entry.name,
            path: `${dirPath}/${entry.name}`.replace(/\\/g, '/'),
            type: entry.type,
            expanded: false,
            children: entry.type === 'directory' ? [] : undefined,
          }))
        setTree(nodes)
        setRootPath(dirPath)
      }
    } catch (error) {
      console.error('Failed to load directory:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const toggleDirectory = useCallback(async (path: string) => {
    setTree((prevTree) => {
      const updateNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === path) {
            if (!node.expanded && node.children?.length === 0) {
              // Load children asynchronously
              window.fileSystem?.readDirectory(path).then((entries: Array<{ name: string; type: 'file' | 'directory' }>) => {
                if (entries) {
                  const children: FileNode[] = entries
                    .filter((entry) => !entry.name.startsWith('.'))
                    .sort((a, b) => {
                      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
                      return a.name.localeCompare(b.name)
                    })
                    .map((entry) => ({
                      name: entry.name,
                      path: `${path}/${entry.name}`.replace(/\\/g, '/'),
                      type: entry.type,
                      expanded: false,
                      children: entry.type === 'directory' ? [] : undefined,
                    }))
                  setTree((t) => {
                    const updateChildren = (nodes: FileNode[]): FileNode[] => {
                      return nodes.map((n) => {
                        if (n.path === path) {
                          return { ...n, children, expanded: true }
                        }
                        if (n.children) {
                          return { ...n, children: updateChildren(n.children) }
                        }
                        return n
                      })
                    }
                    return updateChildren(t)
                  })
                }
              })
              return { ...node, expanded: true }
            }
            return { ...node, expanded: !node.expanded }
          }
          if (node.children) {
            return { ...node, children: updateNode(node.children) }
          }
          return node
        })
      }
      return updateNode(prevTree)
    })
  }, [])

  const handleFileSelect = useCallback((path: string) => {
    onFileSelect?.(path)
  }, [onFileSelect])

  // Normalize path for comparison (handle Windows/Unix differences)
  const normalizePath = useCallback((p: string): string => {
    return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  }, [])

  // Load directory when cwd changes or on mount
  useEffect(() => {
    if (isOpen) {
      // Use provided cwd or fall back to process cwd
      if (currentCwd && currentCwd !== '~') {
        // Compare normalized paths to avoid reload on format differences
        if (normalizePath(currentCwd) !== normalizePath(rootPath)) {
          loadDirectory(currentCwd)
        }
      } else if (!rootPath) {
        // Fall back to getting cwd from main process
        window.fileSystem?.getCurrentDirectory().then((cwd: string) => {
          if (cwd) {
            loadDirectory(cwd)
          }
        })
      }
    }
  }, [isOpen, currentCwd, rootPath, loadDirectory, normalizePath])

  // Watch for file system changes
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!isOpen || !rootPath) return

    // Start watching the root directory
    window.fileSystem?.watch(rootPath)

    // Listen for file system changes
    const unsubscribe = window.fileSystem?.onFsChange((dirPath, _eventType, _filename) => {
      // Refresh the tree when changes detected in watched directory
      if (dirPath === rootPath || dirPath.startsWith(rootPath)) {
        // Debounce: wait 300ms before refreshing
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current)
        }
        refreshTimerRef.current = setTimeout(() => {
          loadDirectory(rootPath)
        }, 300)
      }
    })

    return () => {
      // Stop watching and clean up
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      window.fileSystem?.unwatch(rootPath)
      unsubscribe?.()
    }
  }, [isOpen, rootPath, loadDirectory])

  if (!isOpen) return null

  return (
    <div className="file-explorer">
      <div className="file-explorer-header">
        <h2>Explorer</h2>
        <div className="file-explorer-actions">
          <button
            className="explorer-action-btn"
            onClick={() => loadDirectory(rootPath)}
            title="Refresh"
          >
            {Icons.refresh}
          </button>
          <button
            className="explorer-action-btn"
            onClick={onClose}
            title="Close"
          >
            {Icons.close}
          </button>
        </div>
      </div>
      <div className="file-explorer-path">
        <span className="path-icon">{Icons.home}</span>
        <span className="path-text">{rootPath.split(/[/\\]/).pop() || rootPath}</span>
      </div>
      <div className="file-explorer-tree">
        {loading ? (
          <div className="file-explorer-loading">Loading...</div>
        ) : tree.length === 0 ? (
          <div className="file-explorer-empty">No files found</div>
        ) : (
          tree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              onToggle={toggleDirectory}
              onSelect={handleFileSelect}
            />
          ))
        )}
      </div>
    </div>
  )
}
