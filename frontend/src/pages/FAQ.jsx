import React, { useState } from 'react'
import SEO from '../components/SEO'

const faqs = [
  {
    question: "How do I find a tutor for my child?",
    answer: "You can find a tutor by filling out the Parent Registration form on our website. Once you submit your requirements, our team will match you with the best available tutor."
  },
  {
    question: "What subjects do your tutors cover?",
    answer: "Our tutors cover a wide range of subjects including Mathematics, Science, English, Languages, and specialized coaching for competitive exams like IIT and NEET."
  },
  {
    question: "How can I apply to become a tutor?",
    answer: "If you are passionate about teaching, you can apply by navigating to the 'Tutor Sign Up' page and submitting your details and qualifications."
  },
  {
    question: "Are the classes online or offline?",
    answer: "We offer both online and offline (home tuition) options depending on your location and preference. You can specify this during registration."
  },
  {
    question: "What is the fee structure?",
    answer: "The fee depends on the grade level, subject, and the frequency of classes. Please contact our support team for a detailed quote based on your specific needs."
  }
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)

  return (
    <>
      <SEO title="Frequently Asked Questions" description="FAQ for Dhiyoni Tutorials" />
      <div className="section-container py-12 md:py-20 max-w-3xl mx-auto">
        <h1 className="text-display-md font-montserrat font-bold text-primary mb-2 text-center">Frequently Asked Questions</h1>
        <p className="text-on-surface-variant text-center mb-12">Find answers to common questions about our tutoring services.</p>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index
            return (
              <div 
                key={index} 
                className="bg-surface rounded-2xl border border-outline-variant overflow-hidden transition-all duration-200"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className="font-semibold text-title-lg text-on-surface">{faq.question}</span>
                  <span className={`material-symbols-outlined text-primary transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                
                <div 
                  className={`px-6 overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <p className="text-on-surface-variant text-body-lg">
                    {faq.answer}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
