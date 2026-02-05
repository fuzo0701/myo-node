import { useState, useCallback } from 'react'
import { useExplorerStore } from '../store/explorer'

interface FullScreenWelcomeProps {
  onFolderSelect: (path: string) => void
  onGitClone: (destPath: string, url: string) => void
}

// SVG Icons
const FolderIcon = (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const OpenFolderIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <polyline points="9 14 12 11 15 14" />
  </svg>
)

const GitIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="18" r="3" />
    <circle cx="6" cy="6" r="3" />
    <path d="M13 6h3a2 2 0 0 1 2 2v7" />
    <line x1="6" y1="9" x2="6" y2="21" />
  </svg>
)

const SmallFolderIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

const CloseIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export default function FullScreenWelcome({ onFolderSelect, onGitClone }: FullScreenWelcomeProps) {
  const { recentFolders, addRecentFolder, removeRecentFolder } = useExplorerStore()
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false)
  const [cloneDestPath, setCloneDestPath] = useState('')
  const [cloneUrl, setCloneUrl] = useState('')

  const handleOpenFolder = useCallback(async () => {
    const folderPath = await window.dialog?.openFolder({ title: 'Open Folder' })
    if (folderPath) {
      addRecentFolder(folderPath)
      onFolderSelect(folderPath)
    }
  }, [addRecentFolder, onFolderSelect])

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
    onGitClone(cloneDestPath, cloneUrl.trim())
    setCloneDialogOpen(false)
  }, [cloneDestPath, cloneUrl, addRecentFolder, onGitClone])

  const handleRecentClick = useCallback((path: string) => {
    addRecentFolder(path)
    onFolderSelect(path)
  }, [addRecentFolder, onFolderSelect])

  return (
    <div className="fullscreen-welcome">
      <div className="fullscreen-welcome-content">
        <div className="fullscreen-welcome-hero">
          <div className="fullscreen-welcome-icon">{FolderIcon}</div>
          <h1 className="fullscreen-welcome-title">Myo-node</h1>
          <p className="fullscreen-welcome-desc">
            Select a folder to get started with Claude Code.
          </p>
        </div>

        <div className="fullscreen-welcome-actions">
          <button className="fullscreen-welcome-btn primary" onClick={handleOpenFolder}>
            {OpenFolderIcon}
            <span>Open Folder</span>
          </button>
          <button className="fullscreen-welcome-btn" onClick={handleGitCloneStart}>
            {GitIcon}
            <span>Git Clone</span>
          </button>
        </div>

        {recentFolders.length > 0 && (
          <div className="fullscreen-welcome-recent">
            <div className="fullscreen-welcome-recent-title">Recent Folders</div>
            <div className="fullscreen-welcome-recent-list">
              {recentFolders.map((folder) => (
                <button
                  key={folder.path}
                  className="fullscreen-welcome-recent-item"
                  onClick={() => handleRecentClick(folder.path)}
                >
                  {SmallFolderIcon}
                  <div className="fullscreen-welcome-recent-info">
                    <span className="fullscreen-welcome-recent-name">{folder.name}</span>
                    <span className="fullscreen-welcome-recent-path">{folder.path}</span>
                  </div>
                  <span
                    className="fullscreen-welcome-recent-remove"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeRecentFolder(folder.path)
                    }}
                  >
                    {CloseIcon}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

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
