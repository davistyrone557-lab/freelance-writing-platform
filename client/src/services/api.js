import axios from 'axios'

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth-store')
  if (token) {
    const parsed = JSON.parse(token)
    if (parsed.state?.token) {
      config.headers.Authorization = `Bearer ${parsed.state.token}`
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
  update: (id, data) => api.put(`/projects/${id}`, data),
  submitBid: (projectId, data) => api.post(`/projects/${projectId}/bids`, data),
  acceptBid: (projectId, bidId) => api.post(`/projects/${projectId}/bids/${bidId}/accept`)
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
  getMessages: (conversationId) => api.get(`/messages/${conversationId}`),
  sendMessage: (data) => api.post('/messages/send', data)
}

export default api
