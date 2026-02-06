import { create } from 'zustand'

export interface ClaudeSessionInfo {
  model: string | null
  inputTokens: number
  outputTokens: number
  totalCost: number
  contextUsed: number
  contextMax: number
  // Daily/weekly usage
  dailyUsed: number
  dailyMax: number
  weeklyUsed: number
  weeklyMax: number
}

const defaultSession: ClaudeSessionInfo = {
  model: null,
  inputTokens: 0,
  outputTokens: 0,
  totalCost: 0,
  contextUsed: 0,
  contextMax: 200000,
  dailyUsed: 0,
  dailyMax: 0,
  weeklyUsed: 0,
  weeklyMax: 0,
}

export interface GlobalStats {
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheRead: number
  totalCacheCreate: number
  todayTokens: number
  todayMessages: number
  todaySessions: number
  totalSessions: number
  totalMessages: number
  totalCostUSD: number
  lastComputedDate: string
  lastLoaded: number
}

export interface UsageInfo {
  fiveHourUtil: number
  fiveHourResetsAt: string
  sevenDayUtil: number
  sevenDayResetsAt: string
  sevenDaySonnetUtil: number | null
  sevenDaySonnetResetsAt: string | null
  lastLoaded: number
}

const defaultUsageInfo: UsageInfo = {
  fiveHourUtil: 0,
  fiveHourResetsAt: '',
  sevenDayUtil: 0,
  sevenDayResetsAt: '',
  sevenDaySonnetUtil: null,
  sevenDaySonnetResetsAt: null,
  lastLoaded: 0,
}

const defaultGlobalStats: GlobalStats = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheRead: 0,
  totalCacheCreate: 0,
  todayTokens: 0,
  todayMessages: 0,
  todaySessions: 0,
  totalSessions: 0,
  totalMessages: 0,
  totalCostUSD: 0,
  lastComputedDate: '',
  lastLoaded: 0,
}

interface ClaudeInfoStore {
  sessions: Record<string, ClaudeSessionInfo>
  globalStats: GlobalStats
  usageInfo: UsageInfo
  getSession: (tabId: string) => ClaudeSessionInfo
  updateSession: (tabId: string, partial: Partial<ClaudeSessionInfo>) => void
  resetSession: (tabId: string) => void
  loadStatsCache: () => Promise<void>
  loadUsage: () => Promise<void>
}

function getTodayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useClaudeInfoStore = create<ClaudeInfoStore>()((set, get) => {
  // Expose for debugging/testing
  if (typeof window !== 'undefined') (window as any).__claudeInfoStore = { getState: () => get(), setState: set }
  return {
  sessions: {},
  globalStats: defaultGlobalStats,
  usageInfo: defaultUsageInfo,
  getSession: (tabId: string) => {
    return get().sessions[tabId] || defaultSession
  },
  updateSession: (tabId: string, partial: Partial<ClaudeSessionInfo>) => {
    set((state) => ({
      sessions: {
        ...state.sessions,
        [tabId]: { ...(state.sessions[tabId] || defaultSession), ...partial },
      },
    }))
  },
  resetSession: (tabId: string) => {
    set((state) => {
      const { [tabId]: _, ...rest } = state.sessions
      return { sessions: rest }
    })
  },
  loadStatsCache: async () => {
    try {
      const data = await window.claude.readStatsCache()
      if (!data) return

      // Aggregate total tokens across all models
      let totalIn = 0
      let totalOut = 0
      let totalCacheRead = 0
      let totalCacheCreate = 0
      let totalCost = 0
      if (data.modelUsage) {
        for (const usage of Object.values(data.modelUsage)) {
          totalIn += usage.inputTokens || 0
          totalOut += usage.outputTokens || 0
          totalCacheRead += usage.cacheReadInputTokens || 0
          totalCacheCreate += usage.cacheCreationInputTokens || 0
          totalCost += usage.costUSD || 0
        }
      }

      // Today's tokens from dailyModelTokens array
      let todayTokens = 0
      const todayKey = getTodayKey()
      if (Array.isArray(data.dailyModelTokens)) {
        const todayEntry = data.dailyModelTokens.find(d => d.date === todayKey)
        if (todayEntry?.tokensByModel) {
          for (const count of Object.values(todayEntry.tokensByModel)) {
            todayTokens += (typeof count === 'number' ? count : 0)
          }
        }
      }

      // Today's activity from dailyActivity array
      let todayMessages = 0
      let todaySessions = 0
      if (Array.isArray(data.dailyActivity)) {
        const todayActivity = data.dailyActivity.find(d => d.date === todayKey)
        if (todayActivity) {
          todayMessages = todayActivity.messageCount || 0
          todaySessions = todayActivity.sessionCount || 0
        }
      }

      set({
        globalStats: {
          totalInputTokens: totalIn,
          totalOutputTokens: totalOut,
          totalCacheRead: totalCacheRead,
          totalCacheCreate: totalCacheCreate,
          todayTokens,
          todayMessages,
          todaySessions,
          totalSessions: data.totalSessions || 0,
          totalMessages: data.totalMessages || 0,
          totalCostUSD: totalCost,
          lastComputedDate: data.lastComputedDate || '',
          lastLoaded: Date.now(),
        },
      })
    } catch {
      // stats-cache not available (Claude CLI not installed, etc.)
    }
  },
  loadUsage: async () => {
    try {
      const data = await window.claude.getUsage()
      if (!data) return

      set({
        usageInfo: {
          fiveHourUtil: data.five_hour?.utilization ?? 0,
          fiveHourResetsAt: data.five_hour?.resets_at ?? '',
          sevenDayUtil: data.seven_day?.utilization ?? 0,
          sevenDayResetsAt: data.seven_day?.resets_at ?? '',
          sevenDaySonnetUtil: data.seven_day_sonnet?.utilization ?? null,
          sevenDaySonnetResetsAt: data.seven_day_sonnet?.resets_at ?? null,
          lastLoaded: Date.now(),
        },
      })
    } catch {
      // OAuth credentials not available
    }
  },
}})
