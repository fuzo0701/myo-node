import { useState, useEffect } from 'react'
import './TaskPanel.css'

interface Task {
  id: string
  title: string
  completed: boolean
}

interface TaskPanelProps {
  isOpen: boolean
  onClose: () => void
  projectPath?: string
}

export default function TaskPanel({
  isOpen,
  onClose,
  projectPath
}: TaskPanelProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadTasks()
    }
  }, [isOpen, projectPath])

  const loadTasks = async () => {
    // TODO: Load tasks from tasks.md or localStorage
    setTasks([])
  }

  const addTask = () => {
    if (!newTaskTitle.trim()) return

    const newTask: Task = {
      id: Date.now().toString(),
      title: newTaskTitle,
      completed: false
    }

    setTasks([...tasks, newTask])
    setNewTaskTitle('')
  }

  const toggleTask = (id: string) => {
    setTasks(tasks.map(task =>
      task.id === id ? { ...task, completed: !task.completed } : task
    ))
  }

  const deleteTask = (id: string) => {
    setTasks(tasks.filter(task => task.id !== id))
  }

  if (!isOpen) return null

  return (
    <div className="task-panel-overlay" onClick={onClose}>
      <div className="task-panel" onClick={(e) => e.stopPropagation()}>
        <div className="task-panel-header">
          <h3>작업 목록</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        <div className="task-panel-add">
          <input
            type="text"
            placeholder="새 작업 추가..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
          />
          <button onClick={addTask}>추가</button>
        </div>
        <div className="task-panel-list">
          {tasks.length === 0 ? (
            <div className="task-panel-empty">작업이 없습니다</div>
          ) : (
            tasks.map(task => (
              <div key={task.id} className="task-item">
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => toggleTask(task.id)}
                />
                <span className={task.completed ? 'completed' : ''}>
                  {task.title}
                </span>
                <button
                  className="task-delete"
                  onClick={() => deleteTask(task.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
