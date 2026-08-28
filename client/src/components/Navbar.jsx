import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Menu, X, LogOut, Settings, MessageSquare, LayoutDashboard, Hammer } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Hammer size={16} className="text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">Content-Forge.pro</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/projects" className="text-gray-600 hover:text-gray-900">Browse Projects</Link>

            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
                  <LayoutDashboard size={18} /> Dashboard
                </Link>
                <Link to="/messages" className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
                  <MessageSquare size={18} /> Messages
                </Link>
                <div className="flex items-center space-x-4 border-l pl-6">
                  <span className="text-sm font-medium text-gray-700">{user?.first_name}</span>
                  <Link to="/settings" className="text-gray-600 hover:text-gray-900">
                    <Settings size={20} />
                  </Link>
                  <button onClick={handleLogout} className="text-red-600 hover:text-red-700 flex items-center gap-1">
                    <LogOut size={18} /> Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link to="/login" className="text-gray-600 hover:text-gray-900">Login</Link>
                <Link to="/register" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
                  Sign Up Free
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-1 border-t pt-2">
            <Link to="/projects" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded">Browse Projects</Link>
            {isAuthenticated ? (
              <>
                <Link to="/dashboard" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded">Dashboard</Link>
                <Link to="/messages" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded">Messages</Link>
                <Link to="/settings" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded">Settings</Link>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50 rounded">Logout</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-4 py-2 text-gray-600 hover:bg-gray-50 rounded">Login</Link>
                <Link to="/register" className="block px-4 py-2 text-blue-600 font-medium hover:bg-gray-50 rounded">Sign Up</Link>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
