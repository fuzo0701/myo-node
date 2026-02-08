import { useState, useEffect, useRef } from 'react'
import { useTabStore } from '../store/tabs'
import { useClaudeInfoStore } from '../store/claudeInfo'
import { useNotificationStore } from '../store/notifications'

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

function formatExpiry(expiresAt: number): string {
  if (!expiresAt) return ''
  const now = Date.now()
  const diffMs = expiresAt - now
  if (diffMs <= 0) return 'Expired'
  const days = Math.floor(diffMs / 86400000)
  const hours = Math.floor((diffMs % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hours}h`
  return `${hours}h`
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < 60000) return 'just now'
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

const notiTypeIcon: Record<string, { symbol: string; color: string }> = {
  success: { symbol: '\u2713', color: '#22c55e' },
  warning: { symbol: '\u26A0', color: '#eab308' },
  error: { symbol: '\u2717', color: '#ef4444' },
  info: { symbol: '\u2139', color: '#3b82f6' },
}

export default function StatusBar() {
  const { tabs, activeTabId, setActiveTab } = useTabStore()
  const activeTab = tabs.find(t => t.id === activeTabId)

  const tabId = activeTab?.isDashboard ? null : activeTab?.id
  const session = useClaudeInfoStore((s) => tabId ? s.getSession(tabId) : null)
  const usageInfo = useClaudeInfoStore((s) => s.usageInfo)
  const loadStatsCache = useClaudeInfoStore((s) => s.loadStatsCache)
  const loadUsage = useClaudeInfoStore((s) => s.loadUsage)

  const [authStatus, setAuthStatus] = useState<{ loggedIn: boolean; subscriptionType: string; expiresAt: number }>({ loggedIn: false, subscriptionType: '', expiresAt: 0 })

  // Notification state
  const notifications = useNotificationStore((s) => s.notifications)
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const markAllRead = useNotificationStore((s) => s.markAllRead)
  const removeNotification = useNotificationStore((s) => s.removeNotification)
  const clearAll = useNotificationStore((s) => s.clearAll)
  const [notiOpen, setNotiOpen] = useState(false)
  const notiRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadStatsCache()
    loadUsage()
    window.claude?.getAuthStatus().then(setAuthStatus).catch(() => {})
    const interval = setInterval(() => { loadStatsCache(); loadUsage() }, 60000)
    return () => clearInterval(interval)
  }, [loadStatsCache, loadUsage])

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!notiOpen) return
    const handleClick = (e: MouseEvent) => {
      if (notiRef.current && !notiRef.current.contains(e.target as Node)) {
        setNotiOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [notiOpen])

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
      <div className="status-bar-right">
        {/* Notifications */}
        <div className="status-notification" ref={notiRef}>
          <span
            className="status-item noti-bell"
            onClick={() => {
              setNotiOpen((prev) => {
                if (!prev) markAllRead()
                return !prev
              })
            }}
            title={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </span>

          {notiOpen && (
            <div className="notification-dropdown">
              <div className="notification-header">
                <span>Notifications</span>
                <button className="noti-clear-btn" onClick={clearAll}>Clear</button>
              </div>
              <div className="notification-list">
                {notifications.length === 0 && (
                  <div className="notification-empty">No notifications</div>
                )}
                {notifications.map((n) => {
                  const icon = notiTypeIcon[n.type] || notiTypeIcon.info
                  return (
                    <div
                      key={n.id}
                      className={`notification-item ${n.read ? '' : 'unread'} ${n.tabId ? 'clickable' : ''}`}
                      onClick={() => {
                        if (n.tabId) {
                          setActiveTab(n.tabId)
                        }
                        removeNotification(n.id)
                        setNotiOpen(false)
                      }}
                    >
                      <span className="noti-icon" style={{ color: icon.color }}>{icon.symbol}</span>
                      <div className="noti-body">
                        <span className="noti-title">{n.title}</span>
                        <span className="noti-time">
                          {n.detail ? `${n.detail} · ` : ''}{formatRelativeTime(n.timestamp)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Auth status */}
        <span
          className="status-item status-auth"
          title={authStatus.loggedIn
            ? `${authStatus.subscriptionType.toUpperCase()} | Token expires in ${formatExpiry(authStatus.expiresAt)}`
            : 'Not logged in'}
        >
          <span className="status-auth-dot" style={{ backgroundColor: authStatus.loggedIn ? '#22c55e' : '#6b7280' }} />
          <span className="status-auth-label">
            {authStatus.loggedIn ? authStatus.subscriptionType.toUpperCase() : 'Offline'}
          </span>
        </span>
        <span className="status-item status-version">v{__APP_VERSION__}</span>
      </div>
    </div>
  )
}
