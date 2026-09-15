import { useEffect, useState } from 'react'
import { Loader, Copy, Check, Users, Award, Gift } from 'lucide-react'
import { usersAPI } from '../services/api'

export default function Settings() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    usersAPI.getMe()
      .then(res => setUser(res.data))
      .catch(() => setError('Could not load your account settings'))
      .finally(() => setLoading(false))
  }, [])

  const referralLink = user?.referral_code
    ? `${window.location.origin}/register?ref=${user.referral_code}`
    : ''

  const handleCopy = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy link — please copy it manually')
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader size={32} className="animate-spin text-blue-600" />
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {user && (
        <div className="space-y-6">
          {/* Referral program */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Gift size={20} className="text-blue-600" /> Refer &amp; Earn
            </h2>
            <p className="text-gray-600 mb-4">
              Share your link. When someone you referred lands their first hire on Content-Forge.pro,
              you earn a real $25 credit — no limit on how many times.
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={referralLink}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 text-sm"
              />
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 whitespace-nowrap"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
            </div>
            <p className="flex items-center gap-1 text-gray-500 text-sm mt-3">
              <Users size={14} />
              {user.referral_count || 0} people joined using your link
            </p>
          </div>

          {/* Achievement badges */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Award size={20} className="text-blue-600" /> Your Badges
            </h2>
            {user.badges && user.badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.badges.map((badge) => (
                  <span
                    key={badge.key}
                    title={badge.description}
                    className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    <Award size={14} />
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-sm">
                Complete projects and earn great reviews to unlock badges on your public profile.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
