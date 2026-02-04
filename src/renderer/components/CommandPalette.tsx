import { useState, useEffect, useCallback, useRef } from 'react'

interface Command {
  id: string
  name: string
  command: string
  shortcut?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectCommand: (command: string) => void
}

// Default commands - can be extended later with user-defined commands
const defaultCommands: Command[] = [
  {
    id: 'claude-full',
    name: 'Claude Code (Full)',
    command: 'claude --dangerously-skip-permissions',
    shortcut: 'Ctrl+Shift+C',
  },
  {
    id: 'claude-chrome',
    name: 'Claude Code + Chrome',
    command: 'claude --dangerously-skip-permissions --chrome',
  },
  {
    id: 'claude-resume',
    name: 'Claude Code Resume',
    command: 'claude --resume',
  },
  {
    id: 'claude-continue',
    name: 'Claude Code Continue',
    command: 'claude --continue',
  },
  {
    id: 'ps-execution-policy',
    name: 'PowerShell: Set Execution Policy',
    command: 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser',
  },
  {
    id: 'chcp-utf8',
    name: 'CMD: Set UTF-8 Encoding',
    command: 'chcp 65001',
  },
  {
    id: 'ps-utf8',
    name: 'PowerShell: Set UTF-8 Encoding',
    command: '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8',
  },
  {
    id: 'git-status',
    name: 'Git Status',
    command: 'git status',
  },
  {
    id: 'git-log',
    name: 'Git Log (oneline)',
    command: 'git log --oneline -10',
  },
  {
    id: 'npm-dev',
    name: 'NPM Dev',
    command: 'npm run dev',
  },
  {
    id: 'npm-install',
    name: 'NPM Install',
    command: 'npm install',
  },
]

export default function CommandPalette({ isOpen, onClose, onSelectCommand }: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredCommands = defaultCommands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(search.toLowerCase()) ||
      cmd.command.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          onSelectCommand(filteredCommands[selectedIndex].command)
          onClose()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [filteredCommands, selectedIndex, onSelectCommand, onClose]
  )

  if (!isOpen) return null

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-header">
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type to search commands..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="command-palette-list">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">No commands found</div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => {
                  onSelectCommand(cmd.command)
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="command-palette-item-name">{cmd.name}</div>
                <div className="command-palette-item-command">{cmd.command}</div>
                {cmd.shortcut && (
                  <div className="command-palette-item-shortcut">{cmd.shortcut}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
