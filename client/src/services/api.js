import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

api.interceptors.request.use((config) => {
  const persistedState = localStorage.getItem('auth-store')
  if (persistedState) {
    const parsed = JSON.parse(persistedState)
    const token = parsed.state?.token
    if (token) {
      config.headers.Authorization = 'Bearer ' + token
    }
  }
  return config
})

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  refreshToken: (token) => api.post('/auth/refresh', { token })
}

export const projectsAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data)
}

export const bidsAPI = {
  create: (projectId, data) => api.post(`/projects/${projectId}/bids`, data),
  getMyBids: () => api.get('/bids/my-bids'),
  update: (bidId, data) => api.put(`/bids/${bidId}`, data),
  remove: (bidId) => api.delete(`/bids/${bidId}`),
  accept: (projectId, bidId) => api.post(`/projects/${projectId}/bids/${bidId}/accept`),
  reject: (projectId, bidId) => api.post(`/projects/${projectId}/bids/${bidId}/reject`)
}

export const paymentsAPI = {
  createIntent: (data) => api.post('/payments/intent', data),
  confirmPayment: (data) => api.post('/payments/confirm', data),
  requestWithdrawal: (data) => api.post('/payments/withdraw', data),
  getBalance: () => api.get('/payments/balance'),
  getHistory: () => api.get('/payments/history'),
  connectAccount: (data) => api.post('/payments/connect-account', data)
}

export const messagesAPI = {
  getConversations: () => api.get('/messages/conversations'),
  createConversation: (data) => api.post('/messages/conversations', data),
  getConversation: (conversationId) => api.get(`/messages/conversations/${conversationId}`),
  sendMessage: (data) => api.post('/messages/send', data),
  markRead: (messageId) => api.put(`/messages/${messageId}/read`)
}

export const usersAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  getById: (id) => api.get(`/users/${id}`),
  search: (params) => api.get('/users/search', { params }),
  uploadAvatar: (formData) => api.post('/users/me/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const reviewsAPI = {
  create: (projectId, data) => api.post(`/projects/${projectId}/reviews`, data),
  getUserReviews: (userId) => api.get(`/users/${userId}/reviews`)
}

export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  remove: (id) => api.delete(`/notifications/${id}`)
}

export default api
