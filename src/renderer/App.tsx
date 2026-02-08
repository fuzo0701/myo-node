import { useState, useEffect, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import TabBar from './components/TabBar'
import HybridTerminal from './components/HybridTerminal'
import HistoryPanel from './components/HistoryPanel'
import ConversationView from './components/ConversationView'
import SettingsPanel from './components/SettingsPanel'
import SplitPane from './components/SplitPane'
import FileExplorer from './components/FileExplorer'
import FileEditor from './components/FileEditor'
import ResizablePanel from './components/ResizablePanel'
import CommandPalette from './components/CommandPalette'
import FullScreenWelcome from './components/FullScreenWelcome'
import ClaudeSettingsPanel from './components/ClaudeSettingsPanel'
import StatusBar from './components/StatusBar'
import TeamPanel from './components/TeamPanel'
import ConfirmDialog from './components/ConfirmDialog'
import QuickOpen from './components/QuickOpen'
import SearchPanel from './components/SearchPanel'
import TaskPanel from './components/TaskPanel'
import { useTabStore } from './store/tabs'
import { useHistoryStore } from './store/history'
import { useSettingsStore } from './store/settings'
import { useAgentTeamsStore } from './store/agentTeams'

export default function App() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, reorderTabs, restoreSession, updateTabCwd, updateExplorerPath, updateEditingFilePath } = useTabStore()
  const { getConversation, activeConversationId } = useHistoryStore()
  const [splitMode, setSplitModeState] = useState<'none' | 'horizontal' | 'vertical'>('none')
  const [splitSecondTabId, setSplitSecondTabId] = useState<string | null>(null)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [quickOpenOpen, setQuickOpenOpen] = useState(false)
  const [closeConfirmTabId, setCloseConfirmTabId] = useState<string | null>(null)
  const [splitCloseConfirmOpen, setSplitCloseConfirmOpen] = useState(false)

  const renderMode = useSettingsStore((state) => state.renderMode)

  // Get active tab's cwd and explorerPath for file explorer (must be before welcome handlers)
  const activeTab = tabs.find(t => t.id === activeTabId)
  const activeTabCwd = activeTab?.cwd
  const activeExplorerPath = activeTab?.explorerPath

  // Determine if active tab is the dashboard
  const showDashboard = activeTab?.isDashboard === true

  // Send command to active terminal
  const sendCommandToTerminal = useCallback(async (command: string) => {
    // Special command: Enable Agent Teams in settings.json and launch claude
    if (command === '__AGENT_TEAMS__') {
      await window.claude?.writeAgentTeamsConfig({ enabled: true, teammateMode: 'auto' })
      const realCmd = 'claude --dangerously-skip-permissions'
      if (renderMode === 'abstracted') {
        window.dispatchEvent(new CustomEvent('command-from-palette', { detail: realCmd }))
      } else {
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab?.terminalId !== null && tab?.terminalId !== undefined) {
          window.terminal.write(tab.terminalId, realCmd + '\r')
        }
      }
      return
    }

    // Special command: Toggle Task Panel
    if (command === '__TASK_PANEL__') {
      setTaskPanelOpen(prev => !prev)
      return
    }

    // Special command: Switch to dashboard tab
    if (command === '__TEAMS_DASHBOARD__') {
      const dashTab = tabs.find(t => t.isDashboard)
      if (dashTab) setActiveTab(dashTab.id)
      return
    }

    // Special command: Shutdown all teammate terminals (keep lead)
    if (command === '__TEAMS_SHUTDOWN__') {
      const teammateTabs = tabs.filter(t => t.memberRole === 'teammate' && t.terminalId != null)
      for (const t of teammateTabs) {
        window.terminal.kill(t.terminalId!)
        removeTab(t.id)
      }
      return
    }

    if (renderMode === 'abstracted') {
      // In abstracted mode, let HybridTerminal handle it via event
      window.dispatchEvent(new CustomEvent('command-from-palette', { detail: command }))
      return
    }

    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab?.terminalId !== null && activeTab?.terminalId !== undefined) {
      window.terminal.write(activeTab.terminalId, command + '\r')
    }
  }, [tabs, activeTabId, renderMode, setActiveTab, removeTab])

  // Handle folder open - change terminal directory and update tab cwd
  const handleOpenFolder = useCallback((folderPath: string) => {
    // Escape path for shell command
    const escapedPath = folderPath.includes(' ') ? `"${folderPath}"` : folderPath
    // Use pushd instead of cd - works across all shells (CMD, PowerShell, Bash, Zsh)
    // and handles drive changes on Windows (cd alone doesn't change drives in CMD)
    sendCommandToTerminal(`pushd ${escapedPath}`)
    // Update tab's cwd so explorer stays in sync
    if (activeTabId) {
      updateTabCwd(activeTabId, folderPath)
    }
  }, [sendCommandToTerminal, activeTabId, updateTabCwd])

  // Handle git clone - send clone command to terminal
  const handleGitClone = useCallback((destPath: string, url: string) => {
    const escapedPath = destPath.includes(' ') ? `"${destPath}"` : destPath
    const escapedUrl = url.includes(' ') ? `"${url}"` : url
    sendCommandToTerminal(`pushd ${escapedPath} && git clone ${escapedUrl}`)
    if (activeTabId) {
      updateTabCwd(activeTabId, destPath)
    }
  }, [sendCommandToTerminal, activeTabId, updateTabCwd])

  // Focus terminal input after creating a new tab
  const focusTerminal = useCallback(() => {
    setTimeout(() => window.dispatchEvent(new CustomEvent('focus-terminal')), 300)
  }, [])

  // Folder select handler - creates new tab with that folder
  const handleFolderSelectNewTab = useCallback((path: string) => {
    addTab(path, path)
    focusTerminal()
  }, [addTab, focusTerminal])

  // Git clone handler - creates new tab then clones
  const handleGitCloneNewTab = useCallback((destPath: string, url: string) => {
    addTab(destPath, destPath)
    setTimeout(() => {
      const escapedUrl = url.includes(' ') ? `"${url}"` : url
      sendCommandToTerminal(`git clone ${escapedUrl}`)
    }, 1000)
    focusTerminal()
  }, [addTab, sendCommandToTerminal, focusTerminal])

  // Restore session on app startup (clear stale terminal IDs)
  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  // Focus terminal input when window regains focus (e.g., Alt+Tab back)
  useEffect(() => {
    const handleWindowFocus = () => {
      window.dispatchEvent(new CustomEvent('focus-terminal'))
    }
    window.addEventListener('focus', handleWindowFocus)
    return () => window.removeEventListener('focus', handleWindowFocus)
  }, [])

  // Handle Claude Code shortcuts dispatched from TerminalInput
  useEffect(() => {
    const handleToggleTaskList = () => {
      // Claude Code's Ctrl+T: Toggle task list (send to terminal)
      const cmd = '\x14' // Ctrl+T control character
      const activeTab = tabs.find(t => t.id === activeTabId)
      if (activeTab?.terminalId !== null && activeTab?.terminalId !== undefined) {
        window.terminal.write(activeTab.terminalId, cmd)
      }
    }

    const handleOpenInEditor = () => {
      // Claude Code's Ctrl+G: Open in editor (send to terminal)
      const cmd = '\x07' // Ctrl+G control character (BEL)
      const activeTab = tabs.find(t => t.id === activeTabId)
      if (activeTab?.terminalId !== null && activeTab?.terminalId !== undefined) {
        window.terminal.write(activeTab.terminalId, cmd)
      }
    }

    window.addEventListener('toggle-task-list', handleToggleTaskList)
    window.addEventListener('open-in-editor', handleOpenInEditor)

    return () => {
      window.removeEventListener('toggle-task-list', handleToggleTaskList)
      window.removeEventListener('open-in-editor', handleOpenInEditor)
    }
  }, [tabs, activeTabId])

  // Start Agent Teams watcher on mount
  const startWatchingTeams = useAgentTeamsStore(s => s.startWatching)
  const stopWatchingTeams = useAgentTeamsStore(s => s.stopWatching)
  useEffect(() => {
    startWatchingTeams()
    return () => stopWatchingTeams()
  }, [])

  // Auto-sync tabs to teams based on cwd (tmux-style)
  const teams = useAgentTeamsStore(s => s.teams)
  const { setTabTeamInfo } = useTabStore()
  useEffect(() => {
    for (const tab of tabs) {
      // Skip if already connected or is dashboard
      if (tab.teamName || tab.isDashboard || !tab.cwd) continue

      // Find matching team by cwd (like tmux: pane.cwd === session.cwd)
      for (const [teamName, team] of Object.entries(teams)) {
        const leadMember = team.members.find(m =>
          m.agentType === 'lead' || m.agentType === 'orchestrator'
        )

        if (leadMember?.cwd === tab.cwd) {
          // Connect tab to team (like tmux: pane.window reference)
          setTabTeamInfo(tab.id, teamName, 'lead')
          console.log(`✓ Tab "${tab.title}" → Team "${teamName}" (cwd: ${tab.cwd})`)
          break
        }
      }
    }
  }, [teams, tabs, setTabTeamInfo])

  // Wrapper to ensure we have 2 tabs when split mode is activated
  const setSplitMode = useCallback((mode: 'none' | 'horizontal' | 'vertical') => {
    // If closing split mode, auto-delete hidden split panes (no confirmation needed)
    if (mode === 'none' && splitMode !== 'none') {
      if (splitSecondTabId) {
        const secondTab = tabs.find(t => t.id === splitSecondTabId)
        if (secondTab?.isHiddenSplitPane) {
          console.warn(`🗑️ Auto-deleting hidden split pane: ${splitSecondTabId}`)
          removeTab(splitSecondTabId)
        }
      }
      setSplitSecondTabId(null)
      setSplitModeState('none')
      return
    }

    if (mode !== 'none') {
      const nonDashTabs = tabs.filter(t => !t.isDashboard)
      const originalActiveId = activeTabId  // Save original active tab BEFORE addTab

      try {
        const tabsList = nonDashTabs.map(t => `${t.title}(${t.id})`).join(', ')
        console.warn(`🔀 SPLIT MODE START: ${mode}`)
        console.warn(`📊 Current tabs count: ${nonDashTabs.length} - [${tabsList}]`)
        console.warn(`👉 Active tab ID: ${activeTabId}`)

        let needsNewTab = false
        const visibleTabs = nonDashTabs.filter(t => !t.isHiddenSplitPane)

        // Always create a hidden split pane (tmux-style: split creates pane, not new tab)
        console.warn(`➕ Creating hidden split pane (tmux-style)`)
        needsNewTab = true
        const activeTab = tabs.find(t => t.id === activeTabId)
        addTab(activeTab?.cwd, activeTab?.explorerPath, true)  // isHiddenSplitPane = true
      } catch (err) {
        console.error('❌ Error in setSplitMode:', err)
      }

      // Use setTimeout to handle split setup after tab creation completes
      setTimeout(() => {
        // Keep original tab as active (hidden pane on right)
        setActiveTab(originalActiveId!)
        // Get the newly created hidden pane (last non-dashboard tab)
        const updatedNonDashTabs = useTabStore.getState().tabs.filter(t => !t.isDashboard)
        const newPaneId = updatedNonDashTabs[updatedNonDashTabs.length - 1]?.id
        console.warn(`✨ Hidden split pane created: ${newPaneId}`)
        console.warn(`🔄 Active tab remains: ${originalActiveId}`)
        setSplitSecondTabId(newPaneId || null)
      }, 0)
    }
    setSplitModeState(mode)
  }, [tabs, activeTabId, addTab, setActiveTab, splitMode])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [claudeSettingsOpen, setClaudeSettingsOpen] = useState(false)
  const [conversationViewOpen, setConversationViewOpen] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [searchPanelOpen, setSearchPanelOpen] = useState(false)
  const [taskPanelOpen, setTaskPanelOpen] = useState(false)

  // 탭별 파일 에디터 상태 (전역 상태 대신 탭에서 가져옴)
  const activeEditingFilePath = activeTab?.editingFilePath ?? null
  const editorOpen = activeEditingFilePath !== null

  const activeConversation = activeConversationId ? getConversation(activeConversationId) : null

  // Handle split mode close confirmation
  const handleSplitCloseKeep = useCallback(() => {
    // Keep both tabs, just close split mode
    setSplitSecondTabId(null)
    setSplitModeState('none')
    setSplitCloseConfirmOpen(false)
  }, [])

  const handleSplitCloseDelete = useCallback(() => {
    // Delete the second tab and close split mode
    if (splitSecondTabId) {
      removeTab(splitSecondTabId)
    }
    setSplitSecondTabId(null)
    setSplitModeState('none')
    setSplitCloseConfirmOpen(false)
  }, [splitSecondTabId, removeTab])

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()

    // Check if input is focused
    const isInputFocused = document.activeElement?.tagName === 'TEXTAREA' ||
                          document.activeElement?.tagName === 'INPUT'

    // Allow Page Up/Down to pass through to terminal for scrolling
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      return
    }

    // Auto-focus input on regular character input (except arrow keys, modifiers, function keys)
    // This allows typing anywhere to focus input, but preserves arrow key scrolling
    if (!isInputFocused && !isMod && !e.altKey) {
      const isNavigationKey = [
        'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
        'Home', 'End', 'PageUp', 'PageDown',
        'Tab', 'Escape', 'Enter',
        'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'
      ].includes(e.key)

      const isModifierOnly = ['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)

      // If it's a regular character (not navigation/modifier), focus input immediately
      if (!isNavigationKey && !isModifierOnly && e.key.length === 1) {
        const input = document.querySelector('.terminal-input') as HTMLTextAreaElement
        if (input) {
          console.log('✨ Auto-focusing input on key:', e.key, 'from:', document.activeElement?.tagName)
          input.focus()
          // Let the key pass through naturally to the now-focused input
        } else {
          console.warn('⚠️ Could not find .terminal-input')
        }
        return
      }
    }

    // If input is focused, only allow app-level shortcuts (Ctrl+Shift+*, navigation, etc.)
    // Let Claude Code shortcuts (Ctrl+C/D/L/R/T/G/O/U/K/Y/Z) pass through to TerminalInput
    if (isInputFocused) {
      // Allow these app-level shortcuts even when input is focused
      const allowedWhenFocused = [
        'p', // Ctrl+P (quick open), Ctrl+Shift+P (command palette)
        'f', // Ctrl+F (search), Ctrl+Shift+F (search in files)
        'w', // Ctrl+W (close tab)
        'n', // Ctrl+Shift+N (new tab)
        'e', // Ctrl+E (file explorer)
        'h', // Ctrl+H (history)
        'tab', // Ctrl+Tab (tab switching)
        ',', // Ctrl+, (settings)
        '\\', // Ctrl+\ (split)
        '|', // Ctrl+Shift+\ (split)
        'backslash', // Ctrl+\ (split)
      ]

      // Ctrl+Shift+* combinations are always app-level
      if (e.shiftKey) {
        // Allow Ctrl+Shift+P, Ctrl+Shift+F, Ctrl+Shift+N, etc.
      } else if (isMod && !allowedWhenFocused.includes(key) && e.code !== 'Backslash') {
        // Block other Ctrl+* shortcuts when input is focused
        return
      }

      // Allow Ctrl+1~9 for tab switching
      if (isMod && e.key >= '1' && e.key <= '9') {
        // Continue to handle below
      } else if (isMod && !allowedWhenFocused.includes(key) && !e.shiftKey && e.code !== 'Backslash') {
        return
      }
    }

    // Ctrl+F: Open search
    if (isMod && key === 'f') {
      e.preventDefault()
      e.stopPropagation()
      window.dispatchEvent(new CustomEvent('open-search'))
      return
    }

    // Ctrl+Shift+P: Open command palette
    if (isMod && e.shiftKey && key === 'p') {
      e.preventDefault()
      e.stopPropagation()
      setCommandPaletteOpen(true)
      return
    }

    // Ctrl+Shift+F: Search in files
    if (isMod && e.shiftKey && key === 'f') {
      e.preventDefault()
      e.stopPropagation()
      setSearchPanelOpen(prev => !prev)
      return
    }

    // Ctrl+P: Quick Open (file search)
    if (isMod && !e.shiftKey && key === 'p') {
      e.preventDefault()
      e.stopPropagation()
      setQuickOpenOpen(true)
      return
    }

    // Ctrl+Shift+T: Toggle Task Panel (app-level task panel, not Claude task list)
    if (isMod && e.shiftKey && key === 't') {
      e.preventDefault()
      e.stopPropagation()
      setTaskPanelOpen(prev => !prev)
      return
    }

    // Ctrl+Shift+N: New tab (changed from Ctrl+T to avoid conflict with Claude Code)
    if (isMod && e.shiftKey && key === 'n') {
      e.preventDefault()
      e.stopPropagation()
      addTab()
      return
    }

    // Ctrl+Shift+D: Toggle Agent Teams Dashboard
    if (isMod && e.shiftKey && key === 'd') {
      e.preventDefault()
      e.stopPropagation()
      const dashTab = tabs.find(t => t.isDashboard)
      if (dashTab) {
        if (activeTabId === dashTab.id) {
          // If already on dashboard, switch to first non-dashboard tab
          const other = tabs.find(t => !t.isDashboard)
          if (other) setActiveTab(other.id)
        } else {
          setActiveTab(dashTab.id)
        }
      }
      return
    }

    // Ctrl+Shift+C: Quick Claude command
    if (isMod && e.shiftKey && key === 'c') {
      if (showDashboard) return
      e.preventDefault()
      e.stopPropagation()
      sendCommandToTerminal('claude --dangerously-skip-permissions')
      return
    }

    // Ctrl+W: Close current tab
    if (isMod && key === 'w') {
      e.preventDefault()
      e.stopPropagation()
      if (activeTabId && tabs.length > 1) {
        const tab = tabs.find(t => t.id === activeTabId)
        if (tab?.isDashboard) {
          removeTab(activeTabId)
        } else {
          setCloseConfirmTabId(activeTabId)
        }
      }
      return
    }

    // Ctrl+Tab / Ctrl+Shift+Tab: Switch tabs
    if (isMod && e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      const currentIndex = tabs.findIndex(t => t.id === activeTabId)
      if (currentIndex !== -1) {
        let nextIndex: number
        if (e.shiftKey) {
          nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
        } else {
          nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1
        }
        setActiveTab(tabs[nextIndex].id)
      }
      return
    }

    // Ctrl+1~9: Switch to specific tab
    if (isMod && e.key >= '1' && e.key <= '9') {
      e.preventDefault()
      e.stopPropagation()
      const index = parseInt(e.key) - 1
      if (tabs[index]) {
        setActiveTab(tabs[index].id)
      }
      return
    }

    // Alt+1~5: Sidebar quick switch
    if (e.altKey && !isMod && !e.shiftKey && e.key >= '1' && e.key <= '5') {
      e.preventDefault()
      e.stopPropagation()
      switch (e.key) {
        case '1': setExplorerOpen(prev => !prev); break
        case '2': setHistoryOpen(prev => !prev); break
        case '3': setClaudeSettingsOpen(prev => !prev); break
        case '4': setSettingsOpen(prev => !prev); break
        case '5': setSearchPanelOpen(prev => !prev); break
      }
      return
    }

    // Skip panel/split shortcuts when Dashboard is active
    if (!showDashboard) {
      // Ctrl+E: Toggle file explorer (changed from Ctrl+B to avoid conflict with Claude Code)
      if (isMod && key === 'e') {
        e.preventDefault()
        e.stopPropagation()
        setExplorerOpen(prev => !prev)
        return
      }

      // Ctrl+H: Toggle history panel
      if (isMod && key === 'h') {
        e.preventDefault()
        e.stopPropagation()
        setHistoryOpen(prev => !prev)
        return
      }

      // Ctrl+,: Toggle settings
      if (isMod && e.key === ',') {
        e.preventDefault()
        e.stopPropagation()
        setSettingsOpen(prev => !prev)
        return
      }

      // Ctrl+\: Toggle horizontal split, Ctrl+Shift+\ (or Ctrl+|): Vertical split
      if (isMod && (e.key === '\\' || e.key === '|' || e.code === 'Backslash')) {
        e.preventDefault()
        e.stopPropagation()
        if (e.shiftKey || e.key === '|') {
          // Ctrl+Shift+\: Vertical split
          setSplitMode(splitMode === 'vertical' ? 'none' : 'vertical')
        } else {
          // Ctrl+\: Horizontal split
          setSplitMode(splitMode === 'horizontal' ? 'none' : 'horizontal')
        }
        return
      }

      // Ctrl+Shift+L: Toggle Claude Settings panel
      if (isMod && e.shiftKey && key === 'l') {
        e.preventDefault()
        e.stopPropagation()
        setClaudeSettingsOpen(prev => !prev)
        return
      }
    }

    // Escape: Close panels (only intercept if a panel is actually open)
    if (e.key === 'Escape') {
      if (conversationViewOpen) {
        e.preventDefault()
        e.stopPropagation()
        setConversationViewOpen(false)
        return
      } else if (claudeSettingsOpen) {
        e.preventDefault()
        e.stopPropagation()
        setClaudeSettingsOpen(false)
        return
      } else if (settingsOpen) {
        e.preventDefault()
        e.stopPropagation()
        setSettingsOpen(false)
        return
      } else if (historyOpen) {
        e.preventDefault()
        e.stopPropagation()
        setHistoryOpen(false)
        return
      }
      // No panel open → let Escape pass through to terminal (e.g., stop Claude)
    }
  }, [tabs, activeTabId, addTab, removeTab, setActiveTab, historyOpen, settingsOpen, conversationViewOpen, splitMode, setSplitMode, sendCommandToTerminal, claudeSettingsOpen, showDashboard, setTaskPanelOpen])

  // Register keyboard shortcuts - use capture phase to catch before xterm
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true) // capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [handleKeyDown])

  return (
    <div className="app">
      <TitleBar />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onAddTab={() => addTab()}
        onRemoveTab={removeTab}
        onSelectTab={setActiveTab}
        onReorderTabs={reorderTabs}
        splitMode={splitMode}
        onSplitModeChange={setSplitMode}
        onExplorerToggle={() => setExplorerOpen(!explorerOpen)}
        explorerOpen={explorerOpen}
        onHistoryToggle={() => setHistoryOpen(!historyOpen)}
        historyOpen={historyOpen}
        onSettingsToggle={() => setSettingsOpen(!settingsOpen)}
        settingsOpen={settingsOpen}
        onClaudeSettingsToggle={() => setClaudeSettingsOpen(!claudeSettingsOpen)}
        claudeSettingsOpen={claudeSettingsOpen}
        isDashboardActive={showDashboard}
      />
      <div className="content-stack">
        <div className={`content-panel ${showDashboard ? 'active' : ''}`}>
          <FullScreenWelcome
            onFolderSelect={handleFolderSelectNewTab}
            onGitClone={handleGitCloneNewTab}
          />
        </div>
        <div className={`content-panel main-content ${showDashboard ? '' : 'active'}`}>
        <ResizablePanel side="left" defaultWidth={260} minWidth={180} maxWidth={500} isOpen={explorerOpen}>
          <FileExplorer
            isOpen={true}
            onClose={() => setExplorerOpen(false)}
            onFileSelect={(path) => {
              if (activeTabId) {
                updateEditingFilePath(activeTabId, path)
              }
            }}
            onOpenFolder={handleOpenFolder}
            onOpenInNewTab={(path) => { addTab(path, path); focusTerminal() }}
            onGitClone={handleGitClone}
            currentCwd={activeTabCwd}
            explorerPath={activeExplorerPath}
            onExplorerPathChange={(path) => {
              if (activeTabId) {
                updateExplorerPath(activeTabId, path)
              }
            }}
          />
        </ResizablePanel>
        <ResizablePanel side="left" defaultWidth={320} minWidth={220} maxWidth={500} isOpen={searchPanelOpen}>
          <SearchPanel
            isOpen={searchPanelOpen}
            onClose={() => setSearchPanelOpen(false)}
            rootPath={activeExplorerPath || activeTabCwd}
            onFileSelect={(path) => {
              if (activeTabId) {
                updateEditingFilePath(activeTabId, path)
              }
            }}
          />
        </ResizablePanel>
        <ResizablePanel side="left" defaultWidth={280} minWidth={220} maxWidth={450} isOpen={claudeSettingsOpen}>
          <ClaudeSettingsPanel
            isOpen={claudeSettingsOpen}
            onClose={() => setClaudeSettingsOpen(false)}
            projectPath={activeTabCwd}
            onSendCommand={sendCommandToTerminal}
          />
        </ResizablePanel>
        <HistoryPanel
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onSelectConversation={() => setConversationViewOpen(true)}
        />
        <main className="terminal-container">
          {/* Always render all terminals to preserve state */}
          {tabs.filter(tab => !tab.isDashboard).map(tab => {
            // Determine visibility based on split mode
            let isVisible = false
            let splitPosition: 'none' | 'left' | 'right' | 'top' | 'bottom' = 'none'

            if (splitMode === 'none') {
              // Normal mode: only active tab is visible
              isVisible = tab.id === activeTabId
            } else {
              // Split mode: active tab on left/top, second tab on right/bottom
              const nonDashTabsCount = tabs.filter(t => !t.isDashboard).length
              const secondId = (splitSecondTabId && tabs.some(t => t.id === splitSecondTabId))
                ? splitSecondTabId
                : tabs.find(t => !t.isDashboard && t.id !== activeTabId)?.id ?? activeTabId!

              if (tab.id === activeTabId) {
                isVisible = true
                // Original tab: left for horizontal, top for vertical
                splitPosition = splitMode === 'vertical' ? 'top' : 'left'
                const posLabel = splitMode === 'vertical' ? 'TOP (원본 상단)' : 'LEFT (원본 좌측)'
                console.log(`Split: Active tab "${tab.title}" (${tab.id}) → ${posLabel} [Total tabs: ${nonDashTabsCount}]`)
              } else if (tab.id === secondId) {
                isVisible = true
                // Hidden pane: right for horizontal, bottom for vertical
                splitPosition = splitMode === 'vertical' ? 'bottom' : 'right'
                const posLabel = splitMode === 'vertical' ? 'BOTTOM (숨김 하단)' : 'RIGHT (숨김 우측)'
                console.log(`Split: Second tab "${tab.title}" (${tab.id}) → ${posLabel} [Total tabs: ${nonDashTabsCount}]`)
              }
            }

            return (
              <div
                key={tab.id}
                className={`terminal-wrapper ${splitPosition !== 'none' ? `split-${splitPosition} split-${splitMode}` : ''} ${isVisible ? 'visible' : 'hidden'}`}
              >
                <HybridTerminal
                  tabId={tab.id}
                  isActive={isVisible}
                />
              </div>
            )
          })}
        </main>
        <ConversationView
          isOpen={conversationViewOpen}
          onClose={() => setConversationViewOpen(false)}
          messages={activeConversation?.messages ?? []}
        />
        <ResizablePanel side="right" defaultWidthPercent={40} minWidth={250} maxWidth={800} isOpen={editorOpen}>
          <FileEditor
            isOpen={true}
            filePath={activeEditingFilePath}
            onClose={() => {
              if (activeTabId) {
                updateEditingFilePath(activeTabId, null)
              }
            }}
          />
        </ResizablePanel>
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          projectPath={activeTabCwd}
        />
      </div>
      </div>{/* end content-stack */}
      <StatusBar />
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => {
          setCommandPaletteOpen(false)
          // Dispatch event to focus terminal
          window.dispatchEvent(new CustomEvent('focus-terminal'))
        }}
        onSelectCommand={sendCommandToTerminal}
      />
      <ConfirmDialog
        open={closeConfirmTabId !== null}
        title="터미널 닫기"
        message="이 터미널을 닫으시겠습니까? 실행 중인 프로세스가 종료됩니다."
        confirmLabel="닫기"
        cancelLabel="취소"
        variant="danger"
        onConfirm={() => {
          if (closeConfirmTabId) removeTab(closeConfirmTabId)
          setCloseConfirmTabId(null)
        }}
        onCancel={() => setCloseConfirmTabId(null)}
      />
      <ConfirmDialog
        open={splitCloseConfirmOpen}
        title="Split 모드 종료"
        message={`Split 모드를 종료합니다. ${splitMode === 'horizontal' ? '오른쪽' : '아래'} 탭을 삭제하시겠습니까?`}
        confirmLabel="삭제"
        cancelLabel="유지"
        variant="danger"
        onConfirm={handleSplitCloseDelete}
        onCancel={handleSplitCloseKeep}
      />
      <QuickOpen
        isOpen={quickOpenOpen}
        onClose={() => setQuickOpenOpen(false)}
        onFileSelect={(path) => {
          if (activeTabId) {
            updateEditingFilePath(activeTabId, path)
          }
        }}
        rootPath={activeExplorerPath || activeTabCwd || ''}
      />
      <TaskPanel
        isOpen={taskPanelOpen}
        onClose={() => setTaskPanelOpen(false)}
        projectPath={activeTabCwd}
      />
    </div>
  )
}
