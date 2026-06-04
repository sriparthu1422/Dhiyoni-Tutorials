import { useEffect, useState } from 'react'

const inputClass =
  'w-full p-sm bg-surface border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all font-inter text-body-md'

export default function ParentSignup() {
  const [btnState, setBtnState] = useState('idle') // idle | processing
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  useEffect(() => {
    document.title = 'Parent Sign Up | DHIYONI Tutorials'
  }, [])

  const validateForm = (formData) => {
    const newErrors = {}
    
    const studentName = formData.get('studentName')?.trim()
    if (!studentName) newErrors.studentName = 'Student Full Name is required'

    const gender = formData.get('gender')
    if (!gender) newErrors.gender = 'Gender selection is required'

    const grade = formData.get('grade')?.trim()
    if (!grade) newErrors.grade = 'Grade/Class is required'

    const subject = formData.get('subject')?.trim()
    if (!subject) newErrors.subject = 'Subject Required is required'

    const parentName = formData.get('parentName')?.trim()
    if (!parentName) newErrors.parentName = 'Parent Full Name is required'

    const contact = formData.get('contact')?.trim()
    if (!contact) {
      newErrors.contact = 'Contact Number is required'
    } else if (!/^\+?[\d\s\-]{8,15}$/.test(contact)) {
      newErrors.contact = 'Please enter a valid contact number (8-15 digits)'
    }

    const email = formData.get('email')?.trim()
    if (!email) {
      newErrors.email = 'Email ID is required'
    } else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    const city = formData.get('city')?.trim()
    if (!city) newErrors.city = 'City/Town/Village is required'

    const state = formData.get('state')?.trim()
    if (!state) newErrors.state = 'State is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    setErrors({})

    const fData = new FormData(e.currentTarget)
    if (!validateForm(fData)) {
      return
    }

    setBtnState('processing')
    
    const payload = {
      studentName: fData.get('studentName')?.trim(),
      gender: fData.get('gender'),
      grade: fData.get('grade')?.trim(),
      subject: fData.get('subject')?.trim(),
      parentName: fData.get('parentName')?.trim(),
      contact: fData.get('contact')?.trim(),
      email: fData.get('email')?.trim(),
      city: fData.get('city')?.trim(),
      state: fData.get('state')?.trim(),
      referral: fData.get('referral')
    }
    
    try {
      const response = await fetch('/api/parent-signups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.message || 'Server failed to record registration');
      }

      e.target.reset()
      setErrors({})
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Failed to submit parent signup to backend:', error);
      setSubmitError(error.message || 'Failed to submit registration. Please check your internet connection and try again.');
    } finally {
      setBtnState('idle')
    }
  }

  return (
    <div className="page-transition">
      <main className="max-w-container-max mx-auto px-4 md:px-lg py-lg">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">

          {/* ── LEFT: REGISTRATION FORM ────────────────────────── */}
          <div className="lg:col-span-8">
            <div className="mb-lg">
              <h1 className="font-montserrat font-semibold text-headline-lg text-primary mb-xs">
                Join the DHIYONI Family
              </h1>
              <p className="font-inter text-body-lg text-on-surface-variant">
                Fill in the details below to start your child's journey towards academic excellence. Our team will contact you shortly to guide you future.
              </p>
            </div>

            {submitError && (
              <div className="mb-md p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-body-sm flex items-start gap-2 animate-fade-in">
                <span className="material-symbols-outlined shrink-0 text-[20px]">error</span>
                <span>{submitError}</span>
              </div>
            )}

            <form
              id="signUpForm"
              className="grid grid-cols-1 md:grid-cols-2 gap-gutter bg-surface-container-lowest p-lg rounded-xl teal-shadow border border-outline-variant"
              onSubmit={handleSubmit}
              noValidate
            >
              {/* ── Student Details ─────────────────────── */}
              <div className="md:col-span-2">
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-base">Student Details</h3>
                <div className="h-px bg-outline-variant w-full mb-md" />
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Student Full Name</label>
                <input 
                  name="studentName" 
                  type="text" 
                  required 
                  placeholder="Enter student's name" 
                  className={`${inputClass} ${errors.studentName ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                />
                {errors.studentName && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.studentName}
                  </p>
                )}
              </div>
              
              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Gender</label>
                <select 
                  name="gender" 
                  className={`${inputClass} ${errors.gender ? 'border-rose-500 focus:ring-rose-500/20' : ''}`}
                  defaultValue=""
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
                {errors.gender && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.gender}
                  </p>
                )}
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Grade/Class</label>
                <input 
                  name="grade" 
                  type="text" 
                  required 
                  placeholder="e.g. Grade 10" 
                  className={`${inputClass} ${errors.grade ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                />
                {errors.grade && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.grade}
                  </p>
                )}
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Subject Required</label>
                <input 
                  name="subject" 
                  type="text" 
                  required 
                  placeholder="e.g. Mathematics, Physics" 
                  className={`${inputClass} ${errors.subject ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                />
                {errors.subject && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.subject}
                  </p>
                )}
              </div>

              {/* ── Parent Contact Details ───────────────── */}
              <div className="md:col-span-2 mt-md">
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-base">Parent Contact Details</h3>
                <div className="h-px bg-outline-variant w-full mb-md" />
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Parent Full Name</label>
                <input 
                  name="parentName" 
                  type="text" 
                  required 
                  placeholder="Enter parent's name" 
                  className={`${inputClass} ${errors.parentName ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                />
                {errors.parentName && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.parentName}
                  </p>
                )}
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Contact Number</label>
                <input 
                  name="contact" 
                  type="tel" 
                  required 
                  placeholder="Mobile Number" 
                  className={`${inputClass} ${errors.contact ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                />
                {errors.contact && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.contact}
                  </p>
                )}
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">Email ID</label>
                <input 
                  name="email" 
                  type="email" 
                  required 
                  placeholder="example@email.com" 
                  className={`${inputClass} ${errors.email ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                />
                {errors.email && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">City/Town/Village</label>
                <input 
                  name="city" 
                  type="text" 
                  required 
                  placeholder="Enter your location" 
                  className={`${inputClass} ${errors.city ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                />
                {errors.city && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.city}
                  </p>
                )}
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">State</label>
                <input 
                  name="state" 
                  type="text" 
                  required 
                  placeholder="Enter State" 
                  className={`${inputClass} ${errors.state ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                />
                {errors.state && (
                  <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">info</span>{errors.state}
                  </p>
                )}
              </div>

              <div className="space-y-xs">
                <label className="font-inter text-body-sm font-bold text-on-surface block">How Did You Hear About Us?</label>
                <select name="referral" className={inputClass} defaultValue="">
                  <option value="">Choose an option</option>
                  <option value="social_media">Social Media</option>
                  <option value="friends">Friends or Family</option>
                  <option value="search">Google/Search Engine</option>
                  <option value="advertisement">Newspaper/Billboard</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* ── Submit ───────────────────────────────── */}
              <div className="md:col-span-2 pt-md">
                <button
                  type="submit"
                  disabled={btnState === 'processing'}
                  className={`w-full md:w-auto bg-[#f05a28] text-white px-lg py-2.5 rounded-xl font-montserrat font-bold text-body-md hover:bg-[#d84a1b] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-md ${
                    btnState === 'processing' ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                >
                  {btnState === 'processing' ? (
                    <span className="flex items-center gap-2">
                      <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                      Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span>Submit Request</span>
                      <span className="material-symbols-outlined text-[18px] font-bold">arrow_forward</span>
                    </span>
                  )}
                </button>
              </div>
            </form>

            {/* Information privacy banner */}
            <div className="bg-[#f0f5fa] rounded-xl p-4 flex items-center gap-3 border border-outline-variant/10 mt-sm">
              <span className="material-symbols-outlined text-primary text-[20px]">lock</span>
              <p className="font-inter text-body-sm text-on-surface-variant font-medium">
                Your information is safe with us. We respect your privacy and will never share your details.
              </p>
            </div>
          </div>

          {/* ── RIGHT: SIDEBAR ───────────────────────────────────── */}
          <aside className="lg:col-span-4 space-y-xl">

            {/* Why DHIYONI? */}
            <div className="bg-surface-container p-lg rounded-xl border border-outline-variant">
              <h4 className="font-montserrat font-semibold text-headline-md text-primary mb-md">Why DHIYONI?</h4>
              <ul className="space-y-md">
                {[
                  { icon: 'verified', title: 'Verified Tutors', desc: 'Background-checked and highly qualified experts.' },
                  { icon: 'monitoring', title: 'Progress Tracking', desc: "Regular updates on your child's performance." },
                  { icon: 'diversity_3', title: 'Personalized Care', desc: 'Tailored curriculum to match learning pace.' },
                ].map(({ icon, title, desc }) => (
                  <li key={title} className="flex gap-sm items-start">
                    <span className="material-symbols-outlined text-primary">{icon}</span>
                    <div>
                      <p className="font-inter font-bold text-body-md">{title}</p>
                      <p className="font-inter text-body-sm text-on-surface-variant">{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Testimonial */}
            <div className="bg-primary-container text-on-primary-container p-lg rounded-xl relative overflow-hidden teal-shadow">
              <div className="relative z-10">
                <span
                  className="material-symbols-outlined text-tertiary-fixed text-[40px]"
                  style={{ fontVariationSettings: '"FILL" 1' }}
                >
                  format_quote
                </span>
                <p className="font-inter text-body-lg italic mb-lg">
                  "Since joining DHIYONI, my daughter's confidence in Mathematics has skyrocketed. The tutor is incredibly patient and explains complex concepts with such ease. We couldn't be happier with the progress!"
                </p>
                <div className="flex items-center gap-md">
                  <img
                    alt="Parent Profile"
                    className="w-12 h-12 rounded-full object-cover border-2 border-tertiary-fixed"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuDqttlIzIV99i6fndTi_X3QzJOghpEgD7rg-hP1vz_dPGYuQlMPr0nrE5aQNSZjogRklvuLeKBpwddYIOL5V10LG0HYOLdUnQQ8atACB2Pp4x3GthK33AnI5i7y-ihgBiKN37bdvTO5WvPaFfRT7czjgcvd4hSaeud1DwL6cJeOWookU8QeC06ke5MvTYxW8935Im2HfELE78zjlr3sKjHCW-DM3tjpPNNSmBGV-CgeU3Y6To0nSz0ekm8j9KvRhV8Pa-JASe8ZakyV"
                  />
                  <div>
                    <p className="font-inter font-bold text-body-md">Mrs. Anita Sharma</p>
                    <p className="font-inter text-body-sm opacity-80">Parent of 10th Grade Student</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Assistance Card */}
            <div className="bg-surface-container-highest p-lg rounded-xl border border-outline-variant flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-secondary text-[48px] mb-base">support_agent</span>
              <h5 className="font-montserrat font-semibold text-headline-md mb-xs">Need Help?</h5>
              <p className="font-inter text-body-sm text-on-surface-variant mb-md">Our student advisors are just a call away.</p>
              <a
                href="tel:+917901034846"
                className="text-primary font-bold text-body-lg hover:underline underline-offset-4"
              >
                +91 7901034846
              </a>
            </div>

          </aside>
        </div>
      </main>

      {/* ── SUCCESS CONFIRMATION MODAL POPUP ─────────────────────── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-8 animate-fade-in">
          <div className="bg-white rounded-3xl p-8 md:p-10 border border-outline-variant max-w-lg w-full text-center relative shadow-2xl flex flex-col items-center animate-fade-in-up">
            
            {/* Success Check Circle Icon */}
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 text-emerald-600 ring-8 ring-emerald-500/5 shrink-0">
              <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                check_circle
              </span>
            </div>

            {/* Title */}
            <h3 className="font-montserrat font-bold text-headline-lg text-primary mb-4 leading-tight">
              Registration Submitted Successfully! 🎉
            </h3>
            
            {/* Message Body */}
            <div className="space-y-4 font-inter text-body-md text-on-surface-variant leading-relaxed text-center mb-8">
              <p>Thank you for your interest in DHIYONI Tutorials.</p>
              <p>We have successfully received your registration details and our team will review the information provided.</p>
              <p className="font-semibold text-primary text-center">Our team will contact you within 48 hours to discuss the next steps and help you get started.</p>
              <p>If you have any questions, please feel free to contact us.</p>
              <p className="text-body-sm italic mt-4 text-on-surface-variant/80">Thank you for choosing DHIYONI Tutorials.</p>
            </div>

            {/* OK Action Button */}
            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false)
              }}
              className="w-full flex items-center justify-center bg-[#f05a28] text-white font-bold py-4 px-6 rounded-xl shadow-md hover:bg-[#d84a1b] active:scale-95 transition-all text-body-md shrink-0"
            >
              OK
            </button>

          </div>
        </div>
      )}
    </div>
  )
}
