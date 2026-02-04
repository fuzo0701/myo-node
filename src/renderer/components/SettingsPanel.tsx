import { useState, useMemo } from 'react'
import { useSettingsStore, RenderMode, ShellType } from '../store/settings'
import { useThemeStore } from '../store/theme'
import ThemeEditor from './ThemeEditor'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const {
    renderMode,
    showThinking,
    autoScroll,
    compactMode,
    shell,
    setRenderMode,
    setShowThinking,
    setAutoScroll,
    setCompactMode,
    setShell,
  } = useSettingsStore()

  // Detect platform
  const isWindows = useMemo(() => navigator.platform.toLowerCase().includes('win'), [])

  const { themeName, themes, customThemes, setTheme, setFontSize, currentTheme, deleteCustomTheme, duplicateTheme } = useThemeStore()
  const [themeEditorOpen, setThemeEditorOpen] = useState(false)
  const [editingThemeKey, setEditingThemeKey] = useState<string | null>(null)

  const allThemes = { ...themes, ...customThemes }
  const customThemeKeys = Object.keys(customThemes)

  const handleCreateTheme = () => {
    setEditingThemeKey(null)
    setThemeEditorOpen(true)
  }

  const handleEditTheme = (key: string) => {
    setEditingThemeKey(key)
    setThemeEditorOpen(true)
  }

  const handleDuplicateTheme = (key: string) => {
    const sourceTheme = allThemes[key]
    if (sourceTheme) {
      const newKey = duplicateTheme(key, `${sourceTheme.name} Copy`)
      if (newKey) {
        setTheme(newKey)
      }
    }
  }

  const handleDeleteTheme = (key: string) => {
    if (confirm('Are you sure you want to delete this theme?')) {
      deleteCustomTheme(key)
    }
  }

  if (!isOpen) return null

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <h2>Settings</h2>
        <button className="close-btn" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="settings-content">
        {/* Render Mode */}
        <section className="settings-section">
          <h3>Render Mode</h3>
          <p className="settings-description">
            How Claude's output is displayed
          </p>
          <div className="render-mode-options">
            <RenderModeOption
              mode="terminal"
              label="Terminal Only"
              description="Classic terminal output"
              icon="⬛"
              selected={renderMode === 'terminal'}
              onSelect={() => setRenderMode('terminal')}
            />
            <RenderModeOption
              mode="hybrid"
              label="Hybrid"
              description="Terminal + rendered Claude output"
              icon="◧"
              selected={renderMode === 'hybrid'}
              onSelect={() => setRenderMode('hybrid')}
            />
            <RenderModeOption
              mode="rendered"
              label="Rendered"
              description="Full markdown rendering"
              icon="◻"
              selected={renderMode === 'rendered'}
              onSelect={() => setRenderMode('rendered')}
            />
          </div>
        </section>

        {/* Theme */}
        <section className="settings-section">
          <h3>Terminal Theme</h3>
          <div className="theme-options">
            {Object.entries(themes).map(([key, theme]) => (
              <div key={key} className="theme-option-wrapper">
                <button
                  className={`theme-option ${themeName === key ? 'selected' : ''}`}
                  onClick={() => setTheme(key)}
                  style={{
                    background: theme.background,
                    color: theme.foreground,
                    borderColor: themeName === key ? theme.cursor : 'var(--border)',
                    boxShadow: themeName === key ? `0 0 15px ${theme.cursor}40` : 'none',
                  }}
                >
                  {theme.name}
                </button>
                <button
                  className="theme-action-btn duplicate"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDuplicateTheme(key)
                  }}
                  title="Duplicate"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Custom Themes */}
        <section className="settings-section">
          <div className="section-header-row">
            <h3>Custom Themes</h3>
            <button className="create-theme-btn" onClick={handleCreateTheme}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New
            </button>
          </div>
          {customThemeKeys.length > 0 ? (
            <div className="theme-options">
              {customThemeKeys.map((key) => {
                const theme = customThemes[key]
                return (
                  <div key={key} className="theme-option-wrapper custom">
                    <button
                      className={`theme-option ${themeName === key ? 'selected' : ''}`}
                      onClick={() => setTheme(key)}
                      style={{
                        background: theme.background,
                        color: theme.foreground,
                        borderColor: themeName === key ? theme.cursor : 'var(--border)',
                        boxShadow: themeName === key ? `0 0 15px ${theme.cursor}40` : 'none',
                      }}
                    >
                      {theme.name}
                    </button>
                    <div className="theme-actions">
                      <button
                        className="theme-action-btn edit"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEditTheme(key)
                        }}
                        title="Edit"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        className="theme-action-btn duplicate"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDuplicateTheme(key)
                        }}
                        title="Duplicate"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                      </button>
                      <button
                        className="theme-action-btn delete"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteTheme(key)
                        }}
                        title="Delete"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3,6 5,6 21,6"/>
                          <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="no-custom-themes">
              <p>No custom themes yet</p>
              <p className="hint">Click "New" to create your own theme</p>
            </div>
          )}
        </section>

        {/* Font Size */}
        <section className="settings-section">
          <h3>Font Size</h3>
          <div className="font-size-control">
            <button
              className="font-size-btn"
              onClick={() => setFontSize(Math.max(10, currentTheme.fontSize - 1))}
            >
              -
            </button>
            <span className="font-size-value">{currentTheme.fontSize}px</span>
            <button
              className="font-size-btn"
              onClick={() => setFontSize(Math.min(24, currentTheme.fontSize + 1))}
            >
              +
            </button>
          </div>
        </section>

        {/* Shell Selection */}
        <section className="settings-section">
          <h3>Default Shell</h3>
          <p className="settings-description">
            Select the default shell for new terminals
          </p>
          <div className="shell-options">
            <ShellOption
              shell="default"
              label="System Default"
              description={isWindows ? 'PowerShell' : 'System shell'}
              selected={shell === 'default'}
              onSelect={() => setShell('default')}
            />
            {isWindows ? (
              <>
                <ShellOption
                  shell="powershell"
                  label="PowerShell"
                  description="Windows PowerShell"
                  selected={shell === 'powershell'}
                  onSelect={() => setShell('powershell')}
                />
                <ShellOption
                  shell="cmd"
                  label="CMD"
                  description="Command Prompt"
                  selected={shell === 'cmd'}
                  onSelect={() => setShell('cmd')}
                />
              </>
            ) : (
              <>
                <ShellOption
                  shell="bash"
                  label="Bash"
                  description="Bourne Again Shell"
                  selected={shell === 'bash'}
                  onSelect={() => setShell('bash')}
                />
                <ShellOption
                  shell="zsh"
                  label="Zsh"
                  description="Z Shell"
                  selected={shell === 'zsh'}
                  onSelect={() => setShell('zsh')}
                />
              </>
            )}
          </div>
          <p className="settings-hint">
            Changes apply to new terminals only
          </p>
        </section>

        {/* Display Options */}
        <section className="settings-section">
          <h3>Display Options</h3>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={showThinking}
              onChange={(e) => setShowThinking(e.target.checked)}
            />
            <span className="toggle-label">Show thinking blocks</span>
          </label>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            <span className="toggle-label">Auto-scroll to bottom</span>
          </label>
          <label className="toggle-option">
            <input
              type="checkbox"
              checked={compactMode}
              onChange={(e) => setCompactMode(e.target.checked)}
            />
            <span className="toggle-label">Compact mode</span>
          </label>
        </section>
      </div>

      {/* Theme Editor Modal */}
      <ThemeEditor
        isOpen={themeEditorOpen}
        onClose={() => setThemeEditorOpen(false)}
        editingThemeKey={editingThemeKey}
      />
    </div>
  )
}

interface RenderModeOptionProps {
  mode: RenderMode
  label: string
  description: string
  icon: string
  selected: boolean
  onSelect: () => void
}

function RenderModeOption({
  label,
  description,
  icon,
  selected,
  onSelect,
}: RenderModeOptionProps) {
  return (
    <button
      className={`render-mode-option ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <span className="render-mode-icon">{icon}</span>
      <span className="render-mode-label">{label}</span>
      <span className="render-mode-desc">{description}</span>
    </button>
  )
}

interface ShellOptionProps {
  shell: ShellType
  label: string
  description: string
  selected: boolean
  onSelect: () => void
}

function ShellOption({
  label,
  description,
  selected,
  onSelect,
}: ShellOptionProps) {
  return (
    <button
      className={`shell-option ${selected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <span className="shell-label">{label}</span>
      <span className="shell-desc">{description}</span>
    </button>
  )
}
