import { create } from 'zustand'
import { messagesAPI } from '../services/api'

const useMessagesStore = create((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  isLoading: false,
  error: null,
  isTyping: false,
  socketConnected: false,

  setActiveConversation: (conversationId) => set({ activeConversationId: conversationId }),
  setTyping: (isTyping) => set({ isTyping }),
  setSocketConnected: (socketConnected) => set({ socketConnected }),

  fetchConversations: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await messagesAPI.getConversations()
      set({ conversations: response.data.conversations || [], isLoading: false })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to load conversations', isLoading: false })
      throw error
    }
  },

  createConversation: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await messagesAPI.createConversation(data)
      const conversation = response.data.conversation
      set((state) => ({
        conversations: state.conversations.some((item) => item.id === conversation.id)
          ? state.conversations
          : [conversation, ...state.conversations],
        activeConversationId: conversation.id,
        isLoading: false
      }))
      if (response.data.message) {
        set((state) => ({ messages: [...state.messages, response.data.message] }))
      }
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to create conversation', isLoading: false })
      throw error
    }
  },

  fetchConversationMessages: async (conversationId) => {
    set({ isLoading: true, error: null, activeConversationId: conversationId })
    try {
      const response = await messagesAPI.getConversation(conversationId)
      set({ messages: response.data.messages || [], isLoading: false })
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to load messages', isLoading: false })
      throw error
    }
  },

  sendMessage: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const response = await messagesAPI.sendMessage(data)
      const message = response.data.data
      set((state) => ({ messages: [...state.messages, message], isLoading: false }))
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to send message', isLoading: false })
      throw error
    }
  },

  markMessageRead: async (messageId) => {
    try {
      const response = await messagesAPI.markRead(messageId)
      set((state) => ({
        messages: state.messages.map((message) => message.id === messageId ? response.data.data : message)
      }))
      return response.data
    } catch (error) {
      set({ error: error.response?.data?.error || 'Failed to mark message as read' })
      throw error
    }
  },

  addIncomingMessage: (message) => {
    const currentMessages = get().messages
    if (currentMessages.some((item) => item.id === message.id)) return
    set((state) => ({ messages: [...state.messages, message] }))
  }
}))

export { useMessagesStore }
