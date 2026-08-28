import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle, Users, DollarSign, Zap, Star, Shield } from 'lucide-react'

export default function Home() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold mb-6">Quality Content, Forged by Experts</h1>
          <p className="text-xl mb-10 text-blue-100 max-w-2xl mx-auto">
            Content-Forge.pro connects professional writers with businesses that need exceptional content. Post a project, receive bids, and get paid securely.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/register?role=writer" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 flex items-center gap-2">
              Join as Writer <ArrowRight size={20} />
            </Link>
            <Link to="/register?role=client" className="bg-blue-500 text-white border border-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-400 flex items-center gap-2">
              Hire Writers <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-4">Why Choose Content-Forge.pro?</h2>
          <p className="text-center text-gray-500 mb-12">Everything you need to build successful content partnerships.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard icon={<Users size={32} />} title="Vetted Writers" description="Every writer is reviewed and rated. Find specialists for any niche." />
            <FeatureCard icon={<DollarSign size={32} />} title="Secure Escrow Payments" description="Funds are held safely until work is delivered. Powered by Stripe." />
            <FeatureCard icon={<Zap size={32} />} title="Fast Turnaround" description="Get proposals within hours. Set deadlines that work for you." />
            <FeatureCard icon={<CheckCircle size={32} />} title="Quality Guaranteed" description="5-star rating system and detailed reviews ensure you hire the best." />
            <FeatureCard icon={<Shield size={32} />} title="Dispute Protection" description="Our team mediates any disputes to ensure fair outcomes." />
            <FeatureCard icon={<Star size={32} />} title="Top Writer Badges" description="Recognize excellence with Top-Rated and Super Writer badges." />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <StepCard step="1" title="Post a Project" description="Describe what you need, set your budget, and publish your project." />
            <StepCard step="2" title="Receive Bids" description="Qualified writers submit proposals. Review and choose the best fit." />
            <StepCard step="3" title="Get Content & Pay" description="Approve the work and release payment safely through escrow." />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <StatCard number="1,200+" label="Active Writers" />
            <StatCard number="800+" label="Satisfied Clients" />
            <StatCard number="$750K+" label="Total Paid Out" />
            <StatCard number="4.9★" label="Average Rating" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Creating?</h2>
          <p className="text-xl mb-8">Join thousands of writers and clients building successful content partnerships.</p>
          <Link to="/register" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 inline-block">
            Create Your Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold text-white mb-4">Platform</h3>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="hover:text-white">Home</Link></li>
                <li><Link to="/projects" className="hover:text-white">Browse Projects</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About Us</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-white mb-4">Contact</h3>
              <ul className="space-y-2 text-sm">
                <li><a href="mailto:support@content-forge.pro" className="hover:text-white">support@content-forge.pro</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; 2025 Content-Forge.pro. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition border border-gray-100">
      <div className="text-blue-600 mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function StepCard({ step, title, description }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-md">
      <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-xl mx-auto mb-4">{step}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function StatCard({ number, label }) {
  return (
    <div className="p-6">
      <div className="text-4xl font-bold text-blue-600 mb-2">{number}</div>
      <p className="text-gray-600">{label}</p>
    </div>
  )
}
