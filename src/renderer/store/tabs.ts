import { create } from 'zustand'

export interface Tab {
  id: string
  title: string
  cwd: string
  terminalId?: number
}

interface TabStore {
  tabs: Tab[]
  activeTabId: string | null
  tabCounter: number
  addTab: (cwd?: string) => void
  removeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabTitle: (id: string, title: string) => void
  updateTabCwd: (id: string, cwd: string) => void
  setTerminalId: (tabId: string, terminalId: number) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  restoreSession: () => void
}

function createTab(counter: number, cwd?: string): Tab {
  return {
    id: `tab-${counter}`,
    title: `Terminal ${counter}`,
    cwd: cwd || '~',
  }
}

export const useTabStore = create<TabStore>()((set, get) => ({
  tabs: [createTab(1)],
  activeTabId: 'tab-1',
  tabCounter: 1,

  addTab: (cwd?: string) => {
    const newCounter = get().tabCounter + 1
    const newTab = createTab(newCounter, cwd)
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: newTab.id,
      tabCounter: newCounter,
    }))
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get()
    if (tabs.length === 1) return

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

  setTerminalId: (tabId, terminalId) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === tabId ? { ...t, terminalId } : t)),
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
