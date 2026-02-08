import { useAgentTeamsStore } from '../store/agentTeams'
import { Tab } from '../store/tabs'

interface TmuxLayoutProps {
  team: AgentTeamInfo
  currentTab: Tab
  children: React.ReactNode  // The terminal component
}

const statusIcon: Record<string, string> = {
  completed: '\u2713',
  in_progress: '\u25B6',
  pending: '\u25CB',
}

export default function TmuxLayout({ team, currentTab, children }: TmuxLayoutProps) {
  const members = team?.members || []
  const tasks = team?.tasks || []

  // Find lead and teammates
  const leadMember = members.find(m => m.agentType === 'lead' || m.agentType === 'orchestrator')
  const teammates = members.filter(m => m.agentType !== 'lead' && m.agentType !== 'orchestrator')

  // Calculate progress
  const completed = tasks.filter(t => t.status === 'completed').length
  const total = tasks.length
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div className="tmux-layout">
      {/* Left pane: Lead terminal (60%) */}
      <div className="tmux-main-pane">
        <div className="tmux-pane-header">
          <span className="tmux-pane-icon">👑</span>
          <span className="tmux-pane-title">{leadMember?.name || 'Lead'}</span>
          <span className="tmux-pane-team">{team.teamName}</span>
        </div>
        <div className="tmux-pane-content">
          {children}
        </div>
      </div>

      {/* Right pane: Teammates info (40%) */}
      <div className="tmux-side-pane">
        <div className="tmux-side-header">
          <span className="tmux-side-title">Team Progress</span>
          <span className="tmux-side-progress">{completed}/{total} ({progressPercent}%)</span>
        </div>

        <div className="tmux-side-content">
          {/* Progress bar */}
          {total > 0 && (
            <div className="tmux-progress-bar">
              <div
                className="tmux-progress-fill"
                style={{
                  width: `${progressPercent}%`,
                  backgroundColor: progressPercent === 100 ? '#22c55e' : '#3b82f6'
                }}
              />
            </div>
          )}

          {/* Task summary */}
          <div className="tmux-task-summary">
            {tasks.filter(t => t.status === 'completed').length > 0 && (
              <div className="tmux-task-stat completed">
                <span className="tmux-task-icon">✓</span>
                <span className="tmux-task-label">Completed</span>
                <span className="tmux-task-count">{tasks.filter(t => t.status === 'completed').length}</span>
              </div>
            )}
            {tasks.filter(t => t.status === 'in_progress').length > 0 && (
              <div className="tmux-task-stat in-progress">
                <span className="tmux-task-icon">◉</span>
                <span className="tmux-task-label">In Progress</span>
                <span className="tmux-task-count">{tasks.filter(t => t.status === 'in_progress').length}</span>
              </div>
            )}
            {tasks.filter(t => t.status === 'pending').length > 0 && (
              <div className="tmux-task-stat pending">
                <span className="tmux-task-icon">○</span>
                <span className="tmux-task-label">Pending</span>
                <span className="tmux-task-count">{tasks.filter(t => t.status === 'pending').length}</span>
              </div>
            )}
          </div>

          {/* Teammates list */}
          <div className="tmux-teammates">
            <div className="tmux-teammates-header">Teammates ({teammates.length})</div>
            {teammates.length > 0 ? (
              teammates.map(agent => {
                const agentTasks = tasks.filter(t =>
                  t.assignee === agent.agentId || t.assignee === agent.name
                )
                const currentTask = agentTasks.find(t => t.status === 'in_progress') || agentTasks[0]

                return (
                  <div key={agent.agentId} className="tmux-teammate-card">
                    <div className="tmux-teammate-header">
                      <span className="tmux-teammate-icon">🤖</span>
                      <span className="tmux-teammate-name">{agent.name}</span>
                      <span className="tmux-teammate-type">{agent.agentType}</span>
                    </div>
                    <div className="tmux-teammate-task">
                      {currentTask ? (
                        <>
                          <span className="tmux-task-status-icon">{statusIcon[currentTask.status] || '○'}</span>
                          <span className="tmux-task-subject">{currentTask.subject}</span>
                        </>
                      ) : (
                        <span className="tmux-teammate-idle">Idle</span>
                      )}
                    </div>
                    {agentTasks.length > 0 && (
                      <div className="tmux-teammate-stats">
                        {agentTasks.filter(t => t.status === 'completed').length}/{agentTasks.length} tasks
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <div className="tmux-teammates-empty">No teammates</div>
            )}
          </div>

          {/* Recent tasks */}
          {tasks.length > 0 && (
            <div className="tmux-recent-tasks">
              <div className="tmux-recent-header">Recent Tasks</div>
              {tasks.slice(0, 5).map(task => (
                <div key={task.id} className={`tmux-recent-task ${task.status}`}>
                  <span className="tmux-task-status-icon">{statusIcon[task.status] || '○'}</span>
                  <span className="tmux-task-subject">{task.subject}</span>
                  {task.assignee && (
                    <span className="tmux-task-assignee">{task.assignee}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
