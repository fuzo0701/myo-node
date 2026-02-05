import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RenderMode = 'terminal' | 'hybrid' | 'rendered' | 'abstracted'
export type ShellType = 'default' | 'powershell' | 'cmd' | 'bash' | 'zsh'

interface SettingsStore {
  renderMode: RenderMode
  showThinking: boolean
  autoScroll: boolean
  compactMode: boolean
  shell: ShellType

  setRenderMode: (mode: RenderMode) => void
  setShowThinking: (show: boolean) => void
  setAutoScroll: (auto: boolean) => void
  setCompactMode: (compact: boolean) => void
  setShell: (shell: ShellType) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      renderMode: 'abstracted',
      showThinking: true,
      autoScroll: true,
      compactMode: false,
      shell: 'default',

      setRenderMode: (mode) => set({ renderMode: mode }),
      setShowThinking: (show) => set({ showThinking: show }),
      setAutoScroll: (auto) => set({ autoScroll: auto }),
      setCompactMode: (compact) => set({ compactMode: compact }),
      setShell: (shell) => set({ shell }),
    }),
    {
      name: 'myonode-settings',
    }
  )
)
