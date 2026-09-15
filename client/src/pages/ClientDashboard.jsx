import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Wand2 } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { automationAPI, projectsAPI } from '../services/api'

export default function ClientDashboard() {
  const { user } = useAuthStore()
  const [projects, setProjects] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [autoApproving, setAutoApproving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: '',
    category: 'general',
    deadline: '',
    topic: '',
    wordCount: 1000
  })

  useEffect(() => {
    fetchProjects()
  }, [user?.id])

  const fetchProjects = async () => {
    try {
      const res = await projectsAPI.getAll()
      const ownProjects = res.data.projects.filter(project => project.client_id === user?.id)
      setProjects(ownProjects)
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleGenerateTemplate = async () => {
    setGenerating(true)
    setError('')
    setMessage('')

    try {
      const res = await automationAPI.generateProjectTemplate({
        title: formData.title,
        category: formData.category,
        budget: formData.budget || 0,
        keywords: {
          topic: formData.topic,
          wordCount: Number(formData.wordCount) || 1000,
          deadline: formData.deadline || undefined
        }
      })

      setFormData(current => ({ ...current, description: res.data.description }))
      setMessage('Template generated. Review it before posting.')
    } catch (err) {
      setError(err.response?.data?.error || 'Template generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      await projectsAPI.create({
        title: formData.title,
        description: formData.description,
        budget: formData.budget,
        category: formData.category,
        deadline: formData.deadline
      })

      setFormData({
        title: '',
        description: '',
        budget: '',
        category: 'general',
        deadline: '',
        topic: '',
        wordCount: 1000
      })
      setShowForm(false)
      setMessage('Project created successfully.')
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.error || 'Error creating project')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAutoMatch = async (projectId) => {
    setError('')
    setMessage('')

    try {
      const res = await automationAPI.autoMatch(projectId)
      setMessage(`Matched ${res.data.matchedWriters} writers for project #${projectId}.`)
    } catch (err) {
      setError(err.response?.data?.error || 'Auto-match failed')
    }
  }

  const handleAutoApprove = async () => {
    setAutoApproving(true)
    setError('')
    setMessage('')

    try {
      const res = await automationAPI.autoApproveProjects()
      setMessage(`Released payouts for ${res.data.projectsApproved} completed project(s).`)
      fetchProjects()
    } catch (err) {
      setError(err.response?.data?.error || 'Auto-approval failed')
    } finally {
      setAutoApproving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 mb-8 md:flex-row md:justify-between md:items-center">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-gray-600 mt-2">Manage projects and trigger automation from one place.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleAutoApprove}
            disabled={autoApproving}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-60"
          >
            {autoApproving ? 'Running...' : 'Auto-Approve Completed'}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700"
          >
            Post New Project
          </button>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-lg px-4 py-3 mb-6 ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {error || message}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Create New Project</h2>
            <button
              type="button"
              onClick={handleGenerateTemplate}
              disabled={generating}
              className="inline-flex items-center gap-2 bg-violet-100 text-violet-800 px-4 py-2 rounded-lg font-semibold hover:bg-violet-200 disabled:opacity-60"
            >
              <Wand2 size={18} />
              {generating ? 'Generating...' : 'Generate Template'}
            </button>
          </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                name="topic"
                placeholder="Primary topic or niche"
                value={formData.topic}
                onChange={handleChange}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
              <input
                type="number"
                min="250"
                step="50"
                name="wordCount"
                placeholder="Suggested word count"
                value={formData.wordCount}
                onChange={handleChange}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <textarea
              name="description"
              placeholder="Project Description"
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg h-40"
              required
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <input
                type="date"
                name="deadline"
                value={formData.deadline}
                onChange={handleChange}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
              >
                {submitting ? 'Posting...' : 'Post Project'}
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
        {projects.map(project => (
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
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span className="text-blue-600 font-bold text-lg">${project.budget}</span>
              <div className="flex gap-3">
                {project.status === 'open' && (
                  <button
                    onClick={() => handleAutoMatch(project.id)}
                    className="inline-flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700"
                  >
                    <Sparkles size={18} />
                    Auto-Match Writers
                  </button>
                )}
                <Link
                  to={`/projects/${project.id}`}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        ))}

        {projects.length === 0 && (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-600">
            No projects yet. Post one to start using automation tools.
          </div>
        )}
      </div>
    </div>
  )
}
