import { useEffect, useState } from 'react'
import { Users, FolderOpen, BarChart2, Loader, Ban } from 'lucide-react'
import api from '../services/api'

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState(null)
  const [users, setUsers] = useState([])
  const [tab, setTab] = useState('overview')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/admin/analytics'),
      api.get('/admin/users')
    ]).then(([analyticsRes, usersRes]) => {
      setAnalytics(analyticsRes.data)
      setUsers(usersRes.data.users)
    }).catch(console.error)
     .finally(() => setLoading(false))
  }, [])

  const handleBan = async (userId) => {
    if (!confirm('Ban this user?')) return
    try {
      await api.post(`/admin/users/${userId}/ban`)
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: true } : u))
    } catch (err) {
      alert('Failed to ban user')
    }
  }

  const handleUnban = async (userId) => {
    try {
      await api.post(`/admin/users/${userId}/unban`)
      setUsers(users.map(u => u.id === userId ? { ...u, is_banned: false } : u))
    } catch (err) {
      alert('Failed to unban user')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader size={32} className="animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-8">
        {[['overview', 'Overview'], ['users', 'Users']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-3 px-2 font-medium transition border-b-2 ${tab === key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && analytics && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard icon={<Users className="text-blue-600" />} title="Total Users" value={analytics.users.total} subtitle={`${analytics.users.writers} writers · ${analytics.users.clients} clients`} />
            <StatCard icon={<FolderOpen className="text-green-600" />} title="Total Projects" value={analytics.projects.total} subtitle={`${analytics.projects.open} open · ${analytics.projects.completed} completed`} />
            <StatCard icon={<BarChart2 className="text-purple-600" />} title="Total Volume" value={`$${parseFloat(analytics.payments.total_volume || 0).toLocaleString()}`} subtitle={`${analytics.payments.total_transactions} transactions`} />
          </div>

          {analytics.recentUsers.length > 0 && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h2 className="text-lg font-semibold mb-4">Recent Signups</h2>
              <div className="space-y-3">
                {analytics.recentUsers.map(u => (
                  <div key={u.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{u.first_name} {u.last_name}</p>
                      <p className="text-sm text-gray-500">{u.email} · {u.role}</p>
                    </div>
                    <span className="text-sm text-gray-400">{new Date(u.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Email</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Role</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3">{u.first_name} {u.last_name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3 capitalize">{u.role}</td>
                  <td className="px-4 py-3">
                    {u.is_banned ? (
                      <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">Banned</span>
                    ) : (
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'admin' && (
                      u.is_banned ? (
                        <button onClick={() => handleUnban(u.id)} className="text-blue-600 hover:underline text-sm">Unban</button>
                      ) : (
                        <button onClick={() => handleBan(u.id)} className="text-red-600 hover:underline text-sm flex items-center gap-1">
                          <Ban size={14} /> Ban
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, title, value, subtitle }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">{icon}</div>
        <h3 className="font-medium text-gray-700">{title}</h3>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
    </div>
  )
}
