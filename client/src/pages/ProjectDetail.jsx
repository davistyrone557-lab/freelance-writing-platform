import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { AlertCircle, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { automationAPI, bidsAPI, projectsAPI } from '../services/api'

export default function ProjectDetail() {
  const { id } = useParams()
  const { user, isAuthenticated } = useAuthStore()
  const [project, setProject] = useState(null)
  const [bids, setBids] = useState([])
  const [loading, setLoading] = useState(true)
  const [runningAction, setRunningAction] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isClientOwner = project && user?.role === 'client' && project.client_id === user.id

  useEffect(() => {
    fetchProject()
  }, [id, isAuthenticated])

  const fetchProject = async () => {
    setLoading(true)

    try {
      const projectRes = await projectsAPI.getById(id)
      setProject(projectRes.data)

      if (isAuthenticated) {
        try {
          const bidsRes = await projectsAPI.getBids(id)
          setBids(bidsRes.data.bids || [])
        } catch {
          setBids([])
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load project')
    } finally {
      setLoading(false)
    }
  }

  const runAction = async (actionName, fn) => {
    setRunningAction(actionName)
    setError('')
    setMessage('')

    try {
      const res = await fn()
      setMessage(res.data.message || 'Automation completed.')
      await fetchProject()
    } catch (err) {
      setError(err.response?.data?.error || 'Automation failed')
    } finally {
      setRunningAction('')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading project...</div>
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-600">Project not found.</div>
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl shadow-md p-8 mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start">
          <div>
            <h1 className="text-3xl font-bold">{project.title}</h1>
            <p className="text-gray-600 mt-3">{project.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">${project.budget}</div>
            <div className="mt-2 inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
              {project.status}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-sm text-gray-600">
          <div><span className="font-semibold text-gray-900">Category:</span> {project.category || 'General'}</div>
          <div><span className="font-semibold text-gray-900">Deadline:</span> {project.deadline ? new Date(project.deadline).toLocaleDateString() : 'Not set'}</div>
          <div><span className="font-semibold text-gray-900">Client:</span> {project.first_name} {project.last_name}</div>
        </div>
      </div>

      {(message || error) && (
        <div className={`rounded-lg px-4 py-3 mb-6 flex items-center gap-2 ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {error && <AlertCircle size={18} />}
          <span>{error || message}</span>
        </div>
      )}

      {isClientOwner && (
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Automation Controls</h2>
          <div className="flex flex-wrap gap-3">
            {project.status === 'open' && (
              <>
                <button
                  onClick={() => runAction('match', () => automationAPI.autoMatch(project.id))}
                  disabled={runningAction === 'match'}
                  className="inline-flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 disabled:opacity-60"
                >
                  <Sparkles size={18} />
                  {runningAction === 'match' ? 'Matching...' : 'Auto-Match Writers'}
                </button>
                <button
                  onClick={() => runAction('accept', () => automationAPI.autoAcceptBid(project.id))}
                  disabled={runningAction === 'accept'}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                >
                  {runningAction === 'accept' ? 'Accepting...' : 'Auto-Accept Best Bid'}
                </button>
              </>
            )}

            {project.status === 'in_progress' && (
              <button
                onClick={() => runAction('dispute', () => automationAPI.autoDisputeCheck(project.id))}
                disabled={runningAction === 'dispute'}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-60"
              >
                {runningAction === 'dispute' ? 'Checking...' : 'Run Overdue Dispute Check'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Bids</h2>

        {bids.length === 0 ? (
          <p className="text-gray-600">No bid data is available for this project yet.</p>
        ) : (
          <div className="space-y-4">
            {bids.map(bid => (
              <div key={bid.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex flex-col gap-2 md:flex-row md:justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {bid.first_name} {bid.last_name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{bid.proposal}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-blue-600">${bid.amount}</div>
                    <div className="text-sm text-gray-600">
                      {bid.delivery_days ? `${bid.delivery_days} day delivery` : 'Timeline not set'}
                    </div>
                    <div className="text-xs mt-1 uppercase tracking-wide text-gray-500">{bid.status}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
