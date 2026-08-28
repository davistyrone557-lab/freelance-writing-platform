import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle, Users, DollarSign, Shield, FileText, PenSquare, Briefcase } from 'lucide-react'

export default function Home() {
  return (
    <div className="bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="inline-flex items-center gap-2 bg-blue-500/70 rounded-full px-4 py-1 text-sm font-medium mb-6">
            <CheckCircle size={16} />
            Trusted writing support for individuals and small teams
          </p>
          <h1 className="text-5xl font-bold mb-6">Professional Writing Services Made Simple</h1>
          <p className="text-xl mb-10 text-blue-100 max-w-2xl mx-auto">
            Content-Forge.pro helps everyday clients get polished, reliable writing help for personal and business needs.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Link to="/register?role=client" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 flex items-center gap-2">
              Get Writing Help <ArrowRight size={20} />
            </Link>
            <Link to="/register?role=writer" className="bg-blue-500 text-white border border-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-400 flex items-center gap-2">
              Join as Writer <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-4">Services for Personal and Professional Goals</h2>
          <p className="text-center text-gray-500 mb-12">Choose support that matches what you need right now.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ServiceCard icon={<FileText size={32} />} title="Resumes & Profiles" description="Get clean, modern resumes, LinkedIn summaries, and personal bios that stand out." />
            <ServiceCard icon={<PenSquare size={32} />} title="Personal Writing" description="Receive help with cover letters, statements, and polished communication pieces." />
            <ServiceCard icon={<Briefcase size={32} />} title="Business Content" description="Order website copy, blog posts, and service descriptions tailored to your audience." />
          </div>
        </div>
      </section>

      {/* Why Clients Choose Us */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-12">Why Clients Choose Content-Forge.pro</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <FeatureCard icon={<Users size={32} />} title="Skilled, Verified Writers" description="Work with writers who are reviewed for quality, reliability, and communication." />
            <FeatureCard icon={<DollarSign size={32} />} title="Secure Escrow Payments" description="Your funds stay protected and are only released after approved delivery." />
            <FeatureCard icon={<Shield size={32} />} title="Support You Can Trust" description="Get clear timelines, transparent messaging, and dispute support when needed." />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <StepCard step="1" title="Tell Us What You Need" description="Share your writing goal, deadline, and budget in a few simple steps." />
            <StepCard step="2" title="Choose Your Writer" description="Review matched proposals and select the writer that fits your project." />
            <StepCard step="3" title="Approve with Confidence" description="Receive polished content, request revisions if needed, and release payment securely." />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <StatCard number="1,200+" label="Active Writers" />
            <StatCard number="800+" label="Satisfied Clients" />
            <StatCard number="24hr" label="Typical First Response" />
            <StatCard number="4.9★" label="Client Rating" />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Need Writing Support Right Away?</h2>
          <p className="text-xl mb-8">Create your free account and connect with a writer who can help today.</p>
          <Link to="/register?role=client" className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 inline-block">
            Start as a Client
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
                <li><Link to="/projects" className="hover:text-white">Explore Services</Link></li>
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
                <li><Link to="/privacy" className="hover:text-white">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-white">Terms of Service</Link></li>
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

function ServiceCard({ icon, title, description }) {
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
