import { useMemo } from 'react'
import { useSettingsStore, ShellType } from '../store/settings'
import { useThemeStore } from '../store/theme'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  projectPath?: string
}

export default function SettingsPanel({ isOpen, onClose, projectPath }: SettingsPanelProps) {
  const {
    showThinking,
    autoScroll,
    compactMode,
    shell,
    setShowThinking,
    setAutoScroll,
    setCompactMode,
    setShell,
  } = useSettingsStore()

  // Detect platform
  const isWindows = useMemo(() => navigator.platform.toLowerCase().includes('win'), [])

  const { themeName, themes, setTheme, setFontSize, currentTheme } = useThemeStore()

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
        {/* Theme */}
        <section className="settings-section">
          <h3>Terminal Theme</h3>
          <div className="theme-options">
            {Object.entries(themes).map(([key, theme]) => (
              <button
                key={key}
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
            ))}
          </div>
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

    </div>
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
