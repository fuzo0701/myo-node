import { useState, useEffect } from 'react'
import { Theme, useThemeStore, defaultThemes } from '../store/theme'

interface ThemeEditorProps {
  isOpen: boolean
  onClose: () => void
  editingThemeKey?: string | null
}

interface ColorGroup {
  label: string
  colors: { key: keyof Theme; label: string }[]
}

const colorGroups: ColorGroup[] = [
  {
    label: 'Basic Colors',
    colors: [
      { key: 'background', label: 'Background' },
      { key: 'foreground', label: 'Foreground' },
      { key: 'cursor', label: 'Cursor' },
      { key: 'cursorAccent', label: 'Cursor Accent' },
      { key: 'selection', label: 'Selection' },
    ],
  },
  {
    label: 'Normal Colors',
    colors: [
      { key: 'black', label: 'Black' },
      { key: 'red', label: 'Red' },
      { key: 'green', label: 'Green' },
      { key: 'yellow', label: 'Yellow' },
      { key: 'blue', label: 'Blue' },
      { key: 'magenta', label: 'Magenta' },
      { key: 'cyan', label: 'Cyan' },
      { key: 'white', label: 'White' },
    ],
  },
  {
    label: 'Bright Colors',
    colors: [
      { key: 'brightBlack', label: 'Bright Black' },
      { key: 'brightRed', label: 'Bright Red' },
      { key: 'brightGreen', label: 'Bright Green' },
      { key: 'brightYellow', label: 'Bright Yellow' },
      { key: 'brightBlue', label: 'Bright Blue' },
      { key: 'brightMagenta', label: 'Bright Magenta' },
      { key: 'brightCyan', label: 'Bright Cyan' },
      { key: 'brightWhite', label: 'Bright White' },
    ],
  },
]

const defaultNewTheme: Theme = {
  name: 'New Theme',
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#ffffff',
  cursorAccent: '#1e1e1e',
  selection: '#264f78',
  fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  fontSize: 14,
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff',
}

export default function ThemeEditor({ isOpen, onClose, editingThemeKey }: ThemeEditorProps) {
  const { customThemes, addCustomTheme, updateCustomTheme, setTheme } = useThemeStore()
  const [theme, setThemeState] = useState<Theme>(defaultNewTheme)
  const [baseTheme, setBaseTheme] = useState<string>('dark')

  // Load theme when editing
  useEffect(() => {
    if (isOpen) {
      if (editingThemeKey && customThemes[editingThemeKey]) {
        setThemeState(customThemes[editingThemeKey])
      } else {
        setThemeState({ ...defaultNewTheme, name: 'New Theme' })
        setBaseTheme('dark')
      }
    }
  }, [isOpen, editingThemeKey, customThemes])

  const handleBaseThemeChange = (key: string) => {
    setBaseTheme(key)
    const source = defaultThemes[key]
    if (source) {
      setThemeState((prev) => ({
        ...source,
        name: prev.name, // Keep the custom name
      }))
    }
  }

  const handleColorChange = (key: keyof Theme, value: string) => {
    setThemeState((prev) => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleNameChange = (name: string) => {
    setThemeState((prev) => ({
      ...prev,
      name,
    }))
  }

  const handleSave = () => {
    if (!theme.name.trim()) {
      alert('Please enter a theme name')
      return
    }

    if (editingThemeKey) {
      updateCustomTheme(editingThemeKey, theme)
      setTheme(editingThemeKey)
    } else {
      const newKey = addCustomTheme(theme)
      setTheme(newKey)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="theme-editor-overlay" onClick={onClose}>
      <div className="theme-editor" onClick={(e) => e.stopPropagation()}>
        <div className="theme-editor-header">
          <h3>{editingThemeKey ? 'Edit Theme' : 'Create New Theme'}</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="theme-editor-content">
          {/* Theme Name */}
          <div className="theme-editor-section">
            <label className="theme-editor-label">Theme Name</label>
            <input
              type="text"
              className="theme-editor-input"
              value={theme.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter theme name"
            />
          </div>

          {/* Base Theme (only for new themes) */}
          {!editingThemeKey && (
            <div className="theme-editor-section">
              <label className="theme-editor-label">Start from</label>
              <div className="base-theme-options">
                {Object.entries(defaultThemes).map(([key, t]) => (
                  <button
                    key={key}
                    className={`base-theme-btn ${baseTheme === key ? 'selected' : ''}`}
                    onClick={() => handleBaseThemeChange(key)}
                    style={{
                      background: t.background,
                      color: t.foreground,
                      borderColor: baseTheme === key ? t.cursor : 'var(--border)',
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Color Groups */}
          {colorGroups.map((group) => (
            <div key={group.label} className="theme-editor-section">
              <label className="theme-editor-label">{group.label}</label>
              <div className="color-grid">
                {group.colors.map(({ key, label }) => (
                  <div key={key} className="color-picker-item">
                    <div className="color-picker-wrapper">
                      <input
                        type="color"
                        value={String(theme[key]).replace(/rgba?\([^)]+\)/, '#000000')}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="color-picker-input"
                      />
                      <div
                        className="color-preview"
                        style={{ backgroundColor: String(theme[key]) }}
                      />
                    </div>
                    <span className="color-label">{label}</span>
                    <input
                      type="text"
                      className="color-hex-input"
                      value={String(theme[key])}
                      onChange={(e) => handleColorChange(key, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Preview */}
          <div className="theme-editor-section">
            <label className="theme-editor-label">Preview</label>
            <div
              className="theme-preview"
              style={{
                background: theme.background,
                color: theme.foreground,
              }}
            >
              <div className="preview-line">
                <span style={{ color: theme.green }}>user@terminal</span>
                <span style={{ color: theme.white }}>:</span>
                <span style={{ color: theme.blue }}>~/projects</span>
                <span style={{ color: theme.white }}>$</span>
                <span
                  style={{
                    backgroundColor: theme.cursor,
                    color: theme.cursorAccent,
                    padding: '0 2px',
                  }}
                >
                  _
                </span>
              </div>
              <div className="preview-line">
                <span style={{ color: theme.yellow }}>npm</span>
                <span> run dev</span>
              </div>
              <div className="preview-line">
                <span style={{ color: theme.cyan }}>info</span>
                <span> Starting development server...</span>
              </div>
              <div className="preview-line">
                <span style={{ color: theme.green }}>success</span>
                <span> Compiled successfully!</span>
              </div>
              <div className="preview-line">
                <span style={{ color: theme.red }}>error</span>
                <span> Something went wrong</span>
              </div>
              <div className="preview-line">
                <span style={{ color: theme.magenta }}>warning</span>
                <span> Deprecated API detected</span>
              </div>
              <div
                className="preview-selection"
                style={{ backgroundColor: theme.selection }}
              >
                Selected text example
              </div>
            </div>
          </div>
        </div>

        <div className="theme-editor-footer">
          <button className="theme-editor-btn cancel" onClick={onClose}>
            Cancel
          </button>
          <button className="theme-editor-btn save" onClick={handleSave}>
            {editingThemeKey ? 'Save Changes' : 'Create Theme'}
          </button>
        </div>
      </div>
    </div>
  )
}
