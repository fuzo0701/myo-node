import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useExplorerStore } from '../store/explorer'
import { useSettingsStore } from '../store/settings'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  expanded?: boolean
  size?: number
  mtime?: number
}

interface FileExplorerProps {
  isOpen: boolean
  onClose: () => void
  onFileSelect?: (path: string) => void
  onOpenFolder?: (path: string) => void
  onOpenInNewTab?: (path: string) => void
  onGitClone?: (destPath: string, url: string) => void
  currentCwd?: string
  explorerPath?: string  // 탭별 저장된 탐색기 경로
  onExplorerPathChange?: (path: string | undefined) => void  // 탐색기 경로 변경 콜백
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

// Git status types
type GitStatusCode = 'modified' | 'staged' | 'untracked' | 'deleted' | 'renamed' | 'conflict' | null

interface GitStatusInfo {
  status: GitStatusCode
  badge: string
}

function resolveGitStatus(index: string, workTree: string): GitStatusInfo {
  // Conflict: both modified
  if (index === 'U' || workTree === 'U' || (index === 'A' && workTree === 'A') || (index === 'D' && workTree === 'D')) {
    return { status: 'conflict', badge: '!' }
  }
  // Work tree modifications take priority for display
  if (workTree === 'M') return { status: 'modified', badge: 'M' }
  if (workTree === 'D') return { status: 'deleted', badge: 'D' }
  if (workTree === '?') return { status: 'untracked', badge: '?' }
  // Index (staged) statuses
  if (index === 'M') return { status: 'staged', badge: 'M' }
  if (index === 'A') return { status: 'staged', badge: 'A' }
  if (index === 'D') return { status: 'deleted', badge: 'D' }
  if (index === 'R') return { status: 'renamed', badge: 'R' }
  return { status: null, badge: '' }
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

// File type icon color mapping
const FILE_ICON_COLORS: Record<string, string> = {
  // JavaScript / TypeScript
  ts: '#3178C6', tsx: '#3178C6', mts: '#3178C6', cts: '#3178C6',
  js: '#F7DF1E', jsx: '#F7DF1E', mjs: '#F7DF1E', cjs: '#F7DF1E',
  // Web
  html: '#E34F26', htm: '#E34F26',
  css: '#264DE4', scss: '#CC6699', sass: '#CC6699', less: '#1D365D',
  vue: '#4FC08D', svelte: '#FF3E00', astro: '#FF5D01',
  // Data / Config
  json: '#CBCB41', jsonc: '#CBCB41', json5: '#CBCB41',
  yaml: '#CB171E', yml: '#CB171E',
  toml: '#9C4121', ini: '#9C4121',
  xml: '#E37933', xsl: '#E37933',
  csv: '#237346', tsv: '#237346',
  env: '#ECD53F',
  // Markdown / Docs
  md: '#083FA1', mdx: '#083FA1', txt: '#6A737D', rst: '#6A737D',
  // Python
  py: '#3776AB', pyw: '#3776AB', pyi: '#3776AB', ipynb: '#F37626',
  // Systems
  go: '#00ADD8',
  rs: '#DEA584',
  c: '#555555', h: '#555555',
  cpp: '#F34B7D', cxx: '#F34B7D', cc: '#F34B7D', hpp: '#F34B7D',
  cs: '#178600',
  java: '#B07219', kt: '#A97BFF', kts: '#A97BFF',
  swift: '#F05138',
  // Scripting
  rb: '#CC342D', erb: '#CC342D',
  php: '#4F5D95',
  lua: '#000080',
  pl: '#0298C3', pm: '#0298C3',
  sh: '#89E051', bash: '#89E051', zsh: '#89E051', fish: '#89E051',
  bat: '#C1F12E', cmd: '#C1F12E', ps1: '#012456',
  // Database
  sql: '#E38C00', sqlite: '#E38C00', db: '#E38C00',
  // Images
  svg: '#FFB13B',
  png: '#A074C4', jpg: '#A074C4', jpeg: '#A074C4', gif: '#A074C4',
  webp: '#A074C4', ico: '#A074C4', bmp: '#A074C4',
  // Archives
  zip: '#8B6914', tar: '#8B6914', gz: '#8B6914', rar: '#8B6914', '7z': '#8B6914',
  // Build / Lock
  lock: '#6A737D',
  // Docker / DevOps
  dockerfile: '#2496ED',
  // Misc
  log: '#6A737D', diff: '#41B883', patch: '#41B883',
  wasm: '#654FF0', zig: '#F7A41D',
  pdf: '#E4002B',
}

// Special filename matching (dotfiles, specific filenames)
const SPECIAL_FILE_COLORS: Record<string, string> = {
  '.gitignore': '#F05033', '.gitattributes': '#F05033', '.gitmodules': '#F05033',
  '.dockerignore': '#2496ED', 'dockerfile': '#2496ED', 'docker-compose.yml': '#2496ED', 'docker-compose.yaml': '#2496ED',
  '.eslintrc': '#4B32C3', '.eslintrc.js': '#4B32C3', '.eslintrc.json': '#4B32C3', '.eslintignore': '#4B32C3',
  '.prettierrc': '#F7B93E', '.prettierrc.json': '#F7B93E', '.prettierignore': '#F7B93E',
  'makefile': '#427819', 'cmakelists.txt': '#427819',
  '.editorconfig': '#FEFEFE',
  'license': '#D22128', 'license.md': '#D22128',
  'readme.md': '#083FA1',
}

const getFileIcon = (filename: string): string => {
  const lower = filename.toLowerCase()
  // Check special filenames first
  if (SPECIAL_FILE_COLORS[lower]) return SPECIAL_FILE_COLORS[lower]
  // Then check extension
  const ext = lower.split('.').pop()
  return FILE_ICON_COLORS[ext || ''] || 'var(--text-muted)'
}

// Flatten visible tree nodes in display order
function flattenVisibleNodes(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = []
  for (const node of nodes) {
    result.push(node)
    if (node.type === 'directory' && node.expanded && node.children) {
      result.push(...flattenVisibleNodes(node.children))
    }
  }
  return result
}

function FileTreeItem({
  node,
  depth,
  onToggle,
  onClick,
  onContextMenu,
  selectedPaths,
  cutPaths,
  gitStatusMap,
  gitIgnoredSet,
}: {
  node: FileNode
  depth: number
  onToggle: (path: string) => void
  onClick: (e: React.MouseEvent, path: string, type: 'file' | 'directory') => void
  onContextMenu: (e: React.MouseEvent, path: string, type: 'file' | 'directory') => void
  selectedPaths: Set<string>
  cutPaths: string[]
  gitStatusMap: Map<string, GitStatusInfo>
  gitIgnoredSet: Set<string>
}) {
  const isDirectory = node.type === 'directory'
  const isSelected = selectedPaths.has(node.path)
  const isCut = cutPaths.includes(node.path)
  const isIgnored = gitIgnoredSet.has(node.path)
  const paddingLeft = 12 + depth * 16
  const gitInfo = gitStatusMap.get(node.path)
  const gitClass = gitInfo?.status ? `git-${gitInfo.status}` : ''

  return (
    <>
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''} ${isCut ? 'cut' : ''} ${isIgnored ? 'git-ignored' : ''}`}
        style={{ paddingLeft }}
        onClick={(e) => {
          onClick(e, node.path, node.type)
          if (isDirectory && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
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
        <span className={`file-tree-name ${gitClass}`}>{node.name}</span>
        {gitInfo?.badge && (
          <span className={`git-status-badge ${gitClass}`}>{gitInfo.badge}</span>
        )}
      </div>
      {isDirectory && node.expanded && node.children && (
        <div className="file-tree-children">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onToggle={onToggle}
              onClick={onClick}
              onContextMenu={onContextMenu}
              selectedPaths={selectedPaths}
              cutPaths={cutPaths}
              gitStatusMap={gitStatusMap}
              gitIgnoredSet={gitIgnoredSet}
            />
          ))}
        </div>
      )}
    </>
  )
}

// Git branch icon for clone dialog
const GitIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <line x1="6" y1="9" x2="6" y2="21" />
  </svg>
)

// Large folder icon for welcome hero
const LargeFolderIcon = (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

function ExplorerWelcome({
  onClose,
  onOpenFolder,
  onGitClone,
  onExplorerPathChange,
  onNavigateToFolder,
}: {
  onClose: () => void
  onOpenFolder?: (path: string) => void
  onGitClone?: (destPath: string, url: string) => void
  onExplorerPathChange?: (path: string | undefined) => void
  onNavigateToFolder: (path: string) => void
}) {
  const { recentFolders, addRecentFolder, removeRecentFolder } = useExplorerStore()
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [cloneDestPath, setCloneDestPath] = useState('')
  const [cloneUrl, setCloneUrl] = useState('')

  const handleOpenFolder = useCallback(async () => {
    const folderPath = await window.dialog?.openFolder({ title: 'Open Folder' })
    if (folderPath) {
      addRecentFolder(folderPath)
      onExplorerPathChange?.(folderPath)
      onOpenFolder?.(folderPath)
      onNavigateToFolder(folderPath)
    }
  }, [addRecentFolder, onExplorerPathChange, onOpenFolder, onNavigateToFolder])

  const handleGitCloneStart = useCallback(async () => {
    const folderPath = await window.dialog?.openFolder({ title: 'Select Clone Destination' })
    if (folderPath) {
      setCloneDestPath(folderPath)
      setCloneUrl('')
      setCloneDialogOpen(true)
    }
  }, [])

  const handleCloneConfirm = useCallback(() => {
    if (!cloneDestPath || !cloneUrl.trim()) return
    addRecentFolder(cloneDestPath)
    onExplorerPathChange?.(cloneDestPath)
    onGitClone?.(cloneDestPath, cloneUrl.trim())
    onNavigateToFolder(cloneDestPath)
    setCloneDialogOpen(false)
  }, [cloneDestPath, cloneUrl, addRecentFolder, onExplorerPathChange, onGitClone, onNavigateToFolder])

  const handleRecentClick = useCallback((path: string) => {
    addRecentFolder(path)
    onExplorerPathChange?.(path)
    onOpenFolder?.(path)
    onNavigateToFolder(path)
  }, [addRecentFolder, onExplorerPathChange, onOpenFolder, onNavigateToFolder])

  return (
    <div className="explorer-welcome">
      <div className="welcome-header">
        <h2>Explorer</h2>
        <div className="file-explorer-actions">
          <button className="explorer-action-btn" onClick={onClose} title="Close">
            {Icons.close}
          </button>
        </div>
      </div>

      <div className="welcome-hero">
        <div className="welcome-hero-icon">{LargeFolderIcon}</div>
        <h3>Open a Folder</h3>
        <p>Browse files or clone a repository to get started.</p>
      </div>

      <div className="welcome-actions">
        <button className="welcome-action-btn" onClick={handleOpenFolder}>
          {Icons.openFolder}
          <span>Open Folder</span>
        </button>
        <button className="welcome-action-btn" onClick={handleGitCloneStart}>
          {GitIcon}
          <span>Git Clone</span>
        </button>
      </div>

      {recentFolders.length > 0 && (
        <div className="welcome-recent">
          <div className="welcome-recent-title">Recent Folders</div>
          <div className="welcome-recent-list">
            {recentFolders.map((folder) => (
              <button
                key={folder.path}
                className="welcome-recent-item"
                onClick={() => handleRecentClick(folder.path)}
              >
                {Icons.folder}
                <div className="welcome-recent-item-info">
                  <span className="welcome-recent-item-name">{folder.name}</span>
                  <span className="welcome-recent-item-path">{folder.path}</span>
                </div>
                <span
                  className="welcome-recent-item-remove"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeRecentFolder(folder.path)
                  }}
                >
                  {Icons.close}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Git Clone Dialog */}
      {cloneDialogOpen && (
        <div className="rename-dialog-overlay" onClick={() => setCloneDialogOpen(false)}>
          <div className="git-clone-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{GitIcon} Git Clone</h3>
            <div className="git-clone-field">
              <label>Destination</label>
              <div className="path-display">{cloneDestPath}</div>
            </div>
            <div className="git-clone-field">
              <label>Repository URL</label>
              <input
                type="text"
                placeholder="https://github.com/user/repo.git"
                value={cloneUrl}
                onChange={(e) => setCloneUrl(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCloneConfirm()
                  if (e.key === 'Escape') setCloneDialogOpen(false)
                }}
              />
            </div>
            <div className="git-clone-actions">
              <button onClick={() => setCloneDialogOpen(false)}>Cancel</button>
              <button
                className="primary"
                disabled={!cloneUrl.trim()}
                onClick={handleCloneConfirm}
              >
                Clone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function FileExplorer({ isOpen, onClose, onFileSelect, onOpenFolder, onOpenInNewTab, onGitClone, currentCwd, explorerPath, onExplorerPathChange }: FileExplorerProps) {
  const [viewMode, setViewMode] = useState<'welcome' | 'tree'>(
    explorerPath ? 'tree' : 'welcome'
  )
  const { addRecentFolder } = useExplorerStore()
  const showHiddenFiles = useSettingsStore((s) => s.showHiddenFiles)
  const setShowHiddenFiles = useSettingsStore((s) => s.setShowHiddenFiles)
  const sortMode = useSettingsStore((s) => s.explorerSortMode)
  const setSortMode = useSettingsStore((s) => s.setExplorerSortMode)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [rootPath, setRootPath] = useState<string>('')
  const [tree, setTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)
  const [filterQuery, setFilterQuery] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const filterInputRef = useRef<HTMLInputElement>(null)
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [selectedType, setSelectedType] = useState<'file' | 'directory' | null>(null)
  const anchorPathRef = useRef<string | null>(null)  // For Shift+Click range selection
  const [clipboardState, setClipboardState] = useState<ClipboardState>({ paths: [], operation: null })
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    targetPath: '',
    targetType: 'background',
  })
  const [renameState, setRenameState] = useState<{ path: string; name: string } | null>(null)
  const [createState, setCreateState] = useState<{ type: 'file' | 'folder'; targetDir: string } | null>(null)
  const [gitStatusMap, setGitStatusMap] = useState<Map<string, GitStatusInfo>>(new Map())
  const [gitIgnoredSet, setGitIgnoredSet] = useState<Set<string>>(new Set())
  const [gitBranch, setGitBranch] = useState<string | null>(null)
  const gitRepoRootRef = useRef<string | null>(null)
  const explorerRef = useRef<HTMLDivElement>(null)

  const fetchGitStatus = useCallback(async (dirPath: string) => {
    try {
      const repoRoot = await window.git?.getRepoRoot(dirPath)
      gitRepoRootRef.current = repoRoot || null
      if (!repoRoot) {
        setGitStatusMap(new Map())
        setGitBranch(null)
        return
      }
      const [statusData, branch, ignoredList] = await Promise.all([
        window.git?.getStatus(repoRoot),
        window.git?.getBranch(dirPath),
        window.git?.getIgnored(repoRoot),
      ])
      setGitBranch(branch || null)
      // Build ignored set
      const normalizedRoot = repoRoot.replace(/\\/g, '/')
      if (ignoredList && ignoredList.length > 0) {
        const ignored = new Set<string>()
        for (const relPath of ignoredList) {
          ignored.add(`${normalizedRoot}/${relPath}`)
        }
        setGitIgnoredSet(ignored)
      } else {
        setGitIgnoredSet(new Set())
      }
      if (!statusData) {
        setGitStatusMap(new Map())
        return
      }
      const newMap = new Map<string, GitStatusInfo>()
      // Track which directories have modified children
      const dirStatuses = new Map<string, GitStatusCode>()

      for (const [relPath, { index, workTree }] of Object.entries(statusData)) {
        const info = resolveGitStatus(index, workTree)
        if (!info.status) continue
        const fullPath = `${normalizedRoot}/${relPath}`
        newMap.set(fullPath, info)
        // Propagate status to parent directories
        const parts = relPath.split('/')
        for (let i = 1; i < parts.length; i++) {
          const dirRelPath = parts.slice(0, i).join('/')
          const dirFullPath = `${normalizedRoot}/${dirRelPath}`
          // Priority: conflict > deleted > modified > staged > untracked > renamed
          const existing = dirStatuses.get(dirFullPath)
          const priority: Record<string, number> = { conflict: 6, deleted: 5, modified: 4, staged: 3, untracked: 2, renamed: 1 }
          const newPriority = priority[info.status] || 0
          const existingPriority = existing ? (priority[existing] || 0) : 0
          if (newPriority > existingPriority) {
            dirStatuses.set(dirFullPath, info.status)
          }
        }
      }
      // Add directory statuses
      for (const [dirPath, status] of dirStatuses) {
        if (!newMap.has(dirPath)) {
          const badgeMap: Record<string, string> = { modified: 'M', staged: 'M', untracked: '?', deleted: 'D', renamed: 'R', conflict: '!' }
          newMap.set(dirPath, { status, badge: badgeMap[status] || '' })
        }
      }
      setGitStatusMap(newMap)
    } catch {
      setGitStatusMap(new Map())
    }
  }, [])

  // Sort comparator based on current sort mode
  const needsStats = sortMode === 'date' || sortMode === 'size'

  const sortEntries = useCallback((a: { name: string; type: string; size?: number; mtime?: number }, b: { name: string; type: string; size?: number; mtime?: number }) => {
    // Directories always first
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
    switch (sortMode) {
      case 'type': {
        const extA = a.name.includes('.') ? a.name.split('.').pop()!.toLowerCase() : ''
        const extB = b.name.includes('.') ? b.name.split('.').pop()!.toLowerCase() : ''
        return extA.localeCompare(extB) || a.name.localeCompare(b.name)
      }
      case 'date':
        return (b.mtime || 0) - (a.mtime || 0) // newest first
      case 'size':
        return (b.size || 0) - (a.size || 0) // largest first
      default: // 'name'
        return a.name.localeCompare(b.name)
    }
  }, [sortMode])

  const loadDirectory = useCallback(async (dirPath: string) => {
    setLoading(true)
    try {
      const entries = await window.fileSystem?.readDirectory(dirPath, needsStats)
      if (entries) {
        const nodes: FileNode[] = entries
          .filter((entry) => showHiddenFiles || !entry.name.startsWith('.'))
          .sort(sortEntries)
          .map((entry) => ({
            name: entry.name,
            path: `${dirPath}/${entry.name}`.replace(/\\/g, '/'),
            type: entry.type,
            expanded: false,
            children: entry.type === 'directory' ? [] : undefined,
            size: entry.size,
            mtime: entry.mtime,
          }))
        setTree(nodes)
        setRootPath(dirPath)
        fetchGitStatus(dirPath)
      }
    } catch (error) {
      console.error('Failed to load directory:', error)
    } finally {
      setLoading(false)
    }
  }, [fetchGitStatus, showHiddenFiles, sortEntries, needsStats])

  // Helper: build entries into FileNode[]
  const buildNodes = useCallback((dirPath: string, entries: Array<{ name: string; type: 'file' | 'directory'; size?: number; mtime?: number }>): FileNode[] => {
    return entries
      .filter((entry) => showHiddenFiles || !entry.name.startsWith('.'))
      .sort(sortEntries)
      .map((entry) => ({
        name: entry.name,
        path: `${dirPath}/${entry.name}`.replace(/\\/g, '/'),
        type: entry.type,
        expanded: false,
        children: entry.type === 'directory' ? [] : undefined,
        size: entry.size,
        mtime: entry.mtime,
      }))
  }, [showHiddenFiles, sortEntries])

  // Collect expanded paths from tree
  const collectExpandedPaths = useCallback((nodes: FileNode[]): Set<string> => {
    const expanded = new Set<string>()
    const walk = (items: FileNode[]) => {
      for (const node of items) {
        if (node.expanded) {
          expanded.add(node.path)
          if (node.children) walk(node.children)
        }
      }
    }
    walk(nodes)
    return expanded
  }, [])

  // Refresh tree preserving expanded state
  const refreshTree = useCallback(async () => {
    if (!rootPath) return
    const expandedPaths = collectExpandedPaths(tree)

    // Rebuild tree recursively, re-expanding previously expanded dirs
    const rebuildDir = async (dirPath: string): Promise<FileNode[]> => {
      const entries = await window.fileSystem?.readDirectory(dirPath, needsStats)
      if (!entries) return []
      const nodes = buildNodes(dirPath, entries)
      // Re-expand previously expanded directories
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].type === 'directory' && expandedPaths.has(nodes[i].path)) {
          const children = await rebuildDir(nodes[i].path)
          nodes[i] = { ...nodes[i], expanded: true, children }
        }
      }
      return nodes
    }

    const newTree = await rebuildDir(rootPath)
    setTree(newTree)
    fetchGitStatus(rootPath)
  }, [rootPath, tree, buildNodes, collectExpandedPaths, fetchGitStatus])

  // Collapse all expanded directories
  const collapseAll = useCallback(() => {
    setTree((prevTree) => {
      const collapse = (nodes: FileNode[]): FileNode[] =>
        nodes.map(n => ({
          ...n,
          expanded: false,
          children: n.children ? collapse(n.children) : undefined,
        }))
      return collapse(prevTree)
    })
  }, [])

  const toggleDirectory = useCallback(async (path: string) => {
    setTree((prevTree) => {
      const updateNode = (nodes: FileNode[]): FileNode[] => {
        return nodes.map((node) => {
          if (node.path === path) {
            if (!node.expanded && node.children?.length === 0) {
              // Load children asynchronously
              isExpandingRef.current = true
              window.fileSystem?.readDirectory(path, needsStats).then((entries: Array<{ name: string; type: 'file' | 'directory'; size?: number; mtime?: number }>) => {
                isExpandingRef.current = false
                if (entries) {
                  const children: FileNode[] = entries
                    .filter((entry) => showHiddenFiles || !entry.name.startsWith('.'))
                    .sort(sortEntries)
                    .map((entry) => ({
                      name: entry.name,
                      path: `${path}/${entry.name}`.replace(/\\/g, '/'),
                      type: entry.type,
                      expanded: false,
                      children: entry.type === 'directory' ? [] : undefined,
                      size: entry.size,
                      mtime: entry.mtime,
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
  }, [showHiddenFiles, sortEntries, needsStats])

  // Click handler with Shift/Ctrl multi-select support
  const handleItemClick = useCallback((e: React.MouseEvent, path: string, type: 'file' | 'directory') => {
    if (e.shiftKey && anchorPathRef.current) {
      // Shift+Click: range select from anchor to clicked item
      const visible = flattenVisibleNodes(tree)
      const anchorIdx = visible.findIndex(n => n.path === anchorPathRef.current)
      const clickIdx = visible.findIndex(n => n.path === path)
      if (anchorIdx !== -1 && clickIdx !== -1) {
        const start = Math.min(anchorIdx, clickIdx)
        const end = Math.max(anchorIdx, clickIdx)
        const rangePaths = visible.slice(start, end + 1).map(n => n.path)
        setSelectedPaths(new Set(rangePaths))
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: toggle individual selection
      setSelectedPaths(prev => {
        const next = new Set(prev)
        if (next.has(path)) {
          next.delete(path)
        } else {
          next.add(path)
        }
        return next
      })
      anchorPathRef.current = path
    } else {
      // Normal click: single select
      setSelectedPaths(new Set([path]))
      anchorPathRef.current = path
    }
    setSelectedType(type)
    if (type === 'file' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      onFileSelect?.(path)
    }
  }, [onFileSelect, tree])

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent, targetPath: string, targetType: 'file' | 'directory' | 'background') => {
    e.preventDefault()
    e.stopPropagation()
    explorerRef.current?.focus()
    // Add to selection if not already selected, otherwise keep multi-selection
    if (targetPath && !selectedPaths.has(targetPath)) {
      setSelectedPaths(new Set([targetPath]))
      anchorPathRef.current = targetPath
    }
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
  }, [selectedPaths])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }))
  }, [])

  // Copy selected file/folder(s)
  const handleCopy = useCallback(async () => {
    if (selectedPaths.size > 0) {
      const paths = Array.from(selectedPaths)
      setClipboardState({ paths, operation: 'copy' })
      await window.clipboard?.writeFiles(paths)
    }
    closeContextMenu()
  }, [selectedPaths, closeContextMenu])

  // Cut selected file/folder(s)
  const handleCut = useCallback(async () => {
    if (selectedPaths.size > 0) {
      const paths = Array.from(selectedPaths)
      setClipboardState({ paths, operation: 'cut' })
      await window.clipboard?.writeFiles(paths)
    }
    closeContextMenu()
  }, [selectedPaths, closeContextMenu])

  // Paste from clipboard
  const handlePaste = useCallback(async () => {
    closeContextMenu()

    // Determine destination directory
    // Only use contextMenu target when menu is actually open (right-click paste)
    // Otherwise use current selectedPath (keyboard Ctrl+V)
    let destDir = rootPath

    if (contextMenu.isOpen && contextMenu.targetPath) {
      if (contextMenu.targetType === 'directory') {
        destDir = contextMenu.targetPath
      } else {
        destDir = getParentDirectory(contextMenu.targetPath)
      }
    } else if (selectedPaths.size > 0) {
      // Use last selected path as destination hint
      const lastSelected = Array.from(selectedPaths).pop()!
      if (selectedType === 'directory') {
        destDir = lastSelected
      } else {
        destDir = getParentDirectory(lastSelected)
      }
    }

    // Determine source: internal clipboard state vs system clipboard
    let sourcePaths: string[] = []
    let isInternalCut = false

    // Check if internal clipboard has a pending cut/copy operation
    if (clipboardState.paths.length > 0 && clipboardState.operation) {
      sourcePaths = clipboardState.paths
      isInternalCut = clipboardState.operation === 'cut'
    } else {
      // Fallback to system clipboard (for external copy from Windows Explorer etc.)
      try {
        const systemFiles = await window.clipboard?.readFiles()
        if (systemFiles && systemFiles.length > 0) {
          sourcePaths = systemFiles
        }
      } catch {
        // Error reading system clipboard
      }
    }

    if (sourcePaths.length === 0) {
      return
    }

    // Copy/move each file
    for (const sourcePath of sourcePaths) {
      const basename = getBasename(sourcePath)
      let destPath = joinPath(destDir, basename)

      // Prevent pasting into itself
      if (sourcePath === destDir || destDir.startsWith(sourcePath + '/')) {
        continue
      }

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

      // Only delete source for internal cut operation (not system clipboard paste)
      if (isInternalCut) {
        await window.fileSystem?.delete(sourcePath)
      }
    }

    // Clear clipboard state if it was a cut operation
    if (isInternalCut) {
      setClipboardState({ paths: [], operation: null })
    }

    // Refresh to show pasted files (preserve expanded state)
    refreshTree()
  }, [contextMenu, clipboardState, rootPath, selectedPaths, selectedType, closeContextMenu, refreshTree])

  // Create new file - open name dialog first
  const handleNewFile = useCallback(() => {
    closeContextMenu()
    let targetDir = rootPath
    if (contextMenu.targetType === 'directory') {
      targetDir = contextMenu.targetPath
    } else if (contextMenu.targetPath) {
      targetDir = getParentDirectory(contextMenu.targetPath)
    }
    setCreateState({ type: 'file', targetDir })
  }, [contextMenu, rootPath, closeContextMenu])

  // Create new folder - open name dialog first
  const handleNewFolder = useCallback(() => {
    closeContextMenu()
    let targetDir = rootPath
    if (contextMenu.targetType === 'directory') {
      targetDir = contextMenu.targetPath
    } else if (contextMenu.targetPath) {
      targetDir = getParentDirectory(contextMenu.targetPath)
    }
    setCreateState({ type: 'folder', targetDir })
  }, [contextMenu, rootPath, closeContextMenu])

  // Confirm create - actually create the file/folder
  const confirmCreate = useCallback(async (name: string) => {
    if (!createState || !name.trim()) return
    const newPath = joinPath(createState.targetDir, name.trim())

    if (await window.fileSystem?.exists(newPath)) {
      alert(`"${name.trim()}" already exists.`)
      return
    }

    if (createState.type === 'file') {
      await window.fileSystem?.writeFile(newPath, '')
    } else {
      await window.fileSystem?.createDirectory(newPath)
    }

    setCreateState(null)
    refreshTree()
  }, [createState, refreshTree])

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
      refreshTree()
    }

    setRenameState(null)
  }, [renameState, rootPath, refreshTree])

  // Delete file/folder(s) - supports multi-select
  const handleDelete = useCallback(async () => {
    closeContextMenu()
    // Determine paths to delete: use selected paths if multiple, else context menu target
    const pathsToDelete = selectedPaths.size > 1
      ? Array.from(selectedPaths)
      : contextMenu.targetPath ? [contextMenu.targetPath] : Array.from(selectedPaths)

    if (pathsToDelete.length === 0) return

    const message = pathsToDelete.length === 1
      ? `Are you sure you want to delete "${getBasename(pathsToDelete[0])}"?`
      : `Are you sure you want to delete ${pathsToDelete.length} items?`

    if (confirm(message)) {
      for (const p of pathsToDelete) {
        await window.fileSystem?.delete(p)
      }
      setSelectedPaths(new Set())
      refreshTree()
    }
  }, [contextMenu, selectedPaths, closeContextMenu, refreshTree])

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if explorer is focused or active element is body
      const explorerFocused = explorerRef.current?.contains(document.activeElement)
      const bodyFocused = document.activeElement === document.body
      if (!explorerFocused && !bodyFocused) return

      // If user has text selected (e.g. in file viewer), let browser handle copy natively
      const textSelection = window.getSelection()
      const hasTextSelection = textSelection && textSelection.toString().length > 0

      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        if (hasTextSelection) return  // Allow native copy
        e.preventDefault()
        if (selectedPaths.size > 0) {
          const paths = Array.from(selectedPaths)
          setClipboardState({ paths, operation: 'copy' })
          window.clipboard?.writeFiles(paths)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
        if (hasTextSelection) return  // Allow native cut
        e.preventDefault()
        if (selectedPaths.size > 0) {
          const paths = Array.from(selectedPaths)
          setClipboardState({ paths, operation: 'cut' })
          window.clipboard?.writeFiles(paths)
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault()
        handlePaste()
      } else if (e.key === 'Delete') {
        e.preventDefault()
        if (selectedPaths.size > 0) {
          const paths = Array.from(selectedPaths)
          const message = paths.length === 1
            ? `Are you sure you want to delete "${getBasename(paths[0])}"?`
            : `Are you sure you want to delete ${paths.length} items?`
          if (confirm(message)) {
            Promise.all(paths.map(p => window.fileSystem?.delete(p))).then(() => {
              refreshTree()
              setSelectedPaths(new Set())
            })
          }
        }
      } else if (e.key === 'F2' && selectedPaths.size === 1) {
        e.preventDefault()
        const path = Array.from(selectedPaths)[0]
        setRenameState({ path, name: getBasename(path) })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedPaths, handlePaste, refreshTree])

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

  // Close sort menu when clicking outside
  useEffect(() => {
    if (!showSortMenu) return
    const handleClick = () => setShowSortMenu(false)
    const timeoutId = setTimeout(() => window.addEventListener('click', handleClick), 10)
    return () => { clearTimeout(timeoutId); window.removeEventListener('click', handleClick) }
  }, [showSortMenu])

  // Normalize path for comparison
  const normalizePath = useCallback((p: string): string => {
    return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  }, [])

  // Track last explorerPath to detect tab switches
  const lastExplorerPathRef = useRef<string | undefined>(explorerPath)
  const loadedPathRef = useRef<string | null>(null)

  // Load directory when explorerPath changes (tab switch or manual selection)
  useEffect(() => {
    if (!isOpen) return

    // 탭 전환 감지: explorerPath가 변경되었을 때
    const explorerPathChanged = lastExplorerPathRef.current !== explorerPath
    lastExplorerPathRef.current = explorerPath

    // explorerPath가 있으면 tree 모드, 없으면 welcome
    if (explorerPath) {
      setViewMode('tree')
      const normalizedTarget = normalizePath(explorerPath)
      const normalizedLoaded = loadedPathRef.current ? normalizePath(loadedPathRef.current) : ''
      // Only load if path actually changed
      if (explorerPathChanged && normalizedTarget !== normalizedLoaded) {
        loadedPathRef.current = explorerPath
        loadDirectory(explorerPath)
      } else if (!loadedPathRef.current) {
        // Initial load
        loadedPathRef.current = explorerPath
        loadDirectory(explorerPath)
      }
    } else if (explorerPathChanged) {
      // explorerPath가 undefined로 변경 → welcome으로 전환
      setViewMode('welcome')
      loadedPathRef.current = null
    }
  }, [isOpen, explorerPath, loadDirectory, normalizePath])

  // Reload tree when showHiddenFiles changes
  useEffect(() => {
    if (rootPath) {
      refreshTree()
    }
  }, [showHiddenFiles]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload tree when sort mode changes
  useEffect(() => {
    if (rootPath) {
      refreshTree()
    }
  }, [sortMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // File watcher: auto-refresh on external file changes
  const watchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!rootPath) return

    window.fileSystem?.watch(rootPath)

    const unsub = window.fileSystem?.onFsChange((_dirPath, _eventType, _filename) => {
      // Debounce rapid file changes (e.g., during build, Claude edits)
      if (watchDebounceRef.current) clearTimeout(watchDebounceRef.current)
      watchDebounceRef.current = setTimeout(() => {
        if (!isExpandingRef.current) {
          refreshTree()
        }
      }, 500)
    })

    return () => {
      window.fileSystem?.unwatch(rootPath)
      unsub?.()
      if (watchDebounceRef.current) clearTimeout(watchDebounceRef.current)
    }
  }, [rootPath]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ref to prevent refresh during folder expansion
  const isExpandingRef = useRef<boolean>(false)

  if (!isOpen) return null

  // Navigate to folder (switches from welcome to tree view)
  const navigateToFolder = (path: string) => {
    setViewMode('tree')
    loadDirectory(path)
  }

  if (viewMode === 'welcome') {
    return (
      <ExplorerWelcome
        onClose={onClose}
        onOpenFolder={onOpenFolder}
        onGitClone={onGitClone}
        onExplorerPathChange={onExplorerPathChange}
        onNavigateToFolder={navigateToFolder}
      />
    )
  }

  // Filter tree recursively: keep nodes whose name matches, plus ancestors
  const filterTreeFn = (nodes: FileNode[], query: string): FileNode[] => {
    if (!query) return nodes
    const q = query.toLowerCase()
    return nodes.reduce<FileNode[]>((acc, node) => {
      const nameMatch = node.name.toLowerCase().includes(q)
      if (node.type === 'directory' && node.children) {
        const filteredChildren = filterTreeFn(node.children, query)
        if (nameMatch || filteredChildren.length > 0) {
          acc.push({ ...node, children: filteredChildren, expanded: filteredChildren.length > 0 })
        }
      } else if (nameMatch) {
        acc.push(node)
      }
      return acc
    }, [])
  }

  const displayTree = filterQuery ? filterTreeFn(tree, filterQuery) : tree

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
                addRecentFolder(folderPath)
                // 탭별 탐색기 경로 저장
                onExplorerPathChange?.(folderPath)
                loadDirectory(folderPath)
                onOpenFolder?.(folderPath)
              }
            }}
            title="Open Folder"
          >
            {Icons.openFolder}
          </button>
          <button
            className={`explorer-action-btn ${showHiddenFiles ? 'active' : ''}`}
            onClick={() => setShowHiddenFiles(!showHiddenFiles)}
            title={showHiddenFiles ? 'Hide Hidden Files' : 'Show Hidden Files'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {showHiddenFiles ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              )}
            </svg>
          </button>
          <button
            className="explorer-action-btn"
            onClick={collapseAll}
            title="Collapse All"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
          <div className="explorer-sort-wrapper">
            <button
              className={`explorer-action-btn ${showSortMenu ? 'active' : ''}`}
              onClick={() => setShowSortMenu(prev => !prev)}
              title={`Sort by: ${sortMode}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="16" y2="12" />
                <line x1="4" y1="18" x2="12" y2="18" />
              </svg>
            </button>
            {showSortMenu && (
              <div className="explorer-sort-menu">
                {([['name', 'Name'], ['type', 'Type'], ['date', 'Date Modified'], ['size', 'Size']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    className={`explorer-sort-item ${sortMode === mode ? 'active' : ''}`}
                    onClick={() => { setSortMode(mode); setShowSortMenu(false) }}
                  >
                    {sortMode === mode && <span className="sort-check">&#10003;</span>}
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className={`explorer-action-btn ${showFilter ? 'active' : ''}`}
            onClick={() => {
              setShowFilter(prev => !prev)
              if (!showFilter) setTimeout(() => filterInputRef.current?.focus(), 50)
              else setFilterQuery('')
            }}
            title="Filter Files"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
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
      <div className="file-explorer-path breadcrumb">
        <span
          className="breadcrumb-home"
          onClick={() => {
            onExplorerPathChange?.(undefined)
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
          {Icons.home}
        </span>
        {(() => {
          const normalized = rootPath.replace(/\\/g, '/')
          const parts = normalized.split('/').filter(Boolean)
          // On Windows paths like C:/Users/... first part is "C:"
          return parts.map((part, i) => {
            const fullPath = parts.slice(0, i + 1).join('/')
            // On Windows, add back the slash prefix only if not a drive letter
            const navPath = fullPath.includes(':') ? fullPath : '/' + fullPath
            const isLast = i === parts.length - 1
            return (
              <span key={fullPath} className="breadcrumb-segment">
                <span className="breadcrumb-sep">/</span>
                <span
                  className={`breadcrumb-part ${isLast ? 'current' : ''}`}
                  onClick={() => {
                    if (!isLast) {
                      onExplorerPathChange?.(navPath)
                      loadDirectory(navPath)
                    }
                  }}
                  title={navPath}
                >
                  {part}
                </span>
              </span>
            )
          })
        })()}
        {gitBranch && (
          <span className="git-branch-badge" title={`Branch: ${gitBranch}`}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="6" y1="3" x2="6" y2="15" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>
            {gitBranch}
          </span>
        )}
      </div>
      {showFilter && (
        <div className="file-explorer-filter-bar">
          <input
            ref={filterInputRef}
            type="text"
            className="file-explorer-filter-input"
            placeholder="Filter files..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setFilterQuery('')
                setShowFilter(false)
              }
            }}
          />
          {filterQuery && (
            <button
              className="file-explorer-filter-clear"
              onClick={() => { setFilterQuery(''); filterInputRef.current?.focus() }}
            >
              {Icons.close}
            </button>
          )}
        </div>
      )}
      <div className="file-explorer-tree" onClick={() => explorerRef.current?.focus()}>
        {loading ? (
          <div className="file-explorer-loading">Loading...</div>
        ) : displayTree.length === 0 ? (
          <div className="file-explorer-empty">{filterQuery ? 'No matches found' : 'No files found'}</div>
        ) : (
          displayTree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              onToggle={toggleDirectory}
              onClick={handleItemClick}
              onContextMenu={handleContextMenu}
              selectedPaths={selectedPaths}
              cutPaths={clipboardState.operation === 'cut' ? clipboardState.paths : []}
              gitStatusMap={gitStatusMap}
              gitIgnoredSet={gitIgnoredSet}
            />
          ))
        )}
      </div>
      {selectedPaths.size > 1 && (
        <div className="file-explorer-selection-bar">
          {selectedPaths.size} items selected
        </div>
      )}

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
          {contextMenu.targetPath && (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  const targetPath = contextMenu.targetPath
                  closeContextMenu()
                  const pathStr = targetPath.includes(' ') ? `@"${targetPath}" ` : `@${targetPath} `
                  window.dispatchEvent(new CustomEvent('insert-to-input', { detail: pathStr }))
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12h8" />
                  <path d="M12 8v8" />
                </svg>
                <span>Add to Claude</span>
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

      {/* Create File/Folder Dialog */}
      {createState && (
        <div className="rename-dialog-overlay" onClick={() => setCreateState(null)}>
          <div className="rename-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>{createState.type === 'file' ? 'New File' : 'New Folder'}</h3>
            <input
              type="text"
              placeholder={createState.type === 'file' ? 'filename.txt' : 'Folder Name'}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  confirmCreate((e.target as HTMLInputElement).value)
                } else if (e.key === 'Escape') {
                  setCreateState(null)
                }
              }}
            />
            <div className="rename-dialog-actions">
              <button onClick={() => setCreateState(null)}>Cancel</button>
              <button
                className="primary"
                onClick={(e) => {
                  const input = (e.target as HTMLButtonElement).parentElement?.previousElementSibling as HTMLInputElement
                  confirmCreate(input.value)
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
