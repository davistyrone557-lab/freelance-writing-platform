import { useEffect, useState } from 'react'
import { projectsAPI } from '../services/api'

export default function ClientDashboard() {
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: '',
    category: 'general',
    deadline: ''
  })

  async function fetchProjects() {
    try {
      const res = await projectsAPI.getAll()
      setProjects(res.data.projects)
    } catch (error) {
      console.error('Error:', error)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [])

  const handleChange = (e) => {
    setFormData((current) => ({ ...current, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await projectsAPI.create(formData)
      setFormData({
        title: '',
        description: '',
        budget: '',
        category: 'general',
        deadline: ''
      })
      setShowForm(false)
      fetchProjects()
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Error creating project')
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Projects</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700"
        >
          Post New Project
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold mb-4">Create New Project</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              name="title"
              placeholder="Project Title"
              value={formData.title}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
            <textarea
              name="description"
              placeholder="Project Description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-24"
              required
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                name="budget"
                placeholder="Budget"
                value={formData.budget}
                onChange={handleChange}
                className="px-4 py-2 border border-gray-300 rounded-lg"
                required
              />
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="general">General Writing</option>
                <option value="blog">Blog Posts</option>
                <option value="technical">Technical Writing</option>
                <option value="copywriting">Copywriting</option>
                <option value="content">Content Marketing</option>
              </select>
            </div>
            <input
              type="date"
              name="deadline"
              value={formData.deadline}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <div className="flex gap-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700"
              >
                Post Project
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid gap-6">
        {projects.map((project) => (
          <div key={project.id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">{project.title}</h3>
                <p className="text-gray-600 text-sm">Posted {new Date(project.created_at).toLocaleDateString()}</p>
              </div>
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                {project.status}
              </span>
            </div>
            <p className="text-gray-600 mb-4">{project.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-blue-600 font-bold text-lg">${project.budget}</span>
              <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                View Bids
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
