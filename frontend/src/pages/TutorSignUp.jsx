import { useEffect, useState, useRef } from 'react'

const inputClass =
  'bg-surface rounded-xl border border-outline-variant focus:border-primary focus:ring-2 focus:ring-primary/20 py-3.5 px-md font-inter text-body-md outline-none transition-all w-full'

export default function TutorSignup() {
  const [activeStep, setActiveStep] = useState(1)
  const [boards, setBoards] = useState({ state: false, cbse: false, icse: false, cambridge: false })
  const [hasTech, setHasTech] = useState(false)
  const [occupation, setOccupation] = useState('')
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const formRef = useRef(null)

  useEffect(() => {
    document.title = 'Tutor Sign Up | DHIYONI Tutorials'
  }, [])

  // Validate step fields
  const validateStep = (step) => {
    const newErrors = {}
    if (formRef.current) {
      const fData = new FormData(formRef.current)
      
      if (step === 1) {
        const fullName = fData.get('full-name')?.trim()
        if (!fullName) newErrors['full-name'] = 'Full Name is required'

        const gender = fData.get('gender')
        if (!gender) newErrors['gender'] = 'Gender selection is required'

        const email = fData.get('email')?.trim()
        if (!email) {
          newErrors['email'] = 'Email Address is required'
        } else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
          newErrors['email'] = 'Please enter a valid email address'
        }

        const contact = fData.get('contact')?.trim()
        if (!contact) {
          newErrors['contact'] = 'Phone Number is required'
        } else if (!/^\+?[\d\s\-]{8,15}$/.test(contact)) {
          newErrors['contact'] = 'Please enter a valid phone number (8-15 digits)'
        }

        const dob = fData.get('dob')
        if (!dob) {
          newErrors['dob'] = 'Date of Birth is required'
        } else {
          const dobDate = new Date(dob)
          const today = new Date()
          if (dobDate >= today) {
            newErrors['dob'] = 'Date of Birth must be in the past'
          }
        }

        const location = fData.get('location')?.trim()
        if (!location) newErrors['location'] = 'Current Location is required'
      }
      
      else if (step === 2) {
        const qualification = fData.get('qualification')?.trim()
        if (!qualification) newErrors['qualification'] = 'Highest Qualification is required'

        if (!occupation) newErrors['occupation'] = 'Please select your current occupation'

        const grades = fData.get('grades')?.trim()
        if (!grades) newErrors['grades'] = 'Grades/Classes you can teach is required'

        const subjects = fData.get('subjects')?.trim()
        if (!subjects) newErrors['subjects'] = 'Subjects you can handle is required'
      }
      
      else if (step === 3) {
        const time = fData.get('time')?.trim()
        if (!time) newErrors['time'] = 'Preferred Teaching Time is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle Stepper Head / Navigation clicks
  const handleStepClick = (targetStep) => {
    setSubmitError('')
    if (targetStep === activeStep) return;

    if (targetStep < activeStep) {
      setActiveStep(targetStep)
      return;
    }

    // Navigating forward
    if (activeStep === 1) {
      if (!validateStep(1)) return;
      if (targetStep === 3) {
        if (!validateStep(2)) {
          setActiveStep(2);
          return;
        }
      }
    } else if (activeStep === 2) {
      if (!validateStep(2)) return;
    }

    setActiveStep(targetStep)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitError('')
    
    // Validate steps sequentially and focus on invalid step if needed
    if (!validateStep(1)) {
      setActiveStep(1)
      return
    }
    if (!validateStep(2)) {
      setActiveStep(2)
      return
    }
    if (!validateStep(3)) {
      setActiveStep(3)
      return
    }

    setIsSubmitting(true)
    const fData = new FormData(e.currentTarget)
    
    const selectedBoardsList = Object.keys(boards).filter((key) => boards[key])
    
    const payload = {
      fullName: fData.get('full-name'),
      gender: fData.get('gender'),
      email: fData.get('email'),
      contact: fData.get('contact'),
      dob: fData.get('dob'),
      location: fData.get('location'),
      qualification: fData.get('qualification'),
      occupation: occupation,
      experience: fData.get('experience'),
      grades: fData.get('grades'),
      subjects: fData.get('subjects'),
      time: fData.get('time'),
      boards: selectedBoardsList,
      hasTech
    }
    
    try {
      const response = await fetch('/api/tutor-signups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.message || 'Server failed to record application');
      }

      // Reset form states on success
      e.target.reset()
      setBoards({ state: false, cbse: false, icse: false, cambridge: false })
      setHasTech(false)
      setOccupation('')
      setErrors({})
      
      // Trigger confirmation popup modal
      setShowSuccessModal(true)
    } catch (error) {
      console.error('Failed to submit tutor application to backend:', error);
      setSubmitError(error.message || 'Failed to submit application. Please check your internet connection and try again.');
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="page-transition">
      <main className="flex-grow w-full max-w-container-max mx-auto px-4 md:px-lg pt-lg pb-lg grid grid-cols-1 lg:grid-cols-12 gap-xl items-start">

        {/* ── SIDEBAR ─────────────────────────────────────────── */}
        <aside className="lg:col-span-4 space-y-lg order-2 lg:order-1">

          {/* Why teach with DHIYONI */}
          <div className="bg-surface-container-low rounded-3xl p-6 md:p-8 border border-outline-variant/30 teal-shadow">
            <h2 className="font-montserrat font-bold text-headline-lg text-primary mb-8">
              Why Join <br /><span className="text-[#f05a28] whitespace-nowrap text-[28px]">DHIYONI Tutorials?</span>
            </h2>
            <div className="flex flex-col">
              {[
                { 
                  icon: 'calendar_month', 
                  title: 'Flexible Teaching Schedule', 
                  desc: 'Teach at your convenience with a fully online session designed to fit your availability and lifestyle.', 
                  bg: 'bg-[#e3f2fd] border border-[#90caf9]/50 text-[#1565c0]' 
                },
                { 
                  icon: 'currency_rupee', 
                  title: 'Competitive Earnings', 
                  desc: 'Receive attractive compensation based on your qualifications, subject expertise, and teaching performance.', 
                  bg: 'bg-[#e8f5e9] border border-[#a5d6a7]/50 text-[#2e7d32]' 
                },
                { 
                  icon: 'trending_up', 
                  title: 'Professional Development', 
                  desc: 'Access training resources, mentoring support, and advanced teaching tools to continuously improve your skills.', 
                  bg: 'bg-[#f3e5f5] border border-[#d1c4e9]/50 text-[#673ab7]' 
                },
                { 
                  icon: 'shield', 
                  title: 'Trusted Learning Platform', 
                  desc: 'Be part of a student-focused educational ecosystem trusted by parents and learners across India.', 
                  bg: 'bg-[#fbe9e7] border border-[#ffab91]/50 text-[#d84315]' 
                },
              ].map(({ icon, title, desc, bg }, index) => (
                <div key={title} className="flex flex-col">
                  <div className="flex gap-md">
                    <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center shrink-0 shadow-sm`}>
                      <span className="material-symbols-outlined text-[24px]">{icon}</span>
                    </div>
                    <div>
                      <h3 className="font-inter text-body-md font-bold text-primary mb-1">{title}</h3>
                      <p className="font-inter text-body-sm text-on-surface-variant leading-relaxed">{desc}</p>
                    </div>
                  </div>
                  {index < 3 && <div className="h-px bg-outline-variant/30 my-6" />}
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial card */}
          <div className="bg-[#002f3d] rounded-3xl p-6 border border-outline-variant/10 text-white flex gap-5 relative overflow-hidden shadow-md items-start">
            <div className="absolute top-4 right-6 opacity-10">
              <span className="material-symbols-outlined text-5xl text-white">format_quote</span>
            </div>
            
            <img
              alt="Tutor Testimonial - Ananya R."
              className="w-16 h-16 rounded-full object-cover border-2 border-white/20 shrink-0"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCigNDFYRX8YnGNj3b59Ga-Bjmym2v9jRhKZhPRBmr8UuxpPTq0HjVekKT10Tto6D6oX64YOTy-jadQ4bymRCE7J756mmSI0oYG4-4iTSH4RhPiwUtZ5pIcC6XCkrMip3pJ_ic_jbQypr3mjfG69aFk8JbnA62yiNmD7rScbRn9pEcrFp0MG2MZLP85MsND8jYVVzSpBwJ0f_8nGIoNeRlA-tc5nXpfum4NThVyecUuNnNaPJWI_dqKR5Y0DYXRiHM2MtawyNy9S5WG"
            />
            
            <div className="flex-grow relative z-10">
              <div className="relative mb-2">
                <span className="material-symbols-outlined text-2xl text-[#f05a28] absolute -left-6 -top-1 opacity-70">format_quote</span>
                <p className="font-inter text-body-sm leading-relaxed text-white/90">
                  DHIYONI Tutorials helped me connect with students across different cities while maintaining complete flexibility in my schedule. The experience has been both professionally and personally rewarding.
                </p>
              </div>
              <div className="mt-4">
                <p className="font-montserrat text-label-md font-bold text-white">— Ananya R.</p>
                <p className="font-inter text-[11px] text-white/70">Senior Science Tutor</p>
              </div>
            </div>
          </div>
        </aside>

        {/* ── FORM AREA ────────────────────────────────────────── */}
        <div className="lg:col-span-8 order-1 lg:order-2 space-y-lg">
          <header>
            <h1 className="font-montserrat font-bold text-display-lg-mobile md:text-display-lg text-primary">
              Become a Tutor
            </h1>
            <p className="font-inter text-body-lg text-on-surface-variant mt-xs">
              Empower future achievers through personalized and impactful online education.
            </p>
          </header>

          {/* Stepper Container */}
          <div className="relative max-w-2xl pt-4 pb-2">
            {/* Background progress line */}
            <div className="absolute top-9 left-16 right-16 h-[2px] bg-slate-200 -z-10" />
            {/* Foreground active progress line */}
            <div 
              className="absolute top-9 left-16 h-[2px] bg-primary -z-10 transition-all duration-500"
              style={{
                width: activeStep === 1 ? '0%' : activeStep === 2 ? '50%' : '100%'
              }}
            />

            <div className="flex items-center justify-between">
              {/* Step 1 Button */}
              <button 
                type="button" 
                onClick={() => handleStepClick(1)} 
                className="flex flex-col items-center gap-3 focus:outline-none group shrink-0 w-32"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold font-montserrat text-sm border-2 transition-all duration-300 ${
                  activeStep >= 1 ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200'
                }`}>
                  {activeStep > 1 ? <span className="material-symbols-outlined text-[18px]">check</span> : '1'}
                </div>
                <span className={`font-montserrat text-label-md font-bold text-center transition-colors duration-300 ${
                  activeStep === 1 ? 'text-primary border-b-2 border-primary pb-0.5' : 'text-on-surface-variant group-hover:text-primary'
                }`}>
                  Personal Details
                </span>
              </button>

              {/* Step 2 Button */}
              <button 
                type="button" 
                onClick={() => handleStepClick(2)} 
                className="flex flex-col items-center gap-3 focus:outline-none group shrink-0 w-36"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold font-montserrat text-sm border-2 transition-all duration-300 ${
                  activeStep >= 2 ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200'
                }`}>
                  {activeStep > 2 ? <span className="material-symbols-outlined text-[18px]">check</span> : '2'}
                </div>
                <span className={`font-montserrat text-label-md font-bold text-center transition-colors duration-300 ${
                  activeStep === 2 ? 'text-primary border-b-2 border-primary pb-0.5' : 'text-on-surface-variant group-hover:text-primary'
                }`}>
                  Academic Expertise
                </span>
              </button>

              {/* Step 3 Button */}
              <button 
                type="button" 
                onClick={() => handleStepClick(3)} 
                className="flex flex-col items-center gap-3 focus:outline-none group shrink-0 w-36"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold font-montserrat text-sm border-2 transition-all duration-300 ${
                  activeStep >= 3 ? 'bg-primary text-white border-primary' : 'bg-white text-slate-400 border-slate-200'
                }`}>
                  {activeStep > 3 ? <span className="material-symbols-outlined text-[18px]">check</span> : '3'}
                </div>
                <span className={`font-montserrat text-label-md font-bold text-center transition-colors duration-300 ${
                  activeStep === 3 ? 'text-primary border-b-2 border-primary pb-0.5' : 'text-on-surface-variant group-hover:text-primary'
                }`}>
                  Availability & Logistics
                </span>
              </button>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-lg">
            {submitError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-body-sm flex items-start gap-2 animate-fade-in">
                <span className="material-symbols-outlined shrink-0 text-[20px]">error</span>
                <span>{submitError}</span>
              </div>
            )}

            <form
              ref={formRef}
              className="space-y-lg bg-white p-lg md:p-xl rounded-3xl border border-outline-variant/30 form-card"
              onSubmit={handleSubmit}
              noValidate
            >

              {/* ── STEP 1: PERSONAL DETAILS ───────────────────── */}
              <div className={`space-y-gutter transition-all duration-300 ${activeStep === 1 ? '' : 'hidden'}`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  <div className="flex flex-col gap-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="full-name">Full Name</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">person</span>
                      <input 
                        id="full-name" 
                        name="full-name" 
                        type="text" 
                        required
                        placeholder="Enter your full name" 
                        className={`${inputClass} pl-12 ${errors['full-name'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                      />
                    </div>
                    {errors['full-name'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['full-name']}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="gender">Gender</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">wc</span>
                      <select 
                        id="gender" 
                        name="gender" 
                        required
                        className={`${inputClass} pl-12 pr-10 appearance-none ${errors['gender'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                        defaultValue=""
                      >
                        <option disabled value="">Select your gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                      <span className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">expand_more</span>
                    </div>
                    {errors['gender'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['gender']}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  <div className="flex flex-col gap-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="email">Email Address</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">mail</span>
                      <input 
                        id="email" 
                        name="email" 
                        type="email" 
                        required
                        placeholder="Enter your email address" 
                        className={`${inputClass} pl-12 ${errors['email'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                      />
                    </div>
                    {errors['email'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['email']}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="contact">Phone Number</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">call</span>
                      <input 
                        id="contact" 
                        name="contact" 
                        type="tel" 
                        required
                        placeholder="Enter your contact number" 
                        className={`${inputClass} pl-12 ${errors['contact'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                      />
                    </div>
                    {errors['contact'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['contact']}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  <div className="flex flex-col gap-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="dob">Date of Birth</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px] pointer-events-none">calendar_month</span>
                      <input 
                        id="dob" 
                        name="dob" 
                        type="date" 
                        required 
                        className={`${inputClass} pl-12 text-on-surface ${errors['dob'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                      />
                    </div>
                    {errors['dob'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['dob']}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="location">Current Location</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">location_on</span>
                      <input 
                        id="location" 
                        name="location" 
                        type="text" 
                        required
                        placeholder="City, State" 
                        className={`${inputClass} pl-12 ${errors['location'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                      />
                    </div>
                    {errors['location'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['location']}</p>}
                  </div>
                </div>

                <div className="flex justify-end pt-md">
                  <button
                    type="button"
                    onClick={() => handleStepClick(2)}
                    className="bg-[#f05a28] text-white px-8 py-3.5 rounded-xl font-montserrat text-body-md hover:bg-[#d84a1b] active:scale-95 transition-all flex items-center gap-sm font-bold shadow-md"
                  >
                    <span>Continue to Academic Details</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* ── STEP 2: ACADEMIC DETAILS ───────────────────── */}
              <div className={`space-y-gutter transition-all duration-300 ${activeStep === 2 ? '' : 'hidden'}`}>
                <div className="flex flex-col gap-2">
                  <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="qualification">Highest Qualification</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">school</span>
                    <input 
                      id="qualification" 
                      name="qualification" 
                      type="text" 
                      required
                      placeholder="Enter your highest qualification" 
                      className={`${inputClass} pl-12 ${errors['qualification'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                    />
                  </div>
                  {errors['qualification'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['qualification']}</p>}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-inter text-body-sm font-bold text-on-surface-variant">Current Occupation</label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-sm">
                    {['student', 'professional', 'teacher'].map((val) => (
                      <label
                        key={val}
                        className={`flex items-center gap-sm p-3 bg-surface border rounded-xl cursor-pointer hover:border-primary transition-all ${
                          occupation === val 
                            ? 'border-primary ring-2 ring-primary/15 bg-primary/5' 
                            : errors['occupation'] ? 'border-rose-500' : 'border-outline-variant'
                        }`}
                      >
                        <input
                          type="radio"
                          name="occupation"
                          value={val}
                          checked={occupation === val}
                          onChange={() => { setOccupation(val); setErrors(prev => ({...prev, occupation: ''})); }}
                          className="text-primary focus:ring-primary h-4 w-4"
                        />
                        <span className="font-inter text-body-md font-bold text-primary capitalize">
                          {val === 'teacher' ? 'Full-Time Teacher' : val}
                        </span>
                      </label>
                    ))}
                  </div>
                  {errors['occupation'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['occupation']}</p>}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="experience">Any Teaching Experience?</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-4 text-on-surface-variant text-[20px]">edit_note</span>
                    <textarea
                      id="experience"
                      name="experience"
                      rows={3}
                      placeholder="Briefly describe your teaching background..."
                      className={`${inputClass} pl-12 pt-3.5 resize-none`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                  <div className="flex flex-col gap-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="grades">Grades/Classes You Can Teach</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">school</span>
                      <input 
                        id="grades" 
                        name="grades" 
                        type="text" 
                        required
                        placeholder="Grades/classes you can teach (e.g. 8th to 12th)" 
                        className={`${inputClass} pl-12 ${errors['grades'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                      />
                    </div>
                    {errors['grades'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['grades']}</p>}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="subjects">Subjects You Can Handle</label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">menu_book</span>
                      <input 
                        id="subjects" 
                        name="subjects" 
                        type="text" 
                        required
                        placeholder="Subjects you can teach (e.g. Mathematics, Physics)" 
                        className={`${inputClass} pl-12 ${errors['subjects'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                      />
                    </div>
                    {errors['subjects'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['subjects']}</p>}
                  </div>
                </div>

                <div className="flex justify-between pt-md">
                  <button
                    type="button"
                    onClick={() => handleStepClick(1)}
                    className="text-primary px-8 py-3.5 rounded-xl font-montserrat text-body-md hover:bg-surface-container font-bold transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStepClick(3)}
                    className="bg-[#f05a28] text-white px-8 py-3.5 rounded-xl font-montserrat text-body-md hover:bg-[#d84a1b] active:scale-95 transition-all flex items-center gap-sm font-bold shadow-md"
                  >
                    <span>Continue to Logistics</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </div>

              {/* ── STEP 3: LOGISTICS ──────────────────────────── */}
              <div className={`space-y-gutter transition-all duration-300 ${activeStep === 3 ? '' : 'hidden'}`}>
                <div className="flex flex-col gap-2">
                  <label className="font-inter text-body-sm font-bold text-on-surface-variant" htmlFor="time">Preferred Teaching Time</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">schedule</span>
                    <input 
                      id="time" 
                      name="time" 
                      type="text" 
                      required
                      placeholder="Enter preferred teaching time (e.g. Weekdays 6 PM - 9 PM)" 
                      className={`${inputClass} pl-12 ${errors['time'] ? 'border-rose-500 focus:ring-rose-500/20' : ''}`} 
                    />
                  </div>
                  {errors['time'] && <p className="text-rose-600 text-xs font-semibold mt-1 flex items-center gap-1"><span className="material-symbols-outlined text-sm">info</span>{errors['time']}</p>}
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-inter text-body-sm font-bold text-on-surface-variant">Preferred Board</label>
                  <div className="flex flex-wrap gap-md">
                    {[
                      { val: 'state', label: 'State' },
                      { val: 'cbse', label: 'CBSE' },
                      { val: 'icse', label: 'ICSE' },
                      { val: 'cambridge', label: 'Cambridge' },
                    ].map(({ val, label }) => (
                      <label 
                        key={val} 
                        className={`flex items-center gap-sm px-md py-3 rounded-xl cursor-pointer hover:border-primary transition-all border ${
                          boards[val] ? 'bg-primary/5 border-primary text-primary font-bold' : 'bg-surface-container border-outline-variant/30 text-on-surface'
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="board"
                          value={val}
                          checked={boards[val]}
                          onChange={() => setBoards({ ...boards, [val]: !boards[val] })}
                          className="rounded text-primary focus:ring-primary h-4 w-4"
                        />
                        <span className="font-inter text-body-sm">{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Technology toggle */}
                <div className="bg-surface-container-low p-md rounded-2xl border border-primary/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-inter text-body-md font-bold text-primary">Access to Technology</h4>
                      <p className="font-inter text-body-sm text-on-surface-variant">
                        Do you have access to a computer/laptop and internet?
                      </p>
                    </div>
                    <div className="flex items-center gap-sm">
                      <span className="font-montserrat text-label-md text-on-surface-variant">No</span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={hasTech}
                          onChange={() => setHasTech(!hasTech)}
                        />
                        <div className="w-11 h-6 bg-surface-variant peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </label>
                      <span className="font-montserrat text-label-md text-primary font-bold">Yes</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-md">
                  <button
                    type="button"
                    onClick={() => handleStepClick(2)}
                    disabled={isSubmitting}
                    className="text-primary px-8 py-3.5 rounded-xl font-montserrat text-body-md hover:bg-surface-container font-bold transition-all disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-primary text-on-primary px-10 py-3.5 rounded-xl font-montserrat text-body-md hover:opacity-90 active:scale-95 transition-all shadow-md font-bold flex items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>Submit Application</span>
                        <span className="material-symbols-outlined text-[20px]">send</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </form>

            {/* Information privacy banner */}
            <div className="bg-[#f0f5fa] rounded-xl p-4 flex items-center gap-3 border border-outline-variant/10">
              <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
              <p className="font-inter text-body-sm text-on-surface-variant font-medium">
                Your information is secure with us. We respect your privacy and will never share your details.
              </p>
            </div>
          </div>
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
              Application Submitted Successfully! 🎉
            </h3>
            
            {/* Message Body */}
            <div className="space-y-4 font-inter text-body-md text-on-surface-variant leading-relaxed text-center mb-8">
              <p>Thank you for your interest in joining DHIYONI Tutorials as a tutor.</p>
              <p>We have successfully received your application and our team will review your details.</p>
              <p className="font-semibold text-primary">Our team will contact you within 48 hours regarding the next steps.</p>
              <p>If you have any questions, feel free to reach out to us.</p>
              <p className="text-body-sm italic mt-4 text-on-surface-variant/80">Thank you for choosing DHIYONI Tutorials.</p>
            </div>

            {/* OK Action Button */}
            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false)
                setActiveStep(1)
              }}
              className="w-full flex items-center justify-center bg-primary text-white font-bold py-4 px-6 rounded-xl shadow-md hover:bg-primary-container active:scale-95 transition-all text-body-md shrink-0"
            >
              OK
            </button>

          </div>
        </div>
      )}
    </div>
  )
}
