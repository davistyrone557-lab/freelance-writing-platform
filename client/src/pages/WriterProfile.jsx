import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Star, Award, CheckCircle, Clock, Loader } from 'lucide-react'
import api from '../services/api'

export default function WriterProfile() {
  const { id } = useParams()
  const [writer, setWriter] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get(`/users/${id}`)
      .then(res => setWriter(res.data))
      .catch(() => setError('Writer not found'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader size={32} className="animate-spin text-blue-600" />
    </div>
  )
  if (error) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-red-600">{error}</p>
    </div>
  )

  const skills = Array.isArray(writer.skills) ? writer.skills : (writer.skills ? JSON.parse(writer.skills) : [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-8 mb-6">
        <div className="flex items-start gap-6">
          {writer.avatar_url ? (
            <img src={writer.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center text-3xl font-bold text-blue-600">
              {writer.first_name[0]}{writer.last_name[0]}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{writer.first_name} {writer.last_name}</h1>
            <div className="flex items-center gap-4 mt-2 text-gray-600">
              {writer.rating > 0 && (
                <span className="flex items-center gap-1">
                  <Star size={16} className="text-yellow-400 fill-yellow-400" />
                  {parseFloat(writer.rating).toFixed(1)} ({writer.total_reviews} reviews)
                </span>
              )}
              <span className="flex items-center gap-1">
                <CheckCircle size={16} className="text-green-500" />
                {writer.total_projects_completed || 0} projects completed
              </span>
              <span className="flex items-center gap-1">
                <Clock size={16} />
                Member since {new Date(writer.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {writer.bio && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-2">About</h2>
            <p className="text-gray-600 leading-relaxed">{writer.bio}</p>
          </div>
        )}

        {skills.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">Skills</h2>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <span key={i} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reviews */}
      {writer.recent_reviews && writer.recent_reviews.length > 0 && (
        <div className="bg-white rounded-xl shadow-md p-8">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Award size={20} className="text-blue-600" /> Recent Reviews
          </h2>
          <div className="space-y-4">
            {writer.recent_reviews.map((review, i) => (
              <div key={i} className="border-b pb-4 last:border-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-900">{review.reviewer_first} {review.reviewer_last}</span>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={14} className={j < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
                    ))}
                  </div>
                </div>
                <p className="text-gray-600 text-sm">{review.feedback}</p>
                <p className="text-gray-400 text-xs mt-1">{new Date(review.created_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
