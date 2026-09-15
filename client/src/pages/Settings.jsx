import { useEffect, useState } from 'react'
import { CheckCircle2, CreditCard } from 'lucide-react'
import { paymentsAPI, usersAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'

export default function Settings() {
  const { updateUser } = useAuthStore()
  const [bankAccountToken, setBankAccountToken] = useState('')
  const [accountId, setAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const res = await usersAPI.getMe()
      const stripeAccountId = res.data.stripe_account_id || ''
      setAccountId(stripeAccountId)
      updateUser({ stripe_account_id: stripeAccountId })
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const res = await paymentsAPI.connectAccount({ bankAccountToken })
      setAccountId(res.data.accountId)
      updateUser({ stripe_account_id: res.data.accountId })
      setBankAccountToken('')
      setMessage('Stripe payout account connected successfully.')
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to connect payout account')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading settings...</div>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {(message || error) && (
        <div className={`rounded-lg px-4 py-3 mb-6 ${error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {error || message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-center gap-3 mb-6">
          <CreditCard className="text-blue-600" />
          <div>
            <h2 className="text-xl font-bold">Payout Account</h2>
            <p className="text-gray-600 text-sm">Connect Stripe payout details so automation-backed payments and withdrawals can complete.</p>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <CheckCircle2 size={18} className={accountId ? 'text-green-600' : 'text-gray-400'} />
            {accountId ? 'Connected' : 'Not connected'}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {accountId ? `Stripe account ID: ${accountId}` : 'Connect a payout account before requesting withdrawals.'}
          </p>
        </div>

        <form onSubmit={handleConnect} className="space-y-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-2">Bank account token</span>
            <input
              type="text"
              value={bankAccountToken}
              onChange={(e) => setBankAccountToken(e.target.value)}
              placeholder="btok_..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              required
            />
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? 'Connecting...' : 'Connect Payout Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
