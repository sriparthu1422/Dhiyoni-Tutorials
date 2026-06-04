import { useEffect, useRef } from 'react'

export function AnimatedSection({ children, className = '', delay = 0 }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            el.classList.add('visible')
          }, delay)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [delay])

  return (
    <div ref={ref} className={`animate-on-scroll ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({ icon, value, label, color = 'primary' }) {
  return (
    <div className="card p-6 text-center hover:-translate-y-1 transition-transform duration-300">
      <div className={`w-12 h-12 bg-${color}-fixed rounded-xl flex items-center justify-center mx-auto mb-3`}>
        <span className={`material-symbols-outlined text-${color} text-[24px]`}>{icon}</span>
      </div>
      <p className="font-montserrat font-bold text-2xl text-on-surface mb-1">{value}</p>
      <p className="text-on-surface-variant text-body-sm">{label}</p>
    </div>
  )
}

export function FeatureCard({ icon, title, description, iconBg = 'primary-fixed', iconColor = 'primary', delay = 0 }) {
  return (
    <AnimatedSection delay={delay}>
      <div className="bg-white p-lg rounded-xl teal-shadow hover:-translate-y-2 transition-all duration-300 h-full group">
        <div className={`w-12 h-12 bg-${iconBg} flex items-center justify-center rounded-lg mb-md group-hover:scale-110 transition-transform duration-300`}>
          <span
            className={`material-symbols-outlined text-${iconColor}`}
            style={{ fontVariationSettings: '"FILL" 1' }}
          >
            {icon}
          </span>
        </div>
        <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">{title}</h3>
        <p className="text-on-surface-variant text-body-md">{description}</p>
      </div>
    </AnimatedSection>
  )
}

export function SectionHeader({ tag, tagBg = 'tertiary-fixed', tagColor = 'primary', title, subtitle, centered = true }) {
  return (
    <AnimatedSection className={`mb-12 ${centered ? 'text-center' : ''}`}>
      {tag && (
        <span className={`section-tag bg-${tagBg} text-${tagColor} mb-4`}>{tag}</span>
      )}
      <h2 className="font-montserrat font-semibold text-headline-lg-mobile md:text-headline-lg text-primary mb-sm">
        {title}
      </h2>
      {subtitle && (
        <p className="text-on-surface-variant text-body-md max-w-2xl mx-auto">{subtitle}</p>
      )}
    </AnimatedSection>
  )
}
