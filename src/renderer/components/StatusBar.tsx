import { useEffect } from 'react'
import { useTabStore } from '../store/tabs'
import { useClaudeInfoStore } from '../store/claudeInfo'

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
  return n.toString()
}

function formatModel(model: string): string {
  const m = model.match(/claude-(\w+)-([\d]+)-([\d]+)/)
  if (m) {
    const name = m[1].charAt(0).toUpperCase() + m[1].slice(1)
    return `${name} ${m[2]}.${m[3]}`
  }
  return model
}

function formatResetTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = d.getTime() - now.getTime()
    if (diffMs <= 0) return 'now'
    const diffH = Math.floor(diffMs / 3600000)
    const diffM = Math.floor((diffMs % 3600000) / 60000)
    if (diffH > 24) {
      const days = Math.floor(diffH / 24)
      return `${days}d ${diffH % 24}h`
    }
    return diffH > 0 ? `${diffH}h ${diffM}m` : `${diffM}m`
  } catch { return '' }
}

function usageBarColor(pct: number): string {
  if (pct > 80) return '#ef4444'
  if (pct > 50) return '#eab308'
  return '#22c55e'
}

export default function StatusBar() {
  const { tabs, activeTabId } = useTabStore()
  const activeTab = tabs.find(t => t.id === activeTabId)

  const tabId = activeTab?.isDashboard ? null : activeTab?.id
  const session = useClaudeInfoStore((s) => tabId ? s.getSession(tabId) : null)
  const usageInfo = useClaudeInfoStore((s) => s.usageInfo)
  const loadStatsCache = useClaudeInfoStore((s) => s.loadStatsCache)
  const loadUsage = useClaudeInfoStore((s) => s.loadUsage)

  useEffect(() => {
    loadStatsCache()
    loadUsage()
    const interval = setInterval(() => { loadStatsCache(); loadUsage() }, 60000)
    return () => clearInterval(interval)
  }, [loadStatsCache, loadUsage])

  const claudeStatus = activeTab?.claudeStatus || 'idle'
  const contextPercent = session && session.contextMax > 0
    ? Math.min(100, (session.contextUsed / session.contextMax) * 100)
    : 0

  const statusColor = claudeStatus === 'running' ? '#3b82f6'
    : claudeStatus === 'loading' ? '#eab308'
    : claudeStatus === 'completed' ? '#22c55e'
    : 'var(--text-muted)'

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {/* Claude status */}
        <span className="status-item">
          <span className="status-dot" style={{ backgroundColor: statusColor }} />
          <span className="status-label">
            {claudeStatus === 'idle' ? 'Ready' : claudeStatus.charAt(0).toUpperCase() + claudeStatus.slice(1)}
          </span>
        </span>

        {/* Model */}
        {session?.model && (
          <span className="status-item status-model" title={session.model}>
            {formatModel(session.model)}
          </span>
        )}

        {/* 5-Hour usage */}
        {usageInfo.lastLoaded > 0 && (
          <span
            className="status-item status-usage"
            title={`5-Hour: ${usageInfo.fiveHourUtil.toFixed(1)}%${usageInfo.fiveHourResetsAt ? ` | Resets in ${formatResetTime(usageInfo.fiveHourResetsAt)}` : ''}`}
          >
            <span className="usage-label">5H</span>
            <span className="usage-bar-mini">
              <span
                className="usage-fill-mini"
                style={{
                  width: `${usageInfo.fiveHourUtil}%`,
                  backgroundColor: usageBarColor(usageInfo.fiveHourUtil),
                }}
              />
            </span>
            <span className="usage-text">{Math.round(usageInfo.fiveHourUtil)}%</span>
          </span>
        )}

        {/* 7-Day usage */}
        {usageInfo.lastLoaded > 0 && (
          <span
            className="status-item status-usage"
            title={`7-Day: ${usageInfo.sevenDayUtil.toFixed(1)}%${usageInfo.sevenDayResetsAt ? ` | Resets in ${formatResetTime(usageInfo.sevenDayResetsAt)}` : ''}`}
          >
            <span className="usage-label">7D</span>
            <span className="usage-bar-mini">
              <span
                className="usage-fill-mini"
                style={{
                  width: `${usageInfo.sevenDayUtil}%`,
                  backgroundColor: usageBarColor(usageInfo.sevenDayUtil),
                }}
              />
            </span>
            <span className="usage-text">{Math.round(usageInfo.sevenDayUtil)}%</span>
          </span>
        )}

        {/* Sonnet 7-Day */}
        {usageInfo.lastLoaded > 0 && usageInfo.sevenDaySonnetUtil != null && (
          <span
            className="status-item status-usage"
            title={`Sonnet 7-Day: ${usageInfo.sevenDaySonnetUtil.toFixed(1)}%${usageInfo.sevenDaySonnetResetsAt ? ` | Resets in ${formatResetTime(usageInfo.sevenDaySonnetResetsAt)}` : ''}`}
          >
            <span className="usage-label">Sonnet</span>
            <span className="usage-bar-mini">
              <span
                className="usage-fill-mini"
                style={{
                  width: `${usageInfo.sevenDaySonnetUtil}%`,
                  backgroundColor: usageBarColor(usageInfo.sevenDaySonnetUtil),
                }}
              />
            </span>
            <span className="usage-text">{Math.round(usageInfo.sevenDaySonnetUtil)}%</span>
          </span>
        )}

        {/* Context usage */}
        <span className="status-item status-context" title={session ? `Context: ${formatNum(session.contextUsed)} / ${formatNum(session.contextMax)}` : 'Context'}>
          <span className="context-label-mini">CTX</span>
          <span className="context-bar-mini">
            <span
              className="context-fill-mini"
              style={{
                width: `${contextPercent}%`,
                backgroundColor: contextPercent > 80 ? '#ef4444' : contextPercent > 50 ? '#eab308' : '#22c55e',
              }}
            />
          </span>
          <span className="context-pct">
            {session && session.contextUsed > 0
              ? `${formatNum(session.contextUsed)}/${formatNum(session.contextMax)}`
              : '0/0'
            }
          </span>
        </span>
      </div>
    </div>
  )
}
