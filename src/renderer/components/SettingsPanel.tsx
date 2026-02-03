import { useSettingsStore, RenderMode } from '../store/settings'
import { useThemeStore } from '../store/theme'

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
    setRenderMode,
    setShowThinking,
    setAutoScroll,
    setCompactMode,
  } = useSettingsStore()

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
