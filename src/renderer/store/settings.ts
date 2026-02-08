import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 터미널 모드 제거 - abstracted 모드만 사용
export type RenderMode = 'abstracted' | 'hybrid' | 'rendered'
export type ShellType = 'default' | 'powershell' | 'cmd' | 'bash' | 'zsh'
export type SortMode = 'name' | 'type' | 'date' | 'size'

interface SettingsStore {
  renderMode: RenderMode
  showThinking: boolean
  autoScroll: boolean
  compactMode: boolean
  shell: ShellType
  defaultModel: string
  showHiddenFiles: boolean
  explorerSortMode: SortMode

  setRenderMode: (mode: RenderMode) => void
  setShowThinking: (show: boolean) => void
  setAutoScroll: (auto: boolean) => void
  setCompactMode: (compact: boolean) => void
  setShell: (shell: ShellType) => void
  setDefaultModel: (model: string) => void
  setShowHiddenFiles: (show: boolean) => void
  setExplorerSortMode: (mode: SortMode) => void
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
      explorerSortMode: 'name',

      setRenderMode: (mode) => set({ renderMode: mode }),
      setShowThinking: (show) => set({ showThinking: show }),
      setAutoScroll: (auto) => set({ autoScroll: auto }),
      setCompactMode: (compact) => set({ compactMode: compact }),
      setShell: (shell) => set({ shell }),
      setDefaultModel: (model) => set({ defaultModel: model }),
      setShowHiddenFiles: (show) => set({ showHiddenFiles: show }),
      setExplorerSortMode: (mode) => set({ explorerSortMode: mode }),
    }),
    {
      name: 'myonode-settings',
      version: 1,
      migrate: (persistedState: any, version: number) => {
        // 이전 버전에서 'terminal' 모드를 사용하고 있었다면 'abstracted'로 강제 변경
        if (persistedState && persistedState.renderMode === 'terminal') {
          persistedState.renderMode = 'abstracted'
        }
        return persistedState
      },
    }
  )
)
