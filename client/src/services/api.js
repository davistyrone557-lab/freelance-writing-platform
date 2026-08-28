import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  try {
    const stored = localStorage.getItem('auth-store')
    if (stored) {
      const parsed = JSON.parse(stored)
      const token = parsed.state?.token
      if (token) {
        config.headers.Authorization = 'Bearer ' + token
      }
    }
  } catch {
    // ignore parse errors
  }
  return config
})

// Handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth-store')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token) => api.post('/auth/verify-email', { token }),
  refreshToken: (token) => api.post('/auth/refresh', { token })
}

export const usersAPI = {
  getMe: () => api.get('/users/me'),
  updateMe: (data) => api.put('/users/me', data),
  getById: (id) => api.get(`/users/${id}`),
  search: (params) => api.get('/users/search', { params }),
  deleteMe: () => api.delete('/users/me')
}

export const projectsAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getById: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  delete: (id) => api.delete(`/projects/${id}`),
  complete: (id) => api.post(`/projects/${id}/complete`),
  getBids: (projectId) => api.get(`/bids/projects/${projectId}/bids`)
}

export const bidsAPI = {
  getMyBids: () => api.get('/bids/my-bids'),
  getById: (id) => api.get(`/bids/${id}`),
  place: (projectId, data) => api.post(`/bids/projects/${projectId}/bids`, data),
  update: (id, data) => api.put(`/bids/${id}`, data),
  cancel: (id) => api.delete(`/bids/${id}`),
  accept: (projectId, bidId) => api.post(`/bids/projects/${projectId}/bids/${bidId}/accept`),
  reject: (projectId, bidId) => api.post(`/bids/projects/${projectId}/bids/${bidId}/reject`)
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
  createConversation: (recipientId) => api.post('/messages/conversations', { recipientId }),
  getMessages: (conversationId) => api.get(`/messages/conversations/${conversationId}`),
  send: (conversationId, content) => api.post('/messages/send', { conversationId, content }),
  markRead: (id) => api.put(`/messages/${id}/read`),
  delete: (id) => api.delete(`/messages/${id}`)
}

export const reviewsAPI = {
  submit: (data) => api.post('/reviews', data),
  getForUser: (userId) => api.get(`/reviews/user/${userId}`),
  getById: (id) => api.get(`/reviews/${id}`),
  update: (id, data) => api.put(`/reviews/${id}`, data)
}

export const adminAPI = {
  getUsers: (params) => api.get('/admin/users', { params }),
  getProjects: () => api.get('/admin/projects'),
  banUser: (id, reason) => api.post(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id) => api.post(`/admin/users/${id}/unban`),
  getAnalytics: () => api.get('/admin/analytics'),
  resolveDispute: (id, data) => api.post(`/admin/disputes/${id}/resolve`, data)
}

export default api
