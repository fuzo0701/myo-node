import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  cwd: string
}

interface HistoryStore {
  conversations: Conversation[]
  activeConversationId: string | null
  searchQuery: string

  // Actions
  createConversation: (cwd: string) => string
  addMessage: (conversationId: string, role: 'user' | 'assistant', content: string) => void
  updateConversationTitle: (id: string, title: string) => void
  deleteConversation: (id: string) => void
  clearAllConversations: () => void
  setActiveConversation: (id: string | null) => void
  setSearchQuery: (query: string) => void
  getFilteredConversations: () => Conversation[]
  getConversation: (id: string) => Conversation | undefined
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function generateTitle(firstMessage: string): string {
  const cleaned = firstMessage.replace(/\s+/g, ' ').trim()
  return cleaned.length > 50 ? cleaned.slice(0, 50) + '...' : cleaned
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      searchQuery: '',

      createConversation: (cwd: string) => {
        const id = generateId()
        const now = Date.now()
        const conversation: Conversation = {
          id,
          title: 'New Conversation',
          messages: [],
          createdAt: now,
          updatedAt: now,
          cwd,
        }
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }))
        return id
      },

      addMessage: (conversationId, role, content) => {
        const message: Message = {
          id: generateId(),
          role,
          content,
          timestamp: Date.now(),
        }
        set((state) => ({
          conversations: state.conversations.map((conv) => {
            if (conv.id !== conversationId) return conv
            const messages = [...conv.messages, message]
            const title = conv.messages.length === 0 && role === 'user'
              ? generateTitle(content)
              : conv.title
            return {
              ...conv,
              messages,
              title,
              updatedAt: Date.now(),
            }
          }),
        }))
      },

      updateConversationTitle: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((conv) =>
            conv.id === id ? { ...conv, title, updatedAt: Date.now() } : conv
          ),
        }))
      },

      deleteConversation: (id) => {
        set((state) => {
          const newConversations = state.conversations.filter((c) => c.id !== id)
          const newActiveId = state.activeConversationId === id
            ? newConversations[0]?.id ?? null
            : state.activeConversationId
          return {
            conversations: newConversations,
            activeConversationId: newActiveId,
          }
        })
      },

      clearAllConversations: () => {
        set({
          conversations: [],
          activeConversationId: null,
        })
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id })
      },

      setSearchQuery: (query) => {
        set({ searchQuery: query })
      },

      getFilteredConversations: () => {
        const { conversations, searchQuery } = get()
        if (!searchQuery.trim()) return conversations
        const query = searchQuery.toLowerCase()
        return conversations.filter((conv) =>
          conv.title.toLowerCase().includes(query) ||
          conv.messages.some((msg) => msg.content.toLowerCase().includes(query))
        )
      },

      getConversation: (id) => {
        return get().conversations.find((c) => c.id === id)
      },
    }),
    {
      name: 'myonode-history',
      partialize: (state) => ({
        conversations: state.conversations,
      }),
    }
  )
)
