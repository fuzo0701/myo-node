import { create } from 'zustand'

export interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
  timestamp: number
  expiresAt?: number
}

interface NotificationStore {
  notifications: Notification[]
  addNotification: (type: Notification['type'], message: string, duration?: number) => void
  removeNotification: (id: string) => void
  clearAll: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],

  addNotification: (type, message, duration = 5000) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(7)
    const timestamp = Date.now()
    const expiresAt = duration > 0 ? timestamp + duration : undefined

    set((state) => ({
      notifications: [...state.notifications, { id, type, message, timestamp, expiresAt }]
    }))

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id)
        }))
      }, duration)
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id)
    }))
  },

  clearAll: () => {
    set({ notifications: [] })
  }
}))
