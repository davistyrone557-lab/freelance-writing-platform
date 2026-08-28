import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Menu, X, LogOut, Settings, MessageSquare, Home } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
  const { user, logout } = useAuthStore()
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
              <span className="text-white font-bold">FW</span>
            </div>
            <span className="font-bold text-lg text-gray-900">FreelanceWriting.pro</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/dashboard" className="text-gray-600 hover:text-gray-900 flex items-center gap-2">
              <Home size={20} /> Dashboard
            </Link>
            <Link to="/projects" className="text-gray-600 hover:text-gray-900">Projects</Link>
            <Link to="/messages" className="text-gray-600 hover:text-gray-900 flex items-center gap-2">
              <MessageSquare size={20} /> Messages
            </Link>
            
            <div className="flex items-center space-x-4 border-l pl-6">
              <span className="text-sm text-gray-600">{user?.first_name || 'User'}</span>
              <Link to="/settings" className="text-gray-600 hover:text-gray-900">
                <Settings size={20} />
              </Link>
              <button
                onClick={handleLogout}
                className="text-red-600 hover:text-red-700 flex items-center gap-2"
              >
                <LogOut size={20} /> Logout
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link to="/dashboard" className="block px-4 py-2 text-gray-600 hover:bg-gray-50">
              Dashboard
            </Link>
            <Link to="/projects" className="block px-4 py-2 text-gray-600 hover:bg-gray-50">
              Projects
            </Link>
            <Link to="/messages" className="block px-4 py-2 text-gray-600 hover:bg-gray-50">
              Messages
            </Link>
            <Link to="/settings" className="block px-4 py-2 text-gray-600 hover:bg-gray-50">
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
