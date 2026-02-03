import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RenderMode = 'terminal' | 'hybrid' | 'rendered'

interface SettingsStore {
  renderMode: RenderMode
  showThinking: boolean
  autoScroll: boolean
  compactMode: boolean

  setRenderMode: (mode: RenderMode) => void
  setShowThinking: (show: boolean) => void
  setAutoScroll: (auto: boolean) => void
  setCompactMode: (compact: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      renderMode: 'terminal',
      showThinking: true,
      autoScroll: true,
      compactMode: false,

      setRenderMode: (mode) => set({ renderMode: mode }),
      setShowThinking: (show) => set({ showThinking: show }),
      setAutoScroll: (auto) => set({ autoScroll: auto }),
      setCompactMode: (compact) => set({ compactMode: compact }),
    }),
    {
      name: 'myonode-settings',
    }
  )
)
