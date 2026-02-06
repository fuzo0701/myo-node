import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { paletteCommands, slashCommands, categoryLabels, categoryOrder, CommandSuggestion } from '../data/commands'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectCommand: (command: string) => void
}

// Combine all commands
const allCommands: CommandSuggestion[] = [...paletteCommands, ...slashCommands]

export default function CommandPalette({ isOpen, onClose, onSelectCommand }: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSlashOnly, setShowSlashOnly] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    const searchLower = search.toLowerCase()
    const isSlashSearch = search.startsWith('/')

    let commands = allCommands

    // If search starts with /, only show slash commands
    if (isSlashSearch || showSlashOnly) {
      commands = slashCommands
    }

    if (!search) return commands

    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(searchLower) ||
        cmd.command.toLowerCase().includes(searchLower) ||
        cmd.description?.toLowerCase().includes(searchLower)
    )
  }, [search, showSlashOnly])

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandSuggestion[]> = {}

    for (const cmd of filteredCommands) {
      const cat = cmd.category || 'other'
      if (!groups[cat]) groups[cat] = []
      groups[cat].push(cmd)
    }

    // Sort by category order
    const sortedGroups: Array<{ category: string; commands: CommandSuggestion[] }> = []
    for (const cat of categoryOrder) {
      if (groups[cat]) {
        sortedGroups.push({ category: cat, commands: groups[cat] })
      }
    }
    // Add any remaining categories
    for (const cat of Object.keys(groups)) {
      if (!categoryOrder.includes(cat)) {
        sortedGroups.push({ category: cat, commands: groups[cat] })
      }
    }

    return sortedGroups
  }, [filteredCommands])

  // Flat list for keyboard navigation
  const flatCommands = useMemo(() => {
    return groupedCommands.flatMap(g => g.commands)
  }, [groupedCommands])

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setShowSlashOnly(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    setSelectedIndex(0)
  }, [search, showSlashOnly])

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && flatCommands.length > 0) {
      const selectedItem = listRef.current.querySelector('.command-palette-item.selected')
      selectedItem?.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex, flatCommands.length])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, flatCommands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (flatCommands[selectedIndex]) {
          onSelectCommand(flatCommands[selectedIndex].command)
          onClose()
        }
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'Tab') {
        e.preventDefault()
        setShowSlashOnly(prev => !prev)
      }
    },
    [flatCommands, selectedIndex, onSelectCommand, onClose]
  )

  if (!isOpen) return null

  let itemIndex = -1

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="command-palette-header">
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder={showSlashOnly ? "Type / command..." : "Type to search commands... (Tab: toggle slash commands)"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            className={`command-palette-toggle ${showSlashOnly ? 'active' : ''}`}
            onClick={() => setShowSlashOnly(prev => !prev)}
            title="Toggle slash commands only (Tab)"
          >
            /
          </button>
        </div>
        <div className="command-palette-list" ref={listRef}>
          {flatCommands.length === 0 ? (
            <div className="command-palette-empty">No commands found</div>
          ) : (
            groupedCommands.map((group) => (
              <div key={group.category} className="command-palette-group">
                <div className="command-palette-group-label">
                  {categoryLabels[group.category] || group.category}
                </div>
                {group.commands.map((cmd) => {
                  itemIndex++
                  const currentIndex = itemIndex
                  return (
                    <div
                      key={cmd.id}
                      className={`command-palette-item ${currentIndex === selectedIndex ? 'selected' : ''}`}
                      onClick={() => {
                        onSelectCommand(cmd.command)
                        onClose()
                      }}
                      onMouseEnter={() => setSelectedIndex(currentIndex)}
                    >
                      {cmd.icon && <span className="command-palette-item-icon">{cmd.icon}</span>}
                      <div className="command-palette-item-content">
                        <div className="command-palette-item-name">{cmd.label}</div>
                        {cmd.description && (
                          <div className="command-palette-item-desc">{cmd.description}</div>
                        )}
                      </div>
                      <div className="command-palette-item-command">{cmd.command}</div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <div className="command-palette-footer">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Tab Toggle /</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
