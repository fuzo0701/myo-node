import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface RecentFolder {
  path: string
  name: string
  lastOpened: number
}

interface ExplorerStore {
  recentFolders: RecentFolder[]
  addRecentFolder: (path: string) => void
  removeRecentFolder: (path: string) => void
  clearRecentFolders: () => void
}

const MAX_RECENT_FOLDERS = 10

export const useExplorerStore = create<ExplorerStore>()(
  persist(
    (set) => ({
      recentFolders: [],

      addRecentFolder: (path: string) => set((state) => {
        const name = path.replace(/\\/g, '/').split('/').pop() || path
        const filtered = state.recentFolders.filter(f => f.path !== path)
        const updated = [{ path, name, lastOpened: Date.now() }, ...filtered]
        return { recentFolders: updated.slice(0, MAX_RECENT_FOLDERS) }
      }),

      removeRecentFolder: (path: string) => set((state) => ({
        recentFolders: state.recentFolders.filter(f => f.path !== path)
      })),

      clearRecentFolders: () => set({ recentFolders: [] }),
    }),
    {
      name: 'myonode-explorer',
    }
  )
)
