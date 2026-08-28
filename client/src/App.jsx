import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import WriterDashboard from './pages/WriterDashboard'
import ClientDashboard from './pages/ClientDashboard'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Messages from './pages/Messages'
import Settings from './pages/Settings'
import WriterProfile from './pages/WriterProfile'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import AdminDashboard from './pages/AdminDashboard'
import { useAuthStore } from './store/authStore'

function App() {
  const { user, isAuthenticated } = useAuthStore()

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/writers/:id" element={<WriterProfile />} />

          {isAuthenticated && (
            <>
              <Route
                path="/dashboard"
                element={
                  user?.role === 'writer' ? <WriterDashboard /> :
                  user?.role === 'admin' ? <AdminDashboard /> :
                  <ClientDashboard />
                }
              />
              <Route path="/messages" element={<Messages />} />
              <Route path="/settings" element={<Settings />} />
              {user?.role === 'admin' && <Route path="/admin" element={<AdminDashboard />} />}
            </>
          )}

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App
