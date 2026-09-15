import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, DollarSign, TrendingUp } from 'lucide-react'
import { automationAPI, paymentsAPI, projectsAPI } from '../services/api'

const categories = ['general', 'blog', 'technical', 'copywriting', 'content']

export default function WriterDashboard() {
  const [balance, setBalance] = useState(0)
  const [projects, setProjects] = useState([])
  const [pricingGuide, setPricingGuide] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState('general')
  const [loading, setLoading] = useState(true)
  const [guideLoading, setGuideLoading] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    fetchPricingGuide(selectedCategory)
  }, [selectedCategory])

  const fetchData = async () => {
    try {
      const [balanceRes, projectsRes] = await Promise.all([
        paymentsAPI.getBalance(),
        projectsAPI.getAll({ status: 'open' })
      ])

      setBalance(Number(balanceRes.data.balance || 0))
      setProjects(projectsRes.data.projects)
    } catch (err) {
      console.error('Error fetching data:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchPricingGuide = async (category) => {
    setGuideLoading(true)

    try {
      const res = await automationAPI.getWriterPricingGuide(category)
      setPricingGuide(res.data)
    } catch (err) {
      console.error('Error fetching pricing guide:', err)
    } finally {
      setGuideLoading(false)
    }
  }

  const handleWithdraw = async (e) => {
    e.preventDefault()
    setError('')

    try {
      await paymentsAPI.requestWithdrawal({ amount: parseFloat(withdrawAmount) })
      setWithdrawAmount('')
      fetchData()
      alert('Withdrawal request submitted! Check your email for confirmation.')
    } catch (err) {
      setError(err.response?.data?.error || 'Withdrawal failed')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Writer Dashboard</h1>

      <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-8 mb-8">
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg shadow-lg p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 mb-2">Available Balance</p>
              <p className="text-5xl font-bold">${balance.toFixed(2)}</p>
            </div>
            <DollarSign size={64} className="opacity-20" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-violet-600" size={20} />
            <h2 className="text-xl font-bold">Automation Pricing Guide</h2>
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>

          {guideLoading || !pricingGuide ? (
            <p className="text-gray-600">Loading market guidance...</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-600">Economy</span><span className="font-semibold">${pricingGuide.competitiveRates.economy}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Standard</span><span className="font-semibold">${pricingGuide.competitiveRates.standard}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Premium</span><span className="font-semibold">${pricingGuide.competitiveRates.premium}</span></div>
              <div className="pt-3 border-t border-gray-100 text-gray-600">
                Avg accepted bid: ${pricingGuide.marketData.averageBid} · Accepted bids: {pricingGuide.marketData.totalAcceptedBids}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Request Withdrawal</h2>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 flex items-center gap-2">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
        <form onSubmit={handleWithdraw} className="flex gap-4">
          <input
            type="number"
            step="0.01"
            min="50"
            placeholder="Amount (min $50)"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700"
          >
            Withdraw to Bank
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-2">Funds arrive in 1-3 business days. Connect your payout account in Settings first.</p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold mb-4">Available Projects</h2>
        {projects.length === 0 ? (
          <p className="text-gray-600">No projects available right now.</p>
        ) : (
          <div className="space-y-4">
            {projects.map(project => (
              <div key={project.id} className="border-l-4 border-blue-600 pl-4 py-2">
                <h3 className="font-semibold text-lg">{project.title}</h3>
                <p className="text-gray-600 text-sm mb-2">{project.description.substring(0, 100)}...</p>
                <div className="flex justify-between items-center">
                  <span className="text-blue-600 font-bold">${project.budget}</span>
                  <Link to={`/projects/${project.id}`} className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700">
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
