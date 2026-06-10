import { useEffect, useState, useRef } from 'react'
import { AnimatedSection } from '../components/shared'
import aboutHeroImg1 from '../assets/About_page_image_1.png'
import aboutHeroImg2 from '../assets/About_page_image_2.png'

function AnimatedCounter({ target, duration = 2000, suffix = '', formatter }) {
  const [count, setCount] = useState(0)
  const countRef = useRef(null)

  useEffect(() => {
    let observer
    let animationFrameId
    const element = countRef.current

    if (!element) return

    const startAnimation = () => {
      let startTime = null

      const animate = (timestamp) => {
        if (!startTime) startTime = timestamp
        const progress = Math.min((timestamp - startTime) / duration, 1)
        const easeProgress = progress * (2 - progress)
        const currentCount = Math.floor(easeProgress * target)
        
        setCount(currentCount)

        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate)
        } else {
          setCount(target)
        }
      }

      animationFrameId = requestAnimationFrame(animate)
    }

    observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting) {
          startAnimation()
          observer.unobserve(element)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(element)

    return () => {
      if (observer && element) {
        observer.unobserve(element)
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
    }
  }, [target, duration])

  return (
    <span ref={countRef}>
      {formatter ? formatter(count) : count}
      {suffix}
    </span>
  )
}

export default function About() {
  const HERO_IMAGES = [aboutHeroImg1, aboutHeroImg2]
  const [currentImageIdx, setCurrentImageIdx] = useState(0)

  useEffect(() => {
    document.title = 'About Us | DHIYONI Tutorials'
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIdx(prev => (prev + 1) % HERO_IMAGES.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="page-transition">

      {/* ── HERO SECTION ─────────────────────────────────────── */}
      <section className="relative py-lg md:py-xl overflow-hidden bg-surface-container-low">
        <div className="max-w-container-max mx-auto px-4 sm:px-md lg:px-lg grid grid-cols-1 lg:grid-cols-2 items-center gap-lg">
          {/* Left: Text */}
          <AnimatedSection className="z-10 text-center lg:text-left">
            <h1 className="font-montserrat font-bold text-display-lg-mobile md:text-display-lg text-primary mb-md">
              Nurturing Minds, <br />
              <span className="text-secondary">Shaping Futures</span>
            </h1>
            <p className="font-inter text-body-md lg:text-body-lg text-on-surface-variant mb-lg">
              DHIYONI Tutorials is a premier educational institution dedicated to providing personalized coaching and holistic development for students across various curriculum frameworks.
            </p>
            <div className="flex items-center justify-center lg:justify-start gap-base">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                workspace_premium
              </span>
              <span className="font-montserrat text-label-md text-on-surface-variant uppercase tracking-wider">
                Trusted by 500+ Families
              </span>
            </div>
          </AnimatedSection>

          {/* Right: Image Carousel + Floating Badge */}
          <AnimatedSection delay={150} className="relative mt-md lg:mt-0">
            <div className="relative w-full h-[300px] md:h-[400px] rounded-xl teal-shadow overflow-hidden">
              {HERO_IMAGES.map((img, index) => (
                <img
                  key={index}
                  alt="Our Team"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                    currentImageIdx === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
                  }`}
                  src={img}
                />
              ))}
            </div>
            {/* Floating badge */}
            <div className="absolute bottom-4 left-4 lg:-bottom-6 lg:-left-6 bg-secondary text-white p-3 lg:p-md rounded-lg teal-shadow z-20">
              <div className="font-montserrat font-semibold text-headline-sm lg:text-headline-md">15+ Years</div>
              <div className="font-inter text-body-sm lg:opacity-90">Academic Excellence</div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── BENTO GRID: JOURNEY / MISSION / VISION ───────────── */}
      <section className="py-lg md:py-xl bg-background">
        <div className="max-w-container-max mx-auto px-4 sm:px-md lg:px-lg">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-md lg:gap-gutter">

            {/* Card 1: Our Journey */}
            <AnimatedSection delay={0}>
              <div className="bg-white p-md lg:p-lg rounded-xl border border-surface-variant teal-shadow hover:shadow-teal-hover transition-all flex flex-col h-full">
                <div className="flex items-center gap-sm mb-md text-primary">
                  <span className="material-symbols-outlined text-[28px] lg:text-[32px]">history_edu</span>
                  <h2 className="font-montserrat font-semibold text-headline-lg-mobile lg:text-headline-md">Our Journey</h2>
                </div>
                <p className="font-inter text-body-md text-on-surface-variant leading-relaxed">
                  Founded in 2025, DHIYONI Tutorial started its mission in Hyderabad to provide quality education and supportive learning environments.
                </p>
                <div className="mt-2 font-inter text-body-md text-on-surface-variant leading-relaxed">
                  Over the years, we have evolved into a multidisciplinary educational hub, consistently achieving a 98% success rate.
                </div>
              </div>
            </AnimatedSection>

            {/* Card 2: Our Mission (orange background) */}
            <AnimatedSection delay={100}>
              <div
                className="p-md lg:p-lg rounded-xl border border-surface-variant teal-shadow hover:shadow-teal-hover transition-all flex flex-col h-full"
                style={{ backgroundColor: '#F05A28' }}
              >
                <div className="flex items-center gap-sm mb-md text-white">
                  <span className="material-symbols-outlined text-[28px] lg:text-[32px]">rocket_launch</span>
                  <h2 className="font-montserrat font-semibold text-headline-lg-mobile lg:text-headline-md">Our Mission</h2>
                </div>
                <p className="font-inter text-body-md leading-relaxed text-white">
                  To democratize high-quality education through personalized mentoring, innovative teaching methods, and access to unique learning resources that ignite academic passion and the potential.
                </p>
              </div>
            </AnimatedSection>

            {/* Card 3: Our Vision */}
            <AnimatedSection delay={200}>
              <div className="bg-white p-md lg:p-lg rounded-xl border border-surface-variant teal-shadow hover:shadow-teal-hover transition-all flex flex-col h-full">
                <div className="flex items-center gap-sm mb-md text-primary">
                  <span className="material-symbols-outlined text-[28px] lg:text-[32px]">visibility</span>
                  <h2 className="font-montserrat font-semibold text-headline-lg-mobile lg:text-headline-md">Our Vision</h2>
                </div>
                <p className="font-inter text-body-md text-on-surface-variant leading-relaxed">
                  To be the global benchmark in supplementary education, blending traditional pedagogy with modern technology to create lifelong learners and future leaders.
                </p>
              </div>
            </AnimatedSection>

          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE + TRUST STATS ─────────────────────────── */}
      <section className="py-lg md:py-xl bg-primary text-on-primary">
        <div className="max-w-container-max mx-auto px-4 sm:px-md lg:px-lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg lg:gap-xl items-center">

            {/* Left: Why Choose list */}
            <AnimatedSection>
              <h2 className="font-montserrat font-semibold text-headline-lg-mobile md:text-headline-lg mb-md lg:mb-lg text-center lg:text-left">
                Why Choose DHIYONI Tutorials?
              </h2>
              <div className="space-y-md lg:space-y-lg">
                {[
                  {
                    icon: 'verified_user',
                    title: 'Quality Tutors',
                    desc: 'Our educators are selected through a rigorous 5-step process ensuring only the top 1% teach your child.',
                  },
                  {
                    icon: 'layers',
                    title: 'Multiple Boards',
                    desc: 'Specialized curriculum for CBSE, ICSE, IGCSE, and various State Boards across India.',
                  },
                  {
                    icon: 'schedule',
                    title: 'Flexible Timing',
                    desc: 'Choose your own slots. We understand that every student has a different rhythm of learning.',
                  },
                ].map(({ icon, title, desc }, i) => (
                  <AnimatedSection key={title} delay={i * 100}>
                    <div className="flex gap-md flex-col sm:flex-row items-center sm:items-start text-center sm:text-left">
                      <div className="w-12 h-12 flex-shrink-0 bg-white/10 rounded-full flex items-center justify-center">
                        <span className="material-symbols-outlined text-tertiary-fixed">{icon}</span>
                      </div>
                      <div>
                        <h4 className="font-montserrat font-semibold text-headline-lg-mobile lg:text-headline-md mb-xs">
                          {title}
                        </h4>
                        <p className="font-inter text-body-md" style={{ color: 'rgba(255,255,255,0.8)' }}>{desc}</p>
                      </div>
                    </div>
                  </AnimatedSection>
                ))}
              </div>
            </AnimatedSection>

            {/* Right: Trust Stats Bento Grid */}
            <AnimatedSection delay={150} className="relative mt-lg lg:mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm lg:gap-md">
                <div className="bg-white/5 p-md lg:p-lg rounded-2xl border border-white/10 text-center">
                  <div className="text-[32px] lg:text-[40px] font-bold text-secondary-fixed-dim font-montserrat">
                    <AnimatedCounter target={500} suffix="+" />
                  </div>
                  <div className="font-montserrat text-label-md uppercase tracking-wider">Expert Tutors</div>
                </div>
                <div className="bg-white/5 p-md lg:p-lg rounded-2xl border border-white/10 text-center">
                  <div className="text-[32px] lg:text-[40px] font-bold text-secondary-fixed-dim font-montserrat">
                    <AnimatedCounter
                      target={5000}
                      suffix="+"
                      formatter={(val) => {
                        if (val >= 1000) {
                          return (val / 1000).toFixed(1).replace('.0', '') + 'k'
                        }
                        return val
                      }}
                    />
                  </div>
                  <div className="font-montserrat text-label-md uppercase tracking-wider">Happy Students</div>
                </div>
                <div className="bg-white/5 p-md lg:p-lg rounded-2xl border border-white/10 text-center col-span-1 sm:col-span-2">
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-sm lg:gap-md">
                    <div className="text-[32px] lg:text-[40px] font-bold text-secondary-fixed-dim font-montserrat">
                      <AnimatedCounter target={97} suffix="%" />
                    </div>
                    <div className="text-center sm:text-left">
                      <div className="font-montserrat text-label-md uppercase tracking-wider">Success Rate</div>
                      <div className="font-inter text-body-sm opacity-60">Based on parent feedback</div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimatedSection>

          </div>
        </div>
      </section>

      {/* ── CTA SECTION ──────────────────────────────────────── */}
      <section className="py-md md:py-lg">
        <div className="max-w-container-max mx-auto px-4 sm:px-md lg:px-lg">
          <div
            className="cta-hover-card bg-surface-container rounded-3xl p-6 lg:p-8 flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-6 overflow-hidden relative text-center lg:text-left hover:scale-[1.03] hover:shadow-md transition-all duration-300 ease-out"
          >
            {/* Text */}
            <div className="z-10 relative">
              <h2 className="font-montserrat font-semibold text-headline-lg-mobile md:text-headline-lg text-primary mb-sm lg:mb-md">
                Ready to Start Your Journey?
              </h2>
              <p className="font-inter text-on-surface-variant text-body-lg max-w-md mx-auto lg:mx-0">
                Book a free trial session today and experience the DHIYONI difference firsthand.
              </p>
            </div>

            {/* WhatsApp Button */}
            <div className="flex gap-md z-10 relative mt-md lg:mt-0">
              <a
                href={`https://wa.me/917901034846?text=${encodeURIComponent(
                  "Hi, I would like to know more about DHIYONI Tutorials. Could you please provide me with information about the courses offered, teaching methods, available programs, tutors, class schedules, and the enrollment process?\n\nThank you."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold px-lg lg:px-xl py-sm lg:py-md rounded-xl text-body-sm lg:text-body-md shadow-lg hover:shadow-xl transition-all flex items-center gap-2 hover:scale-105 active:scale-95 text-white"
                style={{ backgroundColor: '#25D366' }}
              >
                <span className="material-symbols-outlined">chat</span>
                Know More
              </a>
            </div>

            {/* Abstract background shape */}
            <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />
          </div>
        </div>
      </section>

    </div>
  )
}
