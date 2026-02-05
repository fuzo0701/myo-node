import { create } from 'zustand'

export type ClaudeStatus = 'idle' | 'running' | 'loading' | 'completed'

export interface Tab {
  id: string
  title: string
  cwd: string
  isDashboard?: boolean  // 대시보드 탭 (항상 첫 번째, 터미널 없음)
  explorerPath?: string  // 탭별 탐색기 경로 (수동 선택 시 설정)
  terminalId?: number
  claudeStatus: ClaudeStatus
}

interface TabStore {
  tabs: Tab[]
  activeTabId: string | null
  tabCounter: number
  addTab: (cwd?: string, explorerPath?: string) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabTitle: (id: string, title: string) => void
  updateTabCwd: (id: string, cwd: string) => void
  updateExplorerPath: (id: string, path: string | undefined) => void
  setTerminalId: (tabId: string, terminalId: number) => void
  setClaudeStatus: (tabId: string, status: ClaudeStatus) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  restoreSession: () => void
}

function createDashboardTab(): Tab {
  return {
    id: 'dashboard',
    title: 'Dashboard',
    cwd: '~',
    isDashboard: true,
    claudeStatus: 'idle',
  }
}

function createTab(counter: number, cwd?: string, explorerPath?: string): Tab {
  return {
    id: `tab-${counter}`,
    title: `Terminal ${counter}`,
    cwd: cwd || '~',
    explorerPath,
    claudeStatus: 'idle',
  }
}

export const useTabStore = create<TabStore>()((set, get) => ({
  tabs: [createDashboardTab()],
  activeTabId: 'dashboard',
  tabCounter: 0,

  addTab: (cwd?: string, explorerPath?: string) => {
    const newCounter = get().tabCounter + 1
    const newTab = createTab(newCounter, cwd, explorerPath)
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
      tabCounter: newCounter,
    }))
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get()
    // Cannot remove dashboard tab
    const tab = tabs.find(t => t.id === id)
    if (tab?.isDashboard) return
    // Must keep at least dashboard
    const nonDashboardTabs = tabs.filter(t => !t.isDashboard)
    if (nonDashboardTabs.length === 0) return

    const index = tabs.findIndex((t) => t.id === id)
    const newTabs = tabs.filter((t) => t.id !== id)

    let newActiveId = activeTabId
    if (activeTabId === id) {
      newActiveId = newTabs[Math.min(index, newTabs.length - 1)]?.id ?? null
    }

    set({ tabs: newTabs, activeTabId: newActiveId })
  },

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTabTitle: (id, title) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
    })),

  updateTabCwd: (id, cwd) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, cwd } : t)),
    })),

  updateExplorerPath: (id, path) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, explorerPath: path } : t)),
    })),

  setTerminalId: (tabId, terminalId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, terminalId } : t)),
    })),

  setClaudeStatus: (tabId, status) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, claudeStatus: status } : t)),
    })),

  reorderTabs: (fromIndex, toIndex) => {
    set((state) => {
      const newTabs = [...state.tabs]
      const [movedTab] = newTabs.splice(fromIndex, 1)
      newTabs.splice(toIndex, 0, movedTab)
      return { tabs: newTabs }
    })
  },

  restoreSession: () => {
    // No-op without persist
  },
}))
