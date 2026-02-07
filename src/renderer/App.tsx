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
import { useTabStore } from './store/tabs'
import { useHistoryStore } from './store/history'
import { useSettingsStore } from './store/settings'

export default function App() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, reorderTabs, restoreSession, updateTabCwd, updateExplorerPath, updateEditingFilePath } = useTabStore()
  const { getConversation, activeConversationId } = useHistoryStore()
  const [splitMode, setSplitModeState] = useState<'none' | 'horizontal' | 'vertical'>('none')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  const renderMode = useSettingsStore((state) => state.renderMode)

  // Get active tab's cwd and explorerPath for file explorer (must be before welcome handlers)
  const activeTab = tabs.find(t => t.id === activeTabId)
  const activeTabCwd = activeTab?.cwd
  const activeExplorerPath = activeTab?.explorerPath

  // Determine if active tab is the dashboard
  const showDashboard = activeTab?.isDashboard === true

  // Send command to active terminal
  const sendCommandToTerminal = useCallback((command: string) => {
    if (renderMode === 'abstracted') {
      // In abstracted mode, let HybridTerminal handle it via event
      window.dispatchEvent(new CustomEvent('command-from-palette', { detail: command }))
      return
    }

    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab?.terminalId !== null && activeTab?.terminalId !== undefined) {
      window.terminal.write(activeTab.terminalId, command + '\r')
    }
  }, [tabs, activeTabId, renderMode])

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

  // Wrapper to ensure we have 2 tabs when split mode is activated
  const setSplitMode = useCallback((mode: 'none' | 'horizontal' | 'vertical') => {
    if (mode !== 'none' && tabs.length < 2) {
      addTab()
    }
    setSplitModeState(mode)
  }, [tabs.length, addTab])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [claudeSettingsOpen, setClaudeSettingsOpen] = useState(false)
  const [conversationViewOpen, setConversationViewOpen] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(true)

  // 탭별 파일 에디터 상태 (전역 상태 대신 탭에서 가져옴)
  const activeEditingFilePath = activeTab?.editingFilePath ?? null
  const editorOpen = activeEditingFilePath !== null

  const activeConversation = activeConversationId ? getConversation(activeConversationId) : null

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()

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

    // Ctrl+Shift+C: Quick Claude command
    if (isMod && e.shiftKey && key === 'c') {
      if (showDashboard) return
      e.preventDefault()
      e.stopPropagation()
      sendCommandToTerminal('claude --dangerously-skip-permissions')
      return
    }

    // Ctrl+T: New tab
    if (isMod && key === 't') {
      e.preventDefault()
      e.stopPropagation()
      addTab()
      return
    }

    // Ctrl+W: Close current tab
    if (isMod && key === 'w') {
      e.preventDefault()
      e.stopPropagation()
      if (activeTabId && tabs.length > 1) {
        removeTab(activeTabId)
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

    // Skip panel/split shortcuts when Dashboard is active
    if (!showDashboard) {
      // Ctrl+B: Toggle file explorer
      if (isMod && key === 'b') {
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
  }, [tabs, activeTabId, addTab, removeTab, setActiveTab, historyOpen, settingsOpen, conversationViewOpen, splitMode, setSplitMode, sendCommandToTerminal, claudeSettingsOpen, showDashboard])

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
          {splitMode === 'none' ? (
            // Render all terminals, but only show the active one
            // Skip dashboard tab (no terminal needed)
            tabs.filter(tab => !tab.isDashboard).map(tab => (
              <HybridTerminal
                key={tab.id}
                tabId={tab.id}
                isActive={tab.id === activeTabId}
              />
            ))
          ) : (
            <SplitPane direction={splitMode}>
              <HybridTerminal tabId={tabs.find(t => !t.isDashboard)?.id ?? tabs[0]?.id} isActive={true} />
              <HybridTerminal tabId={tabs.filter(t => !t.isDashboard)[1]?.id ?? tabs.find(t => !t.isDashboard)?.id ?? tabs[0]?.id} isActive={true} />
            </SplitPane>
          )}
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
    </div>
  )
}
