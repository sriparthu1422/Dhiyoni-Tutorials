import { useEffect, useState } from 'react'
import SEO from '../components/SEO'

const tutors = [
  {
    name: 'Dr. Anita Sharma',
    subject: 'Mathematics',
    qualification: 'M.Sc, Ph.D in Maths',
    experience: '12+ Years',
    rating: '4.9',
    board: 'CBSE & ICSE',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCM5oyIoXXLAK34szcdBhhbbSUIelhHhtp8Gyc-ABppMVppF7f1QHdI6DrL5fY5S5eLNYF6qHKRCqCxWVf398g6OJOLTwBTTnSVNM23qXA4G9ZDevwhzJHsO1tf9p3dGlJm6916yVnFoeom8MH4FiiGrAHvKBgpVjjbS1YVr7r0XKm3m72sZobh-7Eg3mjw62vnBhmxsDOxfdBJLPL4w5b1Q_YRH9V-nv6qtfgSuxyWzEK0jXEa4m35GJZqmSy20s7BXDs_9S9Vb396',
  },
  {
    name: 'Prof. Rajesh Iyer',
    subject: 'Physics',
    qualification: 'M.Tech, B.Ed',
    experience: '15+ Years',
    rating: '5.0',
    board: 'State Board',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAWhjmkToOEY-HXI-kOZQnqPdvczr6YRVZF-v9gqGMZuiD646tmWFavKZYxHHpsAmZgF7I39wW65nIgVJP9kEl0h4rOFHV-L-8B3xYp0_p_8jycytSIOJ2_4CbGkrqvyFDZQAz3pOTQTO4npEzazUMruikThzyHdrd2RVx0OE8eYGcyozBTPjq9ml448t7dfjhwvemiwcD08Qk01KuBg48e7Sj-XTmOyFbc2h9d70SrBLWyPimx9rGAd_s489EKr-rdhChjALE5IP3y',
  },
  {
    name: 'Ms. Priya Verma',
    subject: 'Biology',
    qualification: 'M.Sc Biology',
    experience: '8+ Years',
    rating: '4.8',
    board: 'ICSE & CBSE',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCpK-nsv0LMutInjLcE1AyNfcXsYM77ewslUUMajzfFrOIPuNYVYFb3lPGo35JgN_xqfQcLYBXWZjHmkz-JCefn1n4Oc7xyCdQWsX9Jhsn_UoRIT28cJoyaC6eHXcNAAXVI2RsxbQ9n0MavR6Q7BPhAw2Nf8wS2rM2QVxsUOj0E6lh-QncDy6lLK3DfjP0tiTfmVlDDfo3TexstzMziC596m2Ls6tHNYRraCK6VngCW5EMVHPq2K9Tn2ciqN9jEFavs3B0euqIlJyQP',
  },
  {
    name: 'Mr. Sanjay Kapur',
    subject: 'Chemistry',
    qualification: 'M.Sc Chemistry, NET',
    experience: '10+ Years',
    rating: '4.9',
    board: 'All Boards',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDY4rItZaBA0p4aMnwqJ8FF1pfdQolcLwnvR85dZYqmByRHxNsTt-x4KyHax8noqtJ_vPE6O7hFBPfRH6zemMhq8HRr8DtLPLB-TI4ypk9lBOLAM6OYWo2h42NhSnXWhe1Fx0lodmi7U4Q7llPuT2BvPShZpp-ita4o9Nr14lzw-CoAQBOPc_1YTjuVNLPjAyQAIQSGBAXg6FQbalTwIGsgYpowqfM_x8gzFjlNZyPrqs9PjWFCBjO87_zDH-dc_KmMLq1VyQ_Fulz',
  },
]

export default function Tutors() {
  const [tutorsList, setTutorsList] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        const response = await fetch('/api/tutors')
        if (response.ok) {
          const data = await response.json()
          if (data && data.length > 0) {
            setTutorsList(data)
          } else {
            setTutorsList(tutors)
          }
        } else {
          setTutorsList(tutors)
        }
      } catch (err) {
        console.error('Failed to fetch tutors from backend:', err)
        setTutorsList(tutors)
      } finally {
        setLoading(false)
      }
    }

    fetchTutors()
  }, [])

  return (
    <div className="page-transition">
      <SEO 
        title="Our Expert Tutors | DHIYONI Tutorials"
        description="Meet our highly qualified and verified subject matter experts for CBSE, ICSE, and State Boards."
        keywords="Hire online tutors, expert educators, CBSE tutors online, ICSE tutors, subject matter experts"
        canonicalPath="/tutors"
      />
      <main className="relative">

        {/* ── HERO SECTION ─────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-surface-container-low pt-xl pb-lg">
          <div className="max-w-container-max mx-auto px-4 md:px-lg grid md:grid-cols-2 items-center gap-xl">

            {/* Left */}
            <div className="z-10">
              <span className="inline-block bg-primary-fixed text-primary px-sm py-xs rounded-full font-montserrat text-label-md mb-md">
                Our Faculty
              </span>
              <h1 className="font-montserrat font-bold text-display-lg-mobile md:text-display-lg text-on-surface mb-md">
                Meet Our Expert Educators
              </h1>
              <p className="font-inter text-body-lg text-on-surface-variant max-w-xl mb-lg leading-relaxed">
                Learn from India's most experienced and passionate educators. Our tutors bring deep subject knowledge, proven teaching expertise, and a commitment to student success across CBSE, ICSE, and State Boards.
              </p>
              <div className="flex flex-wrap gap-md">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-primary">verified_user</span>
                  <div className="flex flex-col">
                    <span className="font-montserrat text-label-md text-on-surface font-bold">Verified Profiles</span>
                    <span className="font-inter text-body-sm text-on-surface-variant">All tutors are background <br />verified and experienced.</span>
                  </div>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-primary">school</span>
                  <div className="flex flex-col">
                    <span className="font-montserrat text-label-md text-on-surface font-bold">Subject Matter Experts</span>
                    <span className="font-inter text-body-sm text-on-surface-variant">Specialized in their subject <br />to deliver the best results.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Image */}
            <div className="relative h-[400px] rounded-xl overflow-hidden shadow-2xl">
              <img
                alt="Education Hub"
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCzy_AJOJW03Q8ODT3k01G3n1mumU-Y8pNJN_KbsQG3qmeykSQq07IQk7AEEC3genQ_HTgmGrh9q14rlTAmh5L-jipv52FpDLP5ABOzBO4bIXp6L4BwQZbh95GXpCGG3HC0kJv87V524-Llf__sftIb-vphDu8BRkuD06SSTrlpcXHoQ9SGIOktmS-Kinn4R2ntbudmXU8oq0XqcDDFIvk70upWp05bXrOmNoBiVPsb64nctq9rokq6flmPFqy-g2Js6UhcOZ8fLUuc"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/30 to-transparent" />
            </div>
          </div>

          {/* Atmospheric BG blur */}
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary-fixed-dim/20 rounded-full blur-3xl pointer-events-none" />
        </section>

        {/* ── SEARCH & FILTER BAR ──────────────────────────────── */}
        <section className="sticky top-20 z-40 py-md bg-surface border-b border-outline-variant shadow-sm">
          <div className="max-w-container-max mx-auto px-4 md:px-lg">
            <div className="flex flex-col md:flex-row gap-gutter items-center">
              <div className="w-full md:flex-1 flex flex-wrap gap-sm">
                <select
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-montserrat text-label-md focus:ring-2 focus:ring-primary outline-none transition-all"
                  onChange={e => { e.target.classList.add('scale-95'); setTimeout(() => e.target.classList.remove('scale-95'), 150) }}
                >
                  <option>All Subjects</option>
                  <option>Mathematics</option>
                  <option>Science (Physics/Chem/Bio)</option>
                  <option>English Literature</option>
                  <option>Social Studies</option>
                  <option>Computer Science</option>
                </select>
                <select
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-montserrat text-label-md focus:ring-2 focus:ring-primary outline-none transition-all"
                  onChange={e => { e.target.classList.add('scale-95'); setTimeout(() => e.target.classList.remove('scale-95'), 150) }}
                >
                  <option>All Boards</option>
                  <option>CBSE</option>
                  <option>ICSE</option>
                  <option>State Board</option>
                  <option>IB / IGCSE</option>
                </select>
                <select
                  className="bg-surface-container-lowest border border-outline-variant rounded-lg px-md py-sm font-montserrat text-label-md focus:ring-2 focus:ring-primary outline-none transition-all"
                  onChange={e => { e.target.classList.add('scale-95'); setTimeout(() => e.target.classList.remove('scale-95'), 150) }}
                >
                  <option>Experience</option>
                  <option>5+ Years</option>
                  <option>10+ Years</option>
                  <option>15+ Years</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* ── TUTOR GRID ───────────────────────────────────────── */}
        <section className="py-xl max-w-container-max mx-auto">
          <div className="grid gap-gutter grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 justify-items-center px-4 md:px-lg">
            {tutorsList.map((tutor, index) => (
              <div
                key={tutor.name}
                className="bg-white rounded-xl border border-surface-variant tutor-card-shadow transition-all duration-300 overflow-hidden group w-full max-w-[400px] animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Image */}
                <div className="h-64 relative overflow-hidden">
                  <img
                    alt={`Tutor Portrait - ${tutor.name}`}
                    className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    src={tutor.image}
                  />
                  <div className="absolute top-sm right-sm bg-primary text-white text-[10px] uppercase font-bold px-xs py-[2px] rounded">
                    {tutor.board}
                  </div>
                </div>

                {/* Info */}
                <div className="py-md px-gutter">
                  <h3 className="font-montserrat font-semibold text-headline-md text-on-surface mb-xs">{tutor.name}</h3>
                  <div className="flex items-center gap-xs mb-md">
                    <span className="bg-tertiary-fixed text-primary px-xs py-[2px] rounded font-montserrat text-[10px]">
                      {tutor.subject}
                    </span>
                    <span className="text-on-surface-variant font-montserrat text-[10px]">• {tutor.qualification}</span>
                  </div>
                  <div className="flex items-center justify-between mb-lg border-t border-b border-surface-container py-sm">
                    <div className="flex flex-col">
                      <span className="font-montserrat text-[10px] text-outline uppercase tracking-wider">Experience</span>
                      <span className="font-inter text-body-md font-semibold">{tutor.experience}</span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="font-montserrat text-[10px] text-outline uppercase tracking-wider">Rating</span>
                      <div className="flex items-center gap-[2px] text-secondary">
                        <span
                          className="material-symbols-outlined text-sm"
                          style={{ fontVariationSettings: '"FILL" 1' }}
                        >
                          star
                        </span>
                        <span className="font-inter text-body-md font-semibold">{tutor.rating}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CTA SECTION ──────────────────────────────────────── */}
        <section className="py-xl bg-primary text-white relative overflow-hidden">
          <div className="max-w-container-max mx-auto px-4 md:px-lg relative z-10 flex flex-col md:flex-row items-center justify-between gap-lg">
            <div className="max-w-lg">
              <h2 className="font-montserrat font-semibold text-headline-lg text-white mb-sm">
                Not sure who to choose?
              </h2>
              <p className="font-inter text-body-md text-white/80">
                Get a free consultation from our career counselors to find the perfect match for your learning style and board requirements.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-sm w-full md:w-auto">
              <a
                href="https://wa.me/917901034846?text=Hi!%20I%20want%20to%20know%20more%20about%20DHIYONI%20Tutorials."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white/10 border border-white/20 text-white px-xl py-md rounded-lg font-montserrat text-label-md hover:bg-white/20 transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
                Know More
              </a>
            </div>
          </div>
          {/* Decorative circle */}
          <div className="absolute -bottom-24 -left-24 w-64 h-64 border-[32px] border-white/5 rounded-full pointer-events-none" />
        </section>

      </main>
    </div>
  )
}
