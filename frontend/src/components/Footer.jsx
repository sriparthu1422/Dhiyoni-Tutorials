import { useState } from 'react'
import { Link } from 'react-router-dom'
import logo from '../assets/logo.png'
import FeedbackSuccessModal from './FeedbackSuccessModal'

const quickLinks = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About Us' },
  { to: '/courses', label: 'Courses' },
  // { to: '/tutors', label: 'Our Tutors' },
  { to: '/contact', label: 'Contact' },
]

const courseLinks = [
  { label: 'CBSE Courses', to: '/courses' },
  { label: 'ICSE Courses', to: '/courses' },
  { label: 'State Boards', to: '/courses' },
  { label: 'IIT/NEET Foundation', to: '/courses' },
  { label: 'Language Excellence', to: '/courses' },
]

const legalLinks = [
  { label: 'Privacy Policy', to: '#' },
  { label: 'Terms of Service', to: '#' },
  { label: 'FAQ', to: '#' },
  { label: 'Support', to: '#' },
]

export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState('')

  // Feedback State
  const [feedbackData, setFeedbackData] = useState({
    name: '',
    userType: '',
    email: '',
    contactNumber: '',
    message: '',
    rating: 0,
  })
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleFeedbackChange = (e) => {
    const { name, value } = e.target
    setFeedbackData(prev => ({ ...prev, [name]: value }))
  }

  const handleRating = (rate) => {
    setFeedbackData(prev => ({ ...prev, rating: rate }))
  }

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault()
    setFeedbackError('')
    
    if (feedbackData.rating === 0) {
      setFeedbackError('Please select a rating (1-5 stars).')
      return
    }

    setFeedbackLoading(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.message || 'Something went wrong')
      
      // Success
      setIsModalOpen(true)
      setFeedbackData({
        name: '',
        userType: '',
        email: '',
        contactNumber: '',
        message: '',
        rating: 0,
      })
    } catch (err) {
      setFeedbackError(err.message)
    } finally {
      setFeedbackLoading(false)
    }
  }

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault()
    if (!newsletterEmail) return

    const whatsappMessage = `Hi DHIYONI Tutorials,\n\nI would like to subscribe to your newsletter with the following email address:\n\n*Email:* ${newsletterEmail}\n\nPlease add me to your mailing list.\n\nThank you.`;
    const whatsappUrl = `https://wa.me/917901034846?text=${encodeURIComponent(whatsappMessage)}`;
    
    try {
      const response = await fetch('/api/newsletters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: newsletterEmail }),
      });

      // Note: we swallow "already subscribed" (400) to keep UX smooth, but can log it
      if (!response.ok && response.status !== 400) {
        throw new Error('Server returned an error');
      }

      window.open(whatsappUrl, '_blank')
      setNewsletterEmail('')
    } catch (error) {
      console.error('Failed to subscribe newsletter to backend:', error);
      // Fallback: Still allow WhatsApp redirect so user is not blocked
      window.open(whatsappUrl, '_blank')
      setNewsletterEmail('')
    }
  }

  return (
    <>
      <footer className="bg-surface-container-low border-t border-outline-variant relative z-10">
        
        <div className="section-container pt-12 pb-8">
          {/* ── FEEDBACK SECTION ── */}
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-outline-variant mb-12 teal-shadow relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-secondary/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-tertiary/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="relative z-10 max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary-fixed text-secondary mb-4">
                  <span className="material-symbols-outlined text-[24px]">forum</span>
                </div>
                <h3 className="font-montserrat font-bold text-headline-md md:text-headline-lg text-primary mb-2">
                  We Value Your Feedback
                </h3>
                <p className="font-inter text-body-md text-on-surface-variant">
                  Help us improve by sharing your experience. We'd love to hear from you!
                </p>
              </div>

              {feedbackError && (
                <div className="bg-error/10 text-error p-3 rounded-lg mb-6 text-center text-sm font-semibold">
                  {feedbackError}
                </div>
              )}

              <form onSubmit={handleFeedbackSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block font-inter text-label-md font-semibold text-primary mb-1">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={feedbackData.name}
                    onChange={handleFeedbackChange}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block font-inter text-label-md font-semibold text-primary mb-1">I am a... *</label>
                  <select
                    name="userType"
                    required
                    value={feedbackData.userType}
                    onChange={handleFeedbackChange}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface"
                  >
                    <option value="" disabled>Select User Type</option>
                    <option value="Teacher">Teacher</option>
                    <option value="Student">Student</option>
                    <option value="Parent">Parent</option>
                  </select>
                </div>
                <div>
                  <label className="block font-inter text-label-md font-semibold text-primary mb-1">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    required
                    value={feedbackData.email}
                    onChange={handleFeedbackChange}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block font-inter text-label-md font-semibold text-primary mb-1">Contact Number (Optional)</label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={feedbackData.contactNumber}
                    onChange={handleFeedbackChange}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-inter text-label-md font-semibold text-primary mb-1">Your Feedback *</label>
                  <textarea
                    name="message"
                    required
                    rows="3"
                    value={feedbackData.message}
                    onChange={handleFeedbackChange}
                    className="w-full bg-surface border border-outline-variant rounded-lg px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                    placeholder="Tell us what you think..."
                  ></textarea>
                </div>
                <div className="md:col-span-2 flex flex-col items-center">
                  <label className="block font-inter text-label-md font-semibold text-primary mb-2">Rate your experience *</label>
                  <div className="flex gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRating(star)}
                        className="transition-transform hover:scale-110 focus:outline-none"
                      >
                        <span 
                          className="material-symbols-outlined text-4xl transition-colors duration-200"
                          style={{ 
                            color: star <= feedbackData.rating ? '#FFB400' : '#E0E0E0',
                            fontVariationSettings: star <= feedbackData.rating ? '"FILL" 1' : '"FILL" 0'
                          }}
                        >
                          star
                        </span>
                      </button>
                    ))}
                  </div>
                  <button 
                    type="submit" 
                    disabled={feedbackLoading}
                    className="bg-primary text-white font-bold py-3 px-10 rounded-xl hover:bg-primary-container transition-all shadow-md active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {feedbackLoading ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            </div>
          </div>
          {/* ── END FEEDBACK SECTION ── */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/">
              <img
                src={logo}
                alt="DHIYONI Tutorials"
                className="h-20 w-auto object-contain mb-4"
              />
            </Link>
            <p className="text-on-surface-variant text-body-sm mb-6 leading-relaxed">
              Empowering students' journeys since 2025 with quality education and expert guidance. Your success is our mission.
            </p>
            <div className="flex gap-3">
              {[
                { 
                  label: 'Instagram', 
                  icon: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z' 
                },
                { 
                  label: 'Facebook', 
                  icon: 'M14 22.5V14.25h2.648l.398-3.07h-3.047v-1.961c0-.889.247-1.495 1.521-1.495h1.625V5.016c-.28-.037-1.242-.12-2.36-.12-2.336 0-3.937 1.426-3.937 4.047V11.18H8.22v3.07h2.625V22.5H14z' 
                },
                { 
                  label: 'Meta', 
                  icon: 'M23.977 11.238c-.067-1.524-.482-3.08-1.517-4.148-1.282-1.321-3.23-1.89-5.11-1.89-2.398 0-4.636.98-6.149 2.502-1.513-1.522-3.751-2.502-6.15-2.502-1.88 0-3.827.57-5.109 1.89-1.035 1.068-1.45 2.624-1.517 4.148C-.376 13.91.436 16.598 2.062 18.06c1.235 1.11 2.913 1.573 4.567 1.573 2.146 0 4.116-.762 5.568-2.036 1.453 1.274 3.422 2.036 5.568 2.036 1.654 0 3.332-.463 4.567-1.573 1.626-1.462 2.438-4.15 2.145-6.822zM6.63 17.633c-1.127 0-2.228-.316-2.998-1.008-.946-.85-1.455-2.368-1.274-4.043.048-1.096.33-2.143 1.01-2.846.786-.81 1.954-1.136 2.999-1.136 1.705 0 3.307.785 4.316 2.083-1.282 2.378-2.614 4.565-4.053 6.95zm10.74 0c-1.439-2.385-2.77-4.572-4.052-6.95 1.009-1.298 2.61-2.083 4.315-2.083 1.045 0 2.213.326 2.999 1.136.68.703.962 1.75.101 2.846.18 1.675-.328 3.193-1.275 4.043-.77.692-1.87 1.008-2.998 1.008z' 
                },
                { 
                  label: 'LinkedIn', 
                  icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z' 
                },
              ].map(({ label, icon }) => (
                <a
                  key={label}
                  href="#"
                  aria-label={label}
                  className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white hover:bg-primary-container transition-colors duration-200"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d={icon} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-montserrat font-semibold text-headline-md text-primary mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map(({ to, label }) => (
                <li key={label}>
                  <Link
                    to={to}
                    className="text-on-surface-variant text-body-sm hover:text-primary transition-colors duration-200"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {/* Legal */}
          <div>
            <h4 className="font-montserrat font-semibold text-headline-md text-primary mb-4">Legal</h4>
            <ul className="space-y-2">
              {legalLinks.map(({ label }) => (
                <li key={label}>
                  <a href="#" className="text-on-surface-variant text-body-sm hover:text-primary transition-colors duration-200">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter */}
          <div>
            <h4 className="font-montserrat font-semibold text-headline-md text-primary mb-4">Newsletter</h4>
            <p className="text-on-surface-variant text-body-sm mb-4">
              Stay updated with the latest in education and exam tips.
            </p>
            <form onSubmit={handleNewsletterSubmit} className="flex mb-6">
              <input
                type="email"
                required
                placeholder="Your Email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                aria-label="Newsletter email address"
                className="bg-surface border border-outline-variant rounded-l-lg px-md py-sm w-full text-body-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
              <button type="submit" className="bg-primary text-white px-md py-sm rounded-r-lg hover:bg-primary-container transition-colors shrink-0">
                <span className="material-symbols-outlined text-[20px]">send</span>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-outline-variant relative z-10">
        <div className="section-container py-5 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-on-surface-variant text-body-sm text-center">
            © 2025 DHIYONI Tutorials. All rights reserved. Designed by <Link to="https://nsp-portfolio-frontend.vercel.app/" className="text-orange-600 font-bold hover:underline">NSP</Link>
          </p>
        </div>
      </div>
    </footer>
    
    <FeedbackSuccessModal 
      isOpen={isModalOpen} 
      onClose={() => setIsModalOpen(false)} 
    />
    </>
  )
}
