import { useState, useEffect } from 'react'

export default function ExitIntentModal() {
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    // 1. Mouse Leave detection (Desktop)
    const handleMouseLeave = (e) => {
      const hasShown = sessionStorage.getItem('exit_intent_shown')
      if (hasShown) return

      if (e.clientY < 20) { // Mouse moved up past top of screen
        setShowModal(true)
        sessionStorage.setItem('exit_intent_shown', 'true')
      }
    }

    // 2. Intercept browser Back button / route exit
    const handlePopState = () => {
      const hasShown = sessionStorage.getItem('exit_intent_shown')
      if (!hasShown) {
        // Prevent going back, push state again to hold the page, and show modal
        window.history.pushState(null, null, window.location.pathname)
        setShowModal(true)
        sessionStorage.setItem('exit_intent_shown', 'true')
      }
    }

    // Initialize an extra history entry so we can catch the back popstate
    window.history.pushState(null, null, window.location.pathname)

    document.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('popstate', handlePopState)

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  if (!showModal) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 py-8 animate-fade-in-up">
      <div className="bg-white rounded-3xl p-8 md:p-10 border border-outline-variant max-w-md w-full text-center relative shadow-2xl flex flex-col items-center">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={() => setShowModal(false)}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-primary transition-colors p-1 rounded-full hover:bg-surface-container"
          aria-label="Close modal"
        >
          <span className="material-symbols-outlined text-[24px]">close</span>
        </button>

        {/* Pulse Support Agent/Expert Icon */}
        <div className="w-20 h-20 bg-[#f0f5fa] rounded-full flex items-center justify-center mb-6 text-primary ring-8 ring-primary/5 animate-pulse shrink-0">
          <span className="material-symbols-outlined text-[40px]">support_agent</span>
        </div>

        {/* Text Copy */}
        <h3 className="font-montserrat font-bold text-headline-lg text-primary mb-3">
          Why are you leaving?
        </h3>
        
        <h4 className="font-montserrat font-semibold text-body-lg text-[#f05a28] mb-4">
          Think twice about your child’s future learning.
        </h4>
        
        <p className="font-inter text-body-md text-on-surface-variant leading-relaxed mb-8">
          Give them stress-free, burden-free classes with personal attention at <span className="font-bold text-primary">Dhiyoni Tutorials</span>.
        </p>

        {/* Call to Action Button */}
        <a
          href="https://wa.me/917901034846?text=Hi!%20I%20want%20to%20talk%20to%20an%20academic%20expert%20for%20my%20child's%20future%20learning."
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setShowModal(false)}
          className="w-full flex items-center justify-center gap-sm bg-[#f05a28] text-white font-bold py-4 px-6 rounded-xl shadow-md hover:bg-[#d84a1b] active:scale-95 transition-all text-body-md shrink-0"
        >
          <span className="material-symbols-outlined text-[22px]">support_agent</span>
          <span>Talk to our expert</span>
        </a>

      </div>
    </div>
  )
}
