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
  defaultModel: string
  showHiddenFiles: boolean

  setRenderMode: (mode: RenderMode) => void
  setShowThinking: (show: boolean) => void
  setAutoScroll: (auto: boolean) => void
  setCompactMode: (compact: boolean) => void
  setShell: (shell: ShellType) => void
  setDefaultModel: (model: string) => void
  setShowHiddenFiles: (show: boolean) => void
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      renderMode: 'abstracted',
      showThinking: true,
      autoScroll: true,
      compactMode: false,
      shell: 'default',
      defaultModel: 'sonnet',
      showHiddenFiles: false,

      setRenderMode: (mode) => set({ renderMode: mode }),
      setShowThinking: (show) => set({ showThinking: show }),
      setAutoScroll: (auto) => set({ autoScroll: auto }),
      setCompactMode: (compact) => set({ compactMode: compact }),
      setShell: (shell) => set({ shell }),
      setDefaultModel: (model) => set({ defaultModel: model }),
      setShowHiddenFiles: (show) => set({ showHiddenFiles: show }),
    }),
    {
      name: 'myonode-settings',
    }
  )
)
