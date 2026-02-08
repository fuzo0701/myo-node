import { create } from 'zustand'

interface AgentTeamsState {
  teams: Record<string, AgentTeamInfo>
  activeTeamName: string | null
  selectedAgent: string | null
  loading: boolean

  loadTeams: () => Promise<void>
  startWatching: () => void
  stopWatching: () => void
  setActiveTeam: (teamName: string | null) => void
  setSelectedAgent: (agentId: string | null) => void
  getProgress: (teamName: string) => { completed: number; total: number }
}

let unwatchFn: (() => void) | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

export const useAgentTeamsStore = create<AgentTeamsState>()((set, get) => ({
  teams: {},
  activeTeamName: null,
  selectedAgent: null,
  loading: false,

  loadTeams: async () => {
    if (!window.agentTeams) return
    set({ loading: true })
    try {
      const teamNames = await window.agentTeams.listTeams()
      const teams: Record<string, AgentTeamInfo> = {}
      for (const name of teamNames) {
        const info = await window.agentTeams.getTeamInfo(name)
        if (info) {
          teams[name] = info
        }
      }
      set({ teams, loading: false })
    } catch {
      set({ teams: {}, loading: false })
    }
  },

  startWatching: () => {
    if (!window.agentTeams) return
    const { loadTeams } = get()

    // Initial load
    loadTeams()

    // Start filesystem watcher
    window.agentTeams.watchTeams()

    // Listen for changes with debounce
    unwatchFn = window.agentTeams.onTeamsChanged(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        loadTeams()
      }, 300)
    })
  },

  stopWatching: () => {
    if (unwatchFn) {
      unwatchFn()
      unwatchFn = null
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    window.agentTeams?.unwatchTeams()
  },

  setActiveTeam: (teamName) => set({ activeTeamName: teamName }),
  setSelectedAgent: (agentId) => set({ selectedAgent: agentId }),

  getProgress: (teamName) => {
    const team = get().teams[teamName]
    if (!team) return { completed: 0, total: 0 }
    const tasks = team.tasks || []
    const total = tasks.length
    const completed = tasks.filter(t => t.status === 'completed').length
    return { completed, total }
  },
}))
