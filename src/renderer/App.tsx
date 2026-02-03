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
import { useTabStore } from './store/tabs'
import { useHistoryStore } from './store/history'

export default function App() {
  const { tabs, activeTabId, addTab, removeTab, setActiveTab, reorderTabs, restoreSession } = useTabStore()
  const { getConversation, activeConversationId } = useHistoryStore()
  const [splitMode, setSplitModeState] = useState<'none' | 'horizontal' | 'vertical'>('none')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  // Send command to active terminal
  const sendCommandToTerminal = useCallback((command: string) => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab?.terminalId !== null && activeTab?.terminalId !== undefined) {
      window.terminal.write(activeTab.terminalId, command + '\r')
    }
  }, [tabs, activeTabId])

  // Restore session on app startup (clear stale terminal IDs)
  useEffect(() => {
    restoreSession()
  }, [restoreSession])

  // Wrapper to ensure we have 2 tabs when split mode is activated
  const setSplitMode = useCallback((mode: 'none' | 'horizontal' | 'vertical') => {
    if (mode !== 'none' && tabs.length < 2) {
      addTab()
    }
    setSplitModeState(mode)
  }, [tabs.length, addTab])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [conversationViewOpen, setConversationViewOpen] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingFilePath, setEditingFilePath] = useState<string | null>(null)

  const activeConversation = activeConversationId ? getConversation(activeConversationId) : null

  // Get active tab's cwd for file explorer
  const activeTab = tabs.find(t => t.id === activeTabId)
  const activeTabCwd = activeTab?.cwd

  // Keyboard shortcuts handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isMod = e.ctrlKey || e.metaKey
    const key = e.key.toLowerCase()

    // Ctrl+Shift+P: Open command palette
    if (isMod && e.shiftKey && key === 'p') {
      e.preventDefault()
      e.stopPropagation()
      setCommandPaletteOpen(true)
      return
    }

    // Ctrl+Shift+C: Quick Claude command
    if (isMod && e.shiftKey && key === 'c') {
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

    // Escape: Close panels
    if (e.key === 'Escape') {
      if (conversationViewOpen) {
        setConversationViewOpen(false)
      } else if (settingsOpen) {
        setSettingsOpen(false)
      } else if (historyOpen) {
        setHistoryOpen(false)
      }
      return
    }
  }, [tabs, activeTabId, addTab, removeTab, setActiveTab, historyOpen, settingsOpen, conversationViewOpen, splitMode, setSplitMode, sendCommandToTerminal])

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
        onAddTab={addTab}
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
      />
      <div className="main-content">
        <ResizablePanel side="left" defaultWidth={260} minWidth={180} maxWidth={500} isOpen={explorerOpen}>
          <FileExplorer
            isOpen={true}
            onClose={() => setExplorerOpen(false)}
            onFileSelect={(path) => {
              setEditingFilePath(path)
              setEditorOpen(true)
            }}
            currentCwd={activeTabCwd}
          />
        </ResizablePanel>
        <HistoryPanel
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          onSelectConversation={() => setConversationViewOpen(true)}
        />
        <main className="terminal-container">
          {splitMode === 'none' ? (
            <HybridTerminal tabId={activeTabId} />
          ) : (
            <SplitPane direction={splitMode}>
              <HybridTerminal tabId={tabs[0]?.id} />
              <HybridTerminal tabId={tabs[1]?.id ?? tabs[0]?.id} />
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
            filePath={editingFilePath}
            onClose={() => {
              setEditorOpen(false)
              setEditingFilePath(null)
            }}
          />
        </ResizablePanel>
        <SettingsPanel
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
        />
      </div>
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
