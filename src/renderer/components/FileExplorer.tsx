import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

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
  onOpenFolder?: (path: string) => void
  onOpenInNewTab?: (path: string) => void
  currentCwd?: string
}

interface ContextMenuState {
  isOpen: boolean
  x: number
  y: number
  targetPath: string
  targetType: 'file' | 'directory' | 'background'
}

interface ClipboardState {
  paths: string[]
  operation: 'copy' | 'cut' | null
}

// Helper function to get directory of a path
const getParentDirectory = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/')
  const parts = normalized.split('/')
  parts.pop()
  return parts.join('/') || '/'
}

// Helper function to get basename
const getBasename = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/')
  return normalized.split('/').pop() || ''
}

// Helper function to join paths
const joinPath = (dir: string, file: string): string => {
  const normalizedDir = dir.replace(/\\/g, '/').replace(/\/+$/, '')
  return `${normalizedDir}/${file}`
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
  copy: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  paste: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  newFile: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  ),
  newFolder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  ),
  rename: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  ),
  trash: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  openFolder: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <line x1="12" y1="11" x2="12" y2="17" />
      <polyline points="9 14 12 11 15 14" />
    </svg>
  ),
  terminal: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" />
      <line x1="12" y1="19" x2="20" y2="19" />
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
  onContextMenu,
  isSelected,
  isCut,
}: {
  node: FileNode
  depth: number
  onToggle: (path: string) => void
  onSelect: (path: string, type: 'file' | 'directory') => void
  onContextMenu: (e: React.MouseEvent, path: string, type: 'file' | 'directory') => void
  isSelected: boolean
  isCut: boolean
}) {
  const isDirectory = node.type === 'directory'
  const paddingLeft = 12 + depth * 16

  return (
    <>
      <div
        className={`file-tree-item ${isSelected && !isDirectory ? 'selected' : ''} ${isCut ? 'cut' : ''}`}
        style={{ paddingLeft }}
        onClick={() => {
          // Set selected path for files only
          if (!isDirectory) {
            onSelect(node.path, node.type)
          } else {
            // Just toggle directory
            onToggle(node.path)
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node.path, node.type)}
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
              onContextMenu={onContextMenu}
              isSelected={isSelected}
              isCut={isCut}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default function FileExplorer({ isOpen, onClose, onFileSelect, onOpenFolder, onOpenInNewTab, currentCwd }: FileExplorerProps) {
  const [rootPath, setRootPath] = useState<string>('')
  const [tree, setTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<'file' | 'directory' | null>(null)
  const [clipboardState, setClipboardState] = useState<ClipboardState>({ paths: [], operation: null })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetPath: '',
    targetType: 'background',
  })
  const [renameState, setRenameState] = useState<{ path: string; name: string } | null>(null)
  const explorerRef = useRef<HTMLDivElement>(null)

  const loadDirectory = useCallback(async (dirPath: string) => {
    console.log('[FileExplorer] loadDirectory called with:', dirPath)
    setLoading(true)
    try {
      // Use Electron IPC to read directory
      const entries = await window.fileSystem?.readDirectory(dirPath)
      console.log('[FileExplorer] entries:', entries?.length, entries)
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
            console.log('[toggleDirectory] path:', path, 'expanded:', node.expanded, 'children:', node.children?.length)
            if (!node.expanded && node.children?.length === 0) {
              // Load children asynchronously
              isExpandingRef.current = true
              window.fileSystem?.readDirectory(path).then((entries: Array<{ name: string; type: 'file' | 'directory' }>) => {
                isExpandingRef.current = false
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

  const handleFileSelect = useCallback((path: string, type: 'file' | 'directory') => {
    setSelectedPath(path)
    setSelectedType(type)
    if (type === 'file') {
      onFileSelect?.(path)
    }
  }, [onFileSelect])

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, targetPath: string, targetType: 'file' | 'directory' | 'background') => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedPath(targetPath || null)
    if (targetType !== 'background') {
      setSelectedType(targetType)
    }

    // Calculate position, keeping menu within viewport
    const menuWidth = 200
    const menuHeight = 250  // Approximate menu height
    let x = e.clientX
    let y = e.clientY

    // Adjust if menu would go off screen
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10
    }

    setContextMenu({
      isOpen: true,
      x,
      y,
      targetPath,
      targetType,
    })
  }, [])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }))
  }, [])

  // Copy selected file/folder
  const handleCopy = useCallback(async () => {
    if (selectedPath) {
      setClipboardState({ paths: [selectedPath], operation: 'copy' })
      await window.clipboard?.writeFiles([selectedPath])
    }
    closeContextMenu()
  }, [selectedPath, closeContextMenu])

  // Cut selected file/folder
  const handleCut = useCallback(async () => {
    if (selectedPath) {
      setClipboardState({ paths: [selectedPath], operation: 'cut' })
      await window.clipboard?.writeFiles([selectedPath])
    }
    closeContextMenu()
  }, [selectedPath, closeContextMenu])

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    closeContextMenu()

    // Determine destination directory
    // Priority: contextMenu target > selectedPath > rootPath
    let destDir = rootPath

    if (contextMenu.targetPath) {
      // From context menu
      if (contextMenu.targetType === 'directory') {
        destDir = contextMenu.targetPath
      } else {
        destDir = getParentDirectory(contextMenu.targetPath)
      }
    } else if (selectedPath) {
      // From keyboard shortcut - use cached selectedType
      if (selectedType === 'directory') {
        destDir = selectedPath
      } else {
        destDir = getParentDirectory(selectedPath)
      }
    }

    // Always try system clipboard first (for external copy)
    let sourcePaths: string[] = []
    try {
      const systemFiles = await window.clipboard?.readFiles()
      if (systemFiles && systemFiles.length > 0) {
        sourcePaths = systemFiles
      }
    } catch {
      // Error reading system clipboard, continue to internal state
    }

    // If system clipboard is empty, use internal clipboard state
    if (sourcePaths.length === 0 && clipboardState.paths.length > 0) {
      sourcePaths = clipboardState.paths
    }

    if (sourcePaths.length === 0) {
      return
    }

    // Copy/move each file
    for (const sourcePath of sourcePaths) {
      const basename = getBasename(sourcePath)
      let destPath = joinPath(destDir, basename)

      // Check if destination exists and generate unique name
      let counter = 1
      while (await window.fileSystem?.exists(destPath)) {
        const ext = basename.includes('.') ? '.' + basename.split('.').pop() : ''
        const nameWithoutExt = ext ? basename.slice(0, -ext.length) : basename
        destPath = joinPath(destDir, `${nameWithoutExt} (${counter})${ext}`)
        counter++
      }

      // Get source stat to determine if it's a file or directory
      const stat = await window.fileSystem?.stat(sourcePath)
      if (!stat) continue

      if (stat.isDirectory) {
        await window.fileSystem?.copyDirectory(sourcePath, destPath)
      } else {
        await window.fileSystem?.copyFile(sourcePath, destPath)
      }

      // If cut operation, delete the source
      if (clipboardState.operation === 'cut') {
        await window.fileSystem?.delete(sourcePath)
      }
    }

    // Clear clipboard state if it was a cut operation
    if (clipboardState.operation === 'cut') {
      setClipboardState({ paths: [], operation: null })
    }

    // File watcher will automatically refresh the view
    // No need to call loadDirectory which resets expanded state
  }, [contextMenu, clipboardState, rootPath, selectedPath, selectedType, closeContextMenu])

  // Create new file
  const handleNewFile = useCallback(async () => {
    closeContextMenu()
    let targetDir = rootPath
    if (contextMenu.targetType === 'directory') {
      targetDir = contextMenu.targetPath
    } else if (contextMenu.targetPath) {
      targetDir = getParentDirectory(contextMenu.targetPath)
    }

    // Generate unique filename
    let filename = 'new_file.txt'
    let counter = 1
    while (await window.fileSystem?.exists(joinPath(targetDir, filename))) {
      filename = `new_file (${counter}).txt`
      counter++
    }

    const newPath = joinPath(targetDir, filename)
    await window.fileSystem?.writeFile(newPath, '')
    loadDirectory(rootPath)
    setRenameState({ path: newPath, name: filename })
  }, [contextMenu, rootPath, closeContextMenu, loadDirectory])

  // Create new folder
  const handleNewFolder = useCallback(async () => {
    closeContextMenu()
    let targetDir = rootPath
    if (contextMenu.targetType === 'directory') {
      targetDir = contextMenu.targetPath
    } else if (contextMenu.targetPath) {
      targetDir = getParentDirectory(contextMenu.targetPath)
    }

    // Generate unique folder name
    let foldername = 'New Folder'
    let counter = 1
    while (await window.fileSystem?.exists(joinPath(targetDir, foldername))) {
      foldername = `New Folder (${counter})`
      counter++
    }

    const newPath = joinPath(targetDir, foldername)
    await window.fileSystem?.createDirectory(newPath)
    loadDirectory(rootPath)
    setRenameState({ path: newPath, name: foldername })
  }, [contextMenu, rootPath, closeContextMenu, loadDirectory])

  // Rename file/folder
  const handleRename = useCallback(() => {
    if (contextMenu.targetPath) {
      setRenameState({ path: contextMenu.targetPath, name: getBasename(contextMenu.targetPath) })
    }
    closeContextMenu()
  }, [contextMenu, closeContextMenu])

  // Confirm rename
  const confirmRename = useCallback(async (newName: string) => {
    if (!renameState) return

    const parentDir = getParentDirectory(renameState.path)
    const newPath = joinPath(parentDir, newName)

    if (newPath !== renameState.path) {
      await window.fileSystem?.rename(renameState.path, newPath)
      loadDirectory(rootPath)
    }

    setRenameState(null)
  }, [renameState, rootPath, loadDirectory])

  // Delete file/folder
  const handleDelete = useCallback(async () => {
    closeContextMenu()
    if (!contextMenu.targetPath) return

    const basename = getBasename(contextMenu.targetPath)
    if (confirm(`Are you sure you want to delete "${basename}"?`)) {
      await window.fileSystem?.delete(contextMenu.targetPath)
      loadDirectory(rootPath)
    }
  }, [contextMenu, rootPath, closeContextMenu, loadDirectory])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if explorer is focused or active element is body
      const explorerFocused = explorerRef.current?.contains(document.activeElement)
      const bodyFocused = document.activeElement === document.body

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (!explorerFocused && !bodyFocused) {
          return
        }
        e.preventDefault()
        if (selectedPath) {
          setClipboardState({ paths: [selectedPath], operation: 'copy' })
          window.clipboard?.writeFiles([selectedPath])
        }
        return
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        e.preventDefault()
        if (selectedPath) {
          setClipboardState({ paths: [selectedPath], operation: 'cut' })
          window.clipboard?.writeFiles([selectedPath])
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        handlePaste()
      } else if (e.key === 'Delete') {
        e.preventDefault()
        if (selectedPath) {
          const basename = getBasename(selectedPath)
          if (confirm(`Are you sure you want to delete "${basename}"?`)) {
            window.fileSystem?.delete(selectedPath).then(() => {
              loadDirectory(rootPath)
              setSelectedPath(null)
            })
          }
        }
      } else if (e.key === 'F2' && selectedPath) {
        e.preventDefault()
        setRenameState({ path: selectedPath, name: getBasename(selectedPath) })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedPath, handlePaste, rootPath, loadDirectory])

  // Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu.isOpen) return

    const handleClick = () => closeContextMenu()
    // Delay adding the listener to avoid immediate close
    const timeoutId = setTimeout(() => {
      window.addEventListener('click', handleClick)
    }, 10)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('click', handleClick)
    }
  }, [contextMenu.isOpen, closeContextMenu])

  // Normalize path for comparison
  const normalizePath = useCallback((p: string): string => {
    return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  }, [])

  // Track manual folder selection to prevent currentCwd from overriding
  const manualSelectionRef = useRef<boolean>(false)

  // Load directory when currentCwd changes (sync with terminal)
  // Skip if user manually selected a folder
  useEffect(() => {
    if (!isOpen) return
    if (!currentCwd || currentCwd === '~') return

    // Skip if user manually selected a folder
    if (manualSelectionRef.current) {
      return
    }

    const normalizedCwd = normalizePath(currentCwd)
    const normalizedRoot = rootPath ? normalizePath(rootPath) : ''

    // Skip if same as current rootPath
    if (normalizedCwd === normalizedRoot) return

    // Update directory
    loadDirectory(currentCwd)
  }, [isOpen, currentCwd, rootPath, loadDirectory, normalizePath])

  // Initial load when explorer opens with no rootPath
  useEffect(() => {
    if (!isOpen || rootPath) return

    if (currentCwd && currentCwd !== '~') {
      loadDirectory(currentCwd)
    } else {
      window.fileSystem?.getCurrentDirectory().then((cwd: string) => {
        if (cwd) {
          loadDirectory(cwd)
        }
      })
    }
  }, [isOpen, rootPath, currentCwd, loadDirectory])

  // Watch for file system changes
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isExpandingRef = useRef<boolean>(false)

  useEffect(() => {
    if (!isOpen || !rootPath) return

    // Start watching the root directory
    window.fileSystem?.watch(rootPath)

    // Listen for file system changes
    const unsubscribe = window.fileSystem?.onFsChange((dirPath, _eventType, _filename) => {
      // Skip refresh while expanding folders (reading directory content triggers fs events)
      if (isExpandingRef.current) {
        return
      }
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
    <div
      className="file-explorer"
      ref={explorerRef}
      tabIndex={0}
      onContextMenu={(e) => handleContextMenu(e, '', 'background')}
    >
      <div className="file-explorer-header">
        <h2>Explorer</h2>
        <div className="file-explorer-actions">
          <button
            className="explorer-action-btn"
            onClick={async () => {
              const folderPath = await window.dialog?.openFolder({ title: 'Open Folder' })
              if (folderPath) {
                manualSelectionRef.current = true
                loadDirectory(folderPath)
                onOpenFolder?.(folderPath)
              }
            }}
            title="Open Folder"
          >
            {Icons.openFolder}
          </button>
          <button
            className="explorer-action-btn"
            onClick={handleNewFile}
            title="New File"
          >
            {Icons.newFile}
          </button>
          <button
            className="explorer-action-btn"
            onClick={handleNewFolder}
            title="New Folder"
          >
            {Icons.newFolder}
          </button>
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
      <div
        className="file-explorer-path clickable"
        onClick={() => {
          // Navigate to terminal's current directory
          if (currentCwd && currentCwd !== '~') {
            loadDirectory(currentCwd)
          } else {
            window.fileSystem?.getCurrentDirectory().then((cwd: string) => {
              if (cwd) loadDirectory(cwd)
            })
          }
        }}
        title="Go to terminal directory"
      >
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
              onContextMenu={handleContextMenu}
              isSelected={selectedPath === node.path}
              isCut={clipboardState.operation === 'cut' && clipboardState.paths.includes(node.path)}
            />
          ))
        )}
      </div>

      {/* Context Menu - rendered via portal to avoid z-index stacking context issues */}
      {contextMenu.isOpen && createPortal(
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.targetType === 'directory' && (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  const targetPath = contextMenu.targetPath
                  closeContextMenu()
                  onOpenInNewTab?.(targetPath)
                }}
              >
                {Icons.terminal}
                <span>Open in New Tab</span>
              </button>
              <div className="context-menu-divider" />
            </>
          )}
          <button className="context-menu-item" onClick={handleNewFile}>
            {Icons.newFile}
            <span>New File</span>
          </button>
          <button className="context-menu-item" onClick={handleNewFolder}>
            {Icons.newFolder}
            <span>New Folder</span>
          </button>
          <div className="context-menu-divider" />
          {contextMenu.targetPath && (
            <>
              <button className="context-menu-item" onClick={handleCopy}>
                {Icons.copy}
                <span>Copy</span>
                <span className="shortcut">Ctrl+C</span>
              </button>
              <button className="context-menu-item" onClick={handleCut}>
                {Icons.copy}
                <span>Cut</span>
                <span className="shortcut">Ctrl+X</span>
              </button>
            </>
          )}
          <button className="context-menu-item" onClick={handlePaste}>
            {Icons.paste}
            <span>Paste</span>
            <span className="shortcut">Ctrl+V</span>
          </button>
          {contextMenu.targetPath && (
            <>
              <div className="context-menu-divider" />
              <button className="context-menu-item" onClick={handleRename}>
                {Icons.rename}
                <span>Rename</span>
                <span className="shortcut">F2</span>
              </button>
              <button className="context-menu-item danger" onClick={handleDelete}>
                {Icons.trash}
                <span>Delete</span>
                <span className="shortcut">Del</span>
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Rename Dialog */}
      {renameState && (
        <div className="rename-dialog-overlay" onClick={() => setRenameState(null)}>
          <div className="rename-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Rename</h3>
            <input
              type="text"
              defaultValue={renameState.name}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  confirmRename((e.target as HTMLInputElement).value)
                } else if (e.key === 'Escape') {
                  setRenameState(null)
                }
              }}
            />
            <div className="rename-dialog-actions">
              <button onClick={() => setRenameState(null)}>Cancel</button>
              <button
                className="primary"
                onClick={(e) => {
                  const input = (e.target as HTMLButtonElement).parentElement?.previousElementSibling as HTMLInputElement
                  confirmRename(input.value)
                }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
