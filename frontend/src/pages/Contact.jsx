import { useEffect, useState, useRef } from 'react'
import SEO from '../components/SEO'
import logo from '../assets/logo.png'
import map from '../assets/map.png' 

const faqs = [
  {
    q: 'How do you select tutors for students? ',
    a: "We carefully match tutors based on the student's grade level, board curriculum, learning style, and academic goals to ensure the best learning experience." 
  },
  {
    q: 'Do you provide one-on-one tutoring sessions?',
    a: "Yes, students who require personalized attention can opt for one-on-one sessions tailored to their academic needs and learning goals.",
  },
  {
    q: "Can parents track their child's academic progress?",
    a: "Yes, Parents receive regular progress report test results and feedback from tutors to stay informed about their child's performance.",
  },
  {
    q: 'Do you help students with homework and school assignment?',
    a: "Yes, Our tutors assist students with homework projects, assignments, and exam preparation while encouraging independent learning and problem-solving skills.",
  },
]

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`bg-white p-lg rounded-xl border border-outline-variant teal-shadow-hover transition-all cursor-pointer group ${open ? 'ring-2 ring-primary' : ''}`}
      onClick={() => setOpen(!open)}
      role="button"
      aria-expanded={open}
    >
      <div className="flex justify-between items-center gap-md">
        <h3 className="font-inter text-[18px] text-primary font-montserrat font-semibold">{question}</h3>
        <span
          className={`material-symbols-outlined text-primary text-[22px] shrink-0 transition-transform duration-300 ${
            open ? 'rotate-180' : ''
          }`}
        >
          expand_more
        </span>
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-40 mt-3' : 'max-h-0'}`}>
        <p className="font-inter text-body-sm text-on-surface-variant">{answer}</p>
      </div>
    </div>
  )
}

export default function Contact() {
  const formRef = useRef(null)
  const [btnState, setBtnState] = useState('idle') // idle | sending | sent
  const [formData, setFormData] = useState({ name: '', email: '', subject: 'Course Inquiry', message: '' })

  const update = (field) => (e) => setFormData({ ...formData, [field]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBtnState('sending')
    
    // Construct the WhatsApp message with form details
    const whatsappMessage = `Hi DHIYONI Tutorials,\n\nI would like to submit an inquiry with the following details:\n\n*Name:* ${formData.name}\n*Email:* ${formData.email}\n*Subject:* ${formData.subject}\n*Message:* ${formData.message}\n\nPlease help me with my inquiry.\n\nThank you.`;
    const whatsappUrl = `https://wa.me/917901034846?text=${encodeURIComponent(whatsappMessage)}`;
    
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Server returned an error');
      }

      setBtnState('sent')
      window.open(whatsappUrl, '_blank')
      setFormData({ name: '', email: '', subject: 'Course Inquiry', message: '' })
      setTimeout(() => {
        setBtnState('idle')
      }, 3000)
    } catch (error) {
      console.error('Failed to submit contact to backend:', error);
      // Fallback: Still allow WhatsApp redirect so user is not blocked
      setBtnState('sent')
      window.open(whatsappUrl, '_blank')
      setFormData({ name: '', email: '', subject: 'Course Inquiry', message: '' })
      setTimeout(() => {
        setBtnState('idle')
      }, 3000)
    }
  }

  const btnLabel = btnState === 'sending' ? 'Sending...' : btnState === 'sent' ? 'Message Sent!' : 'Submit Inquiry'
  const btnBg = btnState === 'sent' ? 'bg-green-600' : 'bg-secondary'

  return (
    <div className="page-transition">
      <SEO 
        title="Contact Us | Start Your Learning Journey | DHIYONI Tutorials"
        description="Get in touch with DHIYONI Tutorials. Fill out our contact form, find our location on the map, or check out our FAQs to learn more about our online classes."
        keywords="Contact Dhiyoni Tutorials, online tuition enquiry, tutoring services Hyderabad, education contact"
        canonicalPath="/contact"
      />
      <main className="max-w-container-max mx-auto px-4 md:px-lg py-lg">

        {/* ── HERO SECTION ─────────────────────────────────────── */}
        <section className="text-center mb-xl">
          <h1 className="font-montserrat font-bold text-[2rem] md:text-headline-lg lg:text-display-lg text-primary mb-md">
            Get in Touch
          </h1>
          <p className="font-inter text-body-md md:text-body-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Have questions about our CBSE, ICSE, or State Board programs? Our academic counselors are here to help you navigate your child's educational journey.
          </p>
        </section>

        {/* ── MAIN GRID ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-y-xl lg:gap-gutter items-start">

          {/* ── CONTACT FORM (col-span-7) ───────────────────────── */}
          <div className="lg:col-span-7 bg-white p-6 md:p-lg rounded-xl border border-outline-variant teal-shadow">
            <h2 className="font-montserrat font-semibold text-headline-md text-primary mb-lg">Send us a Message</h2>
            <form ref={formRef} className="space-y-md" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="space-y-xs">
                  <label className="font-inter text-body-sm font-bold text-on-surface block">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={update('name')}
                    placeholder="Your full name"
                    className="w-full bg-[#F9F9F9] border border-outline-variant rounded-lg p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
                <div className="space-y-xs">
                  <label className="font-inter text-body-sm font-bold text-on-surface block">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={update('email')}
                    placeholder="Enter your email id"
                    className="w-full bg-[#F9F9F9] border border-outline-variant rounded-lg p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>
              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Subject</label>
                <select
                  value={formData.subject}
                  onChange={update('subject')}
                  className="w-full bg-[#F9F9F9] border border-outline-variant rounded-lg p-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                >
                  <option>Course Inquiry</option>
                  <option>Technical Support</option>
                  <option>Career Counseling</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Message</label>
                <textarea
                  rows={5}
                  required
                  value={formData.message}
                  onChange={update('message')}
                  placeholder="How can we help you?"
                  className="w-full bg-[#F9F9F9] border border-outline-variant rounded-lg p-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={btnState !== 'idle'}
                className={`w-full md:w-auto ${btnBg} text-on-secondary px-8 py-3.5 rounded-lg font-montserrat font-bold teal-shadow-hover transition-all active:scale-95 disabled:opacity-80 disabled:cursor-not-allowed`}
              >
                {btnLabel}
              </button>
            </form>
          </div>

          {/* ── CONTACT INFO + MAP + TRUST (col-span-5) ─────────── */}
          <div className="lg:col-span-5 space-y-md md:space-y-gutter">

            {/* Info Cards */}
            <div className="bg-surface-container-low p-lg rounded-xl border border-outline-variant teal-shadow space-y-md">
              <div className="flex items-start gap-md">
                <span className="material-symbols-outlined text-primary">location_on</span>
                <div>
                  <h4 className="font-inter text-body-md font-bold text-primary">Office Address</h4>
                  <p className="font-inter text-body-xs text-on-surface-variant">
                    Flat no: 204, 3rd floor, Sigma Sarovar, Bandam kommu, Ameenpur Road, 502032
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-md">
                <span className="material-symbols-outlined text-primary">call</span>
                <div>
                  <h4 className="font-inter text-body-md font-bold text-primary">Phone Number</h4>
                  <a
                    href="tel:+917901034846"
                    className="font-inter text-body-xs text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    +91 79010 34846
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-md">
                <span className="material-symbols-outlined text-primary">mail</span>
                <div>
                  <h4 className="font-inter text-body-md font-bold text-primary">Official Email</h4>
                  <a
                    href="mailto:dhiyonitutorials@gmail.com"
                    className="font-inter text-body-xs text-on-surface-variant hover:text-secondary transition-colors"
                  >
                    dhiyonitutorials@gmail.com
                  </a>
                  <p className='text-sm text-black italic mt-2'>(We typically reply within 24 hours.)</p>
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <a
              href="https://www.google.com/maps/place/Sigma+Sarovar/@17.5110409,78.3178167,17z/data=!3m1!4b1!4m6!3m5!1s0x3bcb929fdeba9f73:0x48cd01ebfda6d2c7!8m2!3d17.5110409!4d78.3178167!16s%2Fg%2F11b6dgcvq3!18m1!1e1?entry=ttu&g_ep=EgoyMDI2MDUyNy4wIKXMDSoASAFQAw%3D%3D"
              target="_blank"
              rel="noopener noreferrer"
              className="block h-[250px] md:h-[300px] rounded-xl overflow-hidden border border-outline-variant teal-shadow relative w-full group/map"
            >
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                alt="Satellite map showing DHIYONI Tutorials office location at Sigma Sarovar, Hyderabad"
                src="https://static-maps.yandex.ru/1.x/?ll=78.3178167,17.5110409&z=17&l=sat,skl&size=650,350"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/5 group-hover:bg-black/0 transition-colors">
                <div className="bg-white p-2.5 rounded-full animate-bounce shadow-lg w-16 h-16 flex items-center justify-center border border-outline-variant">
                  <img src={logo} alt="DHIYONI Tutorials Logo" className="w-12 h-12 object-contain" />
                </div>
              </div>
            </a>

            {/* Trust Badge */}
            {/* <div className="flex items-center justify-center p-md bg-white rounded-xl border border-outline-variant teal-shadow">
              <div className="flex items-center gap-sm">
                <div className="w-12 h-12 bg-primary-container rounded-full flex items-center justify-center">
                  <span
                    className="material-symbols-outlined text-white"
                    style={{ fontVariationSettings: '"FILL" 1' }}
                  >
                    verified_user
                  </span>
                </div>
                <div>
                  <p className="font-montserrat text-label-md text-on-surface-variant leading-tight">ISO 9001:2015 Certified</p>
                  <p className="font-inter text-body-sm font-bold text-primary">Educational Excellence Partner</p>
                </div>
              </div>
            </div> */}

          </div>
        </div>

        {/* ── FAQ SECTION ──────────────────────────────────────── */}
        <section className="mt-[50px] py-xl border-t border-outline-variant px-2 md:px-0">
          <h2 className="font-montserrat font-semibold text-headline-lg text-primary text-center mb-xl">
            Common Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-md md:gap-gutter">
            {faqs.map((faq) => (
              <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </section>

      </main>
    </div>
  )
}
