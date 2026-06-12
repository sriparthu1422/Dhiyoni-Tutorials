import { useEffect, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import SEO from '../components/SEO'
import student from '../assets/student.png'
import student2 from '../assets/student2.png'

const filters = [
  { label: 'Grade 3-5', value: 'grade-3-5' },
  { label: 'Grade 6-10', value: 'grade-6-10' },
  { label: 'IIT/NEET Foundation', value: 'foundation' },
  { label: 'IIT/NEET Coaching', value: 'coaching' },
  { label: 'Languages', value: 'languages' },
  { label: 'Extracurriculars', value: 'extracurriculars' },
]

const courses = [
  {
    category: ['grade-3-5'],
    type: 'Primary (Grades 1-5)',
    typeIcon: 'palette',
    typeColor: 'text-tertiary',
    title: 'Comprehensive Primary Years',
    desc: 'Nurturing holistic development with integrated learning across Mathematics, Science, and Humanities.',
    tag: 'All Subjects',
    tagBg: 'bg-tertiary-fixed text-primary',
    price: 'Starts @ ₹499/mo',
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-secondary-container text-on-secondary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['grade-6-10'],
    type: 'Middle & High School',
    typeIcon: 'calculate',
    typeColor: 'text-tertiary',
    title: 'Advanced Mathematics',
    desc: 'Deep dive into Algebra, Calculus, and Geometry with an interactive problem-solving session.',
    tags: ['Grade 10-12', 'NCERT Sync'],
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['grade-6-10'],
    type: 'Middle & High School',
    typeIcon: 'science',
    typeColor: 'text-tertiary',
    title: 'Physics & Chemistry Elite',
    desc: 'Experimental concepts and theoretical mastery for board exams and beyond.',
    tags: ['Grade 9-11', 'Live Labs'],
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['grade-6-10'],
    type: 'Middle & High School',
    typeIcon: 'microbiology',
    typeColor: 'text-tertiary',
    title: 'Biology Essentials',
    desc: 'Comprehensive coverage of Life Sciences with diagrams, real-life examples, and NCERT-based learning',
    tags: ['Grade 9-10', 'NCERT Focused'],
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['grade-6-10'],
    type: 'Middle & High School',
    typeIcon: 'Globe',
    typeColor: 'text-tertiary',
    title: 'Social Studies Mastery',
    desc: 'In-depth understanding of History, Geography, Civics, and Economics for strong conceptual clarity.',
    tags: ['Grade 6-10', 'Map & Case Based'],
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['foundation'],
    type: 'FOUNDATION (GRADES 6–10)',
    typeColor: 'text-secondary',
    title: 'Level 1: Discovery',
    desc: 'Grades 6–7 focus on logical reasoning and building strong fundamentals in Maths and Science.',
    features: ['Concept Introduction', 'Interactive Learning', 'Strong Fundamentals'],
    viewModule: true,
    isFoundationCard: true,
    iconName: 'rocket_launch',
    iconBg: 'bg-[#00546c]',
    lineColor: 'border-[#00546c]',
  },
  {
    category: ['foundation'],
    type: 'FOUNDATION (GRADES 6–10)',
    typeColor: 'text-secondary',
    title: 'Level 2: Strategic',
    desc: 'Grade 8 intensive bridge course for building depth in core concepts and advanced problem solving.',
    features: ['Advanced Concepts', 'Problem Solving Techniques', 'Concept Application'],
    viewModule: true,
    isFoundationCard: true,
    iconName: 'landscape',
    iconBg: 'bg-[#00546c]',
    lineColor: 'border-[#00546c]',
  },
  {
    category: ['foundation'],
    type: 'FOUNDATION (GRADES 6–10)',
    typeColor: 'text-secondary',
    title: 'Level 3: Competitive',
    desc: 'Grades 9–10 advanced curriculum aligned with Olympiad patterns and competitive exam preparation.',
    features: ['Advanced Problem Solving', 'Olympiad-Oriented Practice', 'Performance Improvement'],
    viewModule: true,
    isFoundationCard: true,
    iconName: 'emoji_events',
    iconBg: 'bg-[#00546c]',
    lineColor: 'border-[#00546c]',
    titleColor: 'text-[#00546c]',
    listBg: 'bg-[#f0f5fa]',
    tickColor: 'text-[#f05a28]',
  },
  {
    category: ['coaching'],
    type: 'Competitive (Grades 11-12)',
    typeColor: 'text-tertiary-fixed-dim',
    title: 'IIT-JEE Main & Advanced',
    desc: 'Comprehensive coaching for JEE aspirants to build strong concepts, problem-solving skills, and exam readiness.',
    features: ['Live Classes by Expert Faculty', 'Concept-Based Learning', 'Personalized Doubt Support'],
    featureIconColor: 'text-tertiary-fixed-dim',
    btnLabel: 'Apply Now',
    btnStyle: 'bg-white text-primary hover:bg-surface-variant',
    cardStyle: 'bg-inverse-surface text-white border border-outline-variant relative overflow-hidden',
    textStyle: 'text-white',
    descStyle: 'text-surface-variant',
    darkCard: true,
    decoratorIcon: 'architecture',
  },
  {
    category: ['coaching'],
    type: 'Competitive (Grades 11-12)',
    typeColor: 'text-tertiary-fixed',
    title: 'NEET (UG) Excellence',
    desc: 'Targeted coaching for NEET aspirants with in-depth subject understanding and regular practice. ',
    features: ['Live Classes by Expert Facility', 'NCERT & Concept Focused Teaching ', 'Personalized Doubt Support'],
    featureIconColor: 'text-secondary-fixed',
    featureIconFill: true,
    btnLabel: 'Apply Now',
    btnStyle: 'bg-secondary-container text-on-secondary-container hover:opacity-90',
    cardStyle: 'bg-primary-container text-white border border-outline-variant relative overflow-hidden',
    textStyle: 'text-white',
    descStyle: 'text-tertiary-fixed',
    darkCard: true,
    decoratorIcon: 'medical_services',
    decoratorRotate: '-rotate-12',
  },
  {
    category: ['languages'],
    type: 'Language',
    typeColor: 'text-tertiary',
    langIcon: 'translate',
    title: 'Telugu',
    desc: 'Strengthen reading, writing, grammar, and conversational fluency through interactive sessions designed for native and academic proficiency. ',
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['languages'],
    type: 'Language',
    typeColor: 'text-tertiary',
    langIcon: 'menu_book',
    title: 'Hindi',
    desc: 'Comprehensive Hindi Learning focused on grammar, literature, communication, and curriculum-based academic excellence.',
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['languages'],
    type: 'Language',
    typeColor: 'text-tertiary',
    langIcon: 'language',
    title: 'English',
    desc: 'Enhance vocabulary, spoken communication, grammar, creative writing, and comprehensive skill for academic and real-world success.',
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['languages'],
    type: 'Language',
    typeColor: 'text-tertiary',
    langIcon: 'edit_note',
    title: 'French',
    desc: 'Learn French with beginner-friendly modules focused on pronunciation, vocabulary, DELF preparation & practical communication skills.',
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['extracurriculars'],
    type: 'Extracurriculars',
    typeColor: 'text-tertiary',
    langIcon: 'calculate',
    title: 'Abacus & Vedic Math',
    desc: 'Boost calculation speed, accuracy, and mental math skill with abacus and Vedic techniques.',
    tags: ['Grade 3-8', 'Brain Development'],
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
  {
    category: ['extracurriculars'],
    type: 'Extracurriculars',
    typeColor: 'text-tertiary',
    langIcon: 'book_2',
    title: 'BhagvatGeeta Reading',
    desc: 'Understand timeless wisdom through guide reading meaning and life lessons from the Bhagavad Gita.',
    tags: ['Grade 6-10', 'Value Education'],
    btnLabel: 'Enroll Now',
    btnStyle: 'bg-primary text-white hover:bg-primary-container',
    cardStyle: 'bg-white border border-outline-variant',
    textStyle: 'text-on-surface',
    descStyle: 'text-on-surface-variant',
  },
]

function CourseCard({ course }) {
  if (course.isFoundationCard) {
    return (
      <div
        className="course-card bg-white border border-outline-variant rounded-3xl p-6 md:p-8 teal-shadow teal-shadow-hover transition-all flex flex-col justify-between h-full group relative"
        style={{ transition: 'transform 0.2s ease' }}
        onMouseEnter={e => { if (window.innerWidth > 768) e.currentTarget.style.transform = 'translateY(-4px)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
      >
        <div className="relative z-10 flex flex-col h-full justify-between">
          <div>
            {/* Header row */}
            <div className="flex justify-between items-start mb-6">
              <span className={`font-montserrat text-label-md font-bold text-secondary uppercase tracking-wider mt-1`}>
                {course.type}
              </span>
              <div className={`w-16 h-16 rounded-full ${course.iconBg || 'bg-[#1e73be]'} flex items-center justify-center shrink-0 shadow-sm`}>
                <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: '"FILL" 1' }}>{course.iconName || 'rocket_launch'}</span>
              </div>
            </div>

            {/* Title */}
            <h3 className={`font-montserrat font-bold text-headline-lg ${course.titleColor || 'text-[#00546c]'} mb-2 leading-tight`}>
              {course.title}
            </h3>
            
            {/* Horizontal Separator line */}
            <div className={`border-b-4 ${course.lineColor || 'border-[#1e73be]'} w-12 mb-6`} />

            {/* Description */}
            <p className="font-inter text-body-md text-on-surface-variant mb-6 leading-relaxed">
              {course.desc}
            </p>

            {/* Light blue features container */}
            <div className={`${course.listBg || 'bg-[#f0f5fa]'} rounded-2xl p-5 mb-6`}>
              <ul className="space-y-4">
                {course.features.map(f => (
                  <li key={f} className="flex items-center gap-3 text-body-md text-on-surface-variant font-medium">
                    <span className={`material-symbols-outlined ${course.tickColor || 'text-[#00546c]'} font-bold text-lg`}>check</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* View Module Button */}
          <div className="pt-2">
            <Link
              to="/parent-signup"
              className="btn-primary block text-center font-bold text-base hover:opacity-90 active:scale-95 transition-all"
            >
              Enroll Now
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`course-card ${course.cardStyle} rounded-xl p-6 md:p-8 teal-shadow teal-shadow-hover transition-all flex flex-col justify-between h-full group`}
      style={{ transition: 'transform 0.2s ease' }}
      onMouseEnter={e => { if (window.innerWidth > 768) e.currentTarget.style.transform = 'translateY(-4px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Dark card decorator */}
      {course.darkCard && course.decoratorIcon && (
        <div className={`absolute -right-10 -bottom-10 opacity-10 scale-150 ${course.decoratorRotate || 'rotate-12'} pointer-events-none`}>
          <span className="material-symbols-outlined text-[150px]" style={{ fontVariationSettings: '"FILL" 1' }}>
            {course.decoratorIcon}
          </span>
        </div>
      )}

      <div className="relative z-10">
        {/* Header row */}
        <div className={`flex justify-between items-center mb-md pb-md border-b ${course.darkCard ? 'border-outline' : 'border-surface-variant'}`}>
          <span className={`font-montserrat text-label-md font-bold ${course.typeColor} uppercase tracking-wider`}>
            {course.type}
          </span>
          {course.typeIcon && (
            <span className={`material-symbols-outlined ${course.typeColor} text-xl`}>{course.typeIcon}</span>
          )}
          {course.langIcon && (
            <div className="bg-tertiary-fixed text-primary p-3 rounded-full">
              <span className="material-symbols-outlined text-2xl">{course.langIcon}</span>
            </div>
          )}
        </div>

        {/* Tag */}
        {course.tag && (
          <div className="flex justify-between items-start mb-sm">
            <span className={`${course.tagBg} px-sm py-[2px] rounded font-montserrat text-label-md`}>{course.tag}</span>
          </div>
        )}

        {/* Title */}
        <h3 className={`font-montserrat font-semibold text-2xl ${course.textStyle} mb-sm`}>{course.title}</h3>

        {/* Description */}
        <p className={`font-inter text-body-lg ${course.descStyle} mb-md`}>{course.desc}</p>

        {/* Tags (grade info) */}
        {course.tags && (
          <div className="flex flex-wrap gap-xs mb-lg">
            {course.tags.map(tag => (
              <span key={tag} className="bg-surface-variant text-on-surface-variant px-sm py-1 rounded-lg text-xs font-montserrat font-semibold">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Feature list */}
        {course.features && (
          <ul className="space-y-md mb-lg">
            {course.features.map(f => (
              <li key={f} className="flex items-center gap-sm text-base">
                <span
                  className={`material-symbols-outlined ${course.featureIconColor} text-xl`}
                  style={course.featureIconFill ? { fontVariationSettings: '"FILL" 1' } : {}}
                >
                  check_circle
                </span>
                {f}
              </li>
            ))}
          </ul>
        )}

        {/* Price */}
        {course.price && (
          <div className="flex items-center justify-between mt-auto pt-md">
            <span className="text-primary font-bold text-lg">{course.price}</span>
            <Link
              to="/parent-signup"
              className={`${course.btnStyle} px-6 py-sm rounded-lg font-bold hover:opacity-90 transition-all text-center`}
            >
              {course.btnLabel}
            </Link>
          </div>
        )}
      </div>

      {/* View Module link */}
      {course.viewModule && (
        <div className="mt-auto pt-md relative z-10">
          <a href="#" className="text-secondary font-bold text-lg hover:underline">View Module →</a>
        </div>
      )}

      {/* Full-width button */}
      {course.btnLabel && !course.price && !course.viewModule && (
        <Link
          to="/parent-signup"
          className={`relative z-10 w-full py-4 rounded-lg font-bold transition-all mt-auto text-center block ${course.btnStyle}`}
        >
          {course.btnLabel}
        </Link>
      )}
    </div>
  )
}

export default function Courses() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeFilter, setActiveFilter] = useState(searchParams.get('filter') || 'grade-3-5')
  
  const containerRef = useRef(null)
  const buttonRefs = useRef({})

  // Auto-rotating Image Carousel
  const IMAGES = [student, student2]
  const [currentImageIdx, setCurrentImageIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIdx(prev => (prev + 1) % IMAGES.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const filterParam = searchParams.get('filter')
    if (filterParam && filters.some(f => f.value === filterParam)) {
      setActiveFilter(filterParam)
    }
  }, [searchParams])

  // Scroll active filter into view
  useEffect(() => {
    if (activeFilter && buttonRefs.current[activeFilter] && containerRef.current) {
      const container = containerRef.current
      const button = buttonRefs.current[activeFilter]
      
      const containerRect = container.getBoundingClientRect()
      const buttonRect = button.getBoundingClientRect()

      if (buttonRect.left < containerRect.left || buttonRect.right > containerRect.right) {
        // Scroll so button is roughly in the center
        container.scrollTo({
          left: button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2,
          behavior: 'smooth'
        })
      }
    }
  }, [activeFilter])

  const handleFilterChange = (filterVal) => {
    setActiveFilter(filterVal)
    setSearchParams({ filter: filterVal })
  }

  const activeLabel = filters.find(f => f.value === activeFilter)?.label || 'Grade 3-5'

  const visibleCourses = courses.filter(c =>
    c.category.includes(activeFilter) || c.category.includes('all')
  )

  return (
    <div className="page-transition">
      <SEO 
        title="Explore Courses & Programs | DHIYONI Tutorials"
        description="Browse our comprehensive list of online tuition programs, foundation courses, coding classes, and extracurricular activities for students of all grades."
        keywords="online courses, CBSE tuition, ICSE tuition, IIT foundation, NEET coaching, online coding classes, vedic math, Dhiyoni Tutorials"
        canonicalPath="/courses"
      />
      <main className="max-w-container-max mx-auto px-4 md:px-lg py-md md:py-lg">

        {/* ── HERO SECTION ───────────────────────────────────── */}
        <section className="relative overflow-hidden bg-[#004e63] rounded-3xl mb-[10px] text-white">
          <div className="max-w-container-max mx-auto px-4 md:px-lg flex flex-col lg:flex-row items-center justify-between gap-4 lg:gap-lg lg:min-h-[460px] relative">
            {/* Left Content */}
            <div className="lg:w-7/12 py-4 md:py-6 lg:py-12 z-10 flex flex-col justify-center">
              <h1 className="font-montserrat font-bold text-display-lg-mobile md:text-display-lg text-white mb-2 lg:mb-6 leading-tight">
                Master Your Future
              </h1>
              <p className="font-inter text-body-md md:text-body-lg text-white/90 mb-3 lg:mb-10 max-w-xl leading-relaxed">
                Expert-led courses designed for academic excellence. From foundational primary education to competitive IIT &amp; NEET coaching, DHIYONI empowers every learner.
              </p>
              
              {/* Feature Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6 pt-4 lg:pt-6 border-t border-white/10">
                {/* Feature 1 */}
                <div className="flex flex-col">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white mb-3 border border-white/20 shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[24px]">menu_book</span>
                  </div>
                  <h4 className="font-montserrat font-bold text-body-md text-white mb-1">Concept-Focused Learning</h4>
                  <p className="font-inter text-body-sm text-white/80">Strong foundation with clear concepts.</p>
                </div>
                {/* Feature 2 */}
                <div className="flex flex-col">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white mb-3 border border-white/20 shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[24px]">track_changes</span>
                  </div>
                  <h4 className="font-montserrat font-bold text-body-md text-white mb-1">Expert Guidance</h4>
                  <p className="font-inter text-body-sm text-white/80">Learn from qualified and experienced educators.</p>
                </div>
                {/* Feature 3 */}
                <div className="flex flex-col">
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white mb-3 border border-white/20 shrink-0 shadow-sm">
                    <span className="material-symbols-outlined text-[24px]">school</span>
                  </div>
                  <h4 className="font-montserrat font-bold text-body-md text-white mb-1">Academic Excellence</h4>
                  <p className="font-inter text-body-sm text-white/80">Structured courses that deliver results.</p>
                </div>
              </div>
            </div>

            {/* Right Image (Hidden on Mobile/Tab) */}
            <div className="hidden lg:flex w-full lg:w-[75%] lg:absolute lg:right-[-140px] lg:bottom-0 lg:h-full justify-end items-end pt-0 relative">
              {/* Vector Sketches behind the student */}
              <div className="absolute inset-0 -z-10 hidden lg:block overflow-hidden pointer-events-none">
                {/* Light bulb */}
                <span className="material-symbols-outlined absolute top-[15%] left-[10%] text-white/10 text-[64px] -rotate-12 select-none" style={{ fontVariationSettings: '"wght" 200' }}>lightbulb</span>
                
                {/* Graduation Cap */}
                <span className="material-symbols-outlined absolute top-[20%] right-[10%] text-white/10 text-[72px] rotate-12 select-none" style={{ fontVariationSettings: '"wght" 200' }}>school</span>
                
                {/* Microscope */}
                <span className="material-symbols-outlined absolute top-[50%] left-[5%] text-white/10 text-[56px] select-none" style={{ fontVariationSettings: '"wght" 200' }}>biotech</span>
                
                {/* Open Book */}
                <span className="material-symbols-outlined absolute top-[45%] right-[5%] text-white/10 text-[60px] -rotate-12 select-none" style={{ fontVariationSettings: '"wght" 200' }}>menu_book</span>
              </div>

              {/* Carousel Images with absolute cross-fade */}
              <div className="relative w-full h-[240px] md:h-[300px] lg:h-[102%] lg:max-h-[500px] flex justify-center lg:justify-end items-end shrink-0">
                {IMAGES.map((img, index) => (
                  <img
                    key={index}
                    alt="Master Your Future at DHIYONI Tutorials"
                    className={`absolute bottom-0 h-full w-auto object-contain object-bottom select-none pointer-events-none transition-opacity duration-1000 ease-in-out ${
                      currentImageIdx === index ? 'opacity-100 z-10' : 'opacity-0 z-0'
                    }`}
                    src={img}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── HORIZONTAL FILTER BAR ──────────────────────────── */}
        <div className="mb-md">
          <div className="flex flex-col gap-md">
            {/* Tab underline bar */}
            <div 
              ref={containerRef}
              className="block border-b border-outline-variant overflow-x-auto no-scrollbar scroll-smooth"
              style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
            >
              <div className="flex flex-nowrap w-max min-w-full" style={{ justifyContent: 'safe center' }}>
                {filters.map(f => (
                  <button
                    key={f.value}
                    ref={(el) => (buttonRefs.current[f.value] = el)}
                    onClick={() => handleFilterChange(f.value)}
                    className={`filter-btn px-4 md:px-lg py-sm md:py-md font-montserrat font-semibold text-headline-lg-mobile md:text-headline-md border-b-4 transition-all whitespace-nowrap shrink-0 ${
                      activeFilter === f.value
                        ? 'border-primary text-primary'
                        : 'border-transparent text-on-surface-variant hover:text-primary'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter label */}
            <div className="flex justify-between items-center px-sm">
              <p className="font-inter text-body-sm text-on-surface-variant">
                Showing all courses for{' '}
                <span className="font-bold text-primary">{activeLabel}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── COURSE GRID / CUSTOM LAYOUT ────────────────────── */}
        {activeFilter === 'grade-3-5' ? (
          <div className="flex flex-col gap-8 mb-md">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* Left Column: Comprehensive Primary Program Card */}
              <div className="lg:col-span-5 bg-white rounded-3xl p-6 md:p-8 border border-outline-variant teal-shadow flex flex-col justify-between">
                <div>
                  {/* Header */}
                  <div className="flex justify-between items-center mb-4 pb-4 border-b border-surface-variant">
                    <span className="font-montserrat text-label-md font-bold text-primary uppercase tracking-wider">
                      PRIMARY (GRADES 3–5)
                    </span>
                    <span className="material-symbols-outlined text-primary text-2xl">palette</span>
                  </div>

                  {/* Content */}
                  <div className="mb-6">
                    <span className="inline-block bg-[#e8f0fe] text-primary px-3 py-1 rounded-lg font-montserrat text-label-md font-semibold mb-4">
                      All Subjects
                    </span>
                    <h3 className="font-montserrat font-bold text-headline-lg text-primary mb-4 leading-tight">
                      Comprehensive Primary <br className="hidden sm:block" /> Program (Grades 3–5)
                    </h3>
                    <p className="font-inter text-body-md text-on-surface-variant mb-6 leading-relaxed">
                      A complete learning solution to build strong concepts, improve academic skills, and boost confidence in every subject.
                    </p>
                  </div>

                  {/* Tags */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <span className="bg-[#e6f4ea] text-[#137333] px-2 py-2.5 rounded-lg text-xs font-montserrat font-semibold text-center flex items-center justify-center">
                      Concept-Based Learning
                    </span>
                    <span className="bg-[#fcefe9] text-[#ae3100] px-2 py-2.5 rounded-lg text-xs font-montserrat font-semibold text-center flex items-center justify-center">
                      Individual Attention
                    </span>
                    <span className="bg-[#e0f7fc] text-[#00546c] px-2 py-2.5 rounded-lg text-xs font-montserrat font-semibold text-center flex items-center justify-center">
                      Interactive Learning
                    </span>
                    <span className="bg-[#e8f0fe] text-[#1a73e8] px-2 py-2.5 rounded-lg text-xs font-montserrat font-semibold text-center flex items-center justify-center">
                      Expert Excellence
                    </span>
                  </div>
                </div>

                {/* Button */}
                <Link
                  to="/parent-signup"
                  className="w-[85%] mx-auto flex items-center justify-center gap-sm bg-[#f05a28] text-white font-bold py-3 px-6 rounded-xl shadow-md hover:bg-[#d84a1b] transition-all group/btn"
                >
                  <span>Enroll Now</span>
                </Link>
              </div>

              {/* Right Column: What Makes Our Grade 3-5 Program Special */}
              <div className="lg:col-span-7 bg-[#f4f7f9] rounded-3xl p-6 md:p-8 border border-outline-variant teal-shadow flex flex-col justify-between">
                <div>
                  <h3 className="font-montserrat font-bold text-headline-lg text-primary mb-8">
                    What Makes Our Grade 3–5 Program Special?
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Left Column of features */}
                    <div className="flex flex-col gap-6">
                      {[
                        { icon: 'account_circle', text: 'Personalized tuition for students from 3rd to 5th class' },
                        { icon: 'lightbulb', text: 'Strong focus on concept-based learning' },
                        { icon: 'assignment', text: 'Daily homework support and guidance' },
                        { icon: 'fact_check', text: 'Special exam preparation and revision sessions' },
                      ].map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-white border border-outline-variant/30 flex items-center justify-center shadow-sm shrink-0">
                            <span className="material-symbols-outlined text-[#00546c] text-[24px]">{feat.icon}</span>
                          </div>
                          <span className="font-inter text-body-md text-on-surface-variant font-medium">{feat.text}</span>
                        </div>
                      ))}
                    </div>

                    {/* Right Column of features */}
                    <div className="flex flex-col gap-6">
                      {[
                        { icon: 'menu_book', text: 'Easy understanding of every lesson and subject' },
                        { icon: 'trending_up', text: 'Improvement in reading, writing, and problem-solving skills' },
                        { icon: 'forum', text: 'Interactive and student-friendly teaching methods' },
                        { icon: 'star', text: 'Individual attention to build confidence and academic performance' },
                        { icon: 'sentiment_satisfied', text: 'Simple, enjoyable, and effective learning environment' },
                      ].map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-white border border-outline-variant/30 flex items-center justify-center shadow-sm shrink-0">
                            <span className="material-symbols-outlined text-[#00546c] text-[24px]">{feat.icon}</span>
                          </div>
                          <span className="font-inter text-body-md text-on-surface-variant font-medium">{feat.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Assessment CTA Horizontal Card */}
            <div className="bg-surface-container-low rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-outline-variant teal-shadow teal-shadow-hover transition-all w-full">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 rounded-full bg-[#00546c]/10 border border-[#00546c]/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-primary text-3xl">rocket_launch</span>
                </div>
                <div>
                  <h3 className="font-montserrat font-semibold text-xl md:text-2xl text-primary mb-1">Not sure where to start?</h3>
                  <p className="font-inter text-body-md text-on-surface-variant">
                    Take our comprehensive assessment test to find the perfect course for your child's level and goals.
                  </p>
                </div>
              </div>
              
              <a
                href={`https://wa.me/917901034846?text=${encodeURIComponent(
                  "Hi, I would like to enroll in the Grade 3–5 Program at DHIYONI Tutorials. Could you please help me with the details, such as the subjects covered, class schedule, teaching methodology, fees, and the enrollment process?\n\nThank you."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold px-8 py-4 rounded-xl hover:scale-105 transition-all shadow-md flex items-center justify-center gap-2 text-white shrink-0"
                style={{ backgroundColor: '#25D366' }}
              >
                <span className="material-symbols-outlined text-[24px]">chat</span>
                <span>Chat Now</span>
              </a>
            </div>

          </div>
        ) : activeFilter === 'foundation' ? (
          <div className="flex flex-col gap-8 mb-md">
            {/* IIT/NEET Foundation Grid (3 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-xl items-stretch">
              {visibleCourses.map((course, i) => (
                <CourseCard key={i} course={course} />
              ))}
            </div>

            {/* Assessment CTA Horizontal Card (with green Chat icon circle) */}
            <div className="bg-[#f4f7f6] rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-outline-variant teal-shadow teal-shadow-hover transition-all w-full">
              <div className="flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
                <div className="w-16 h-16 rounded-full bg-[#e6f4ea] border border-[#137333]/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[#137333] text-3xl">chat</span>
                </div>
                <div>
                  <h3 className="font-montserrat font-semibold text-xl md:text-2xl text-primary mb-1">Not sure where to start?</h3>
                  <p className="font-inter text-body-md text-on-surface-variant">
                    Take our comprehensive assessment test to find the perfect course for your level and goals.
                  </p>
                </div>
              </div>
              
              <a
                href={`https://wa.me/917901034846?text=${encodeURIComponent(
                  "Hi, I would like to enroll in the IIT/NEET Foundation Program at DHIYONI Tutorials. Could you please help me with the details, such as the subjects covered, class schedule, teaching methodology, fees, and the enrollment process?\n\nThank you."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold px-8 py-4 rounded-xl hover:scale-105 transition-all shadow-md flex items-center justify-center gap-2 text-white shrink-0"
                style={{ backgroundColor: '#25D366' }}
              >
                <span className="material-symbols-outlined text-[24px]">chat</span>
                <span>Chat Now</span>
              </a>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-xl mb-md">
            {visibleCourses.map((course, i) => (
              <CourseCard key={i} course={course} />
            ))}

            {/* Assessment CTA Card — always visible */}
            <div
              className="course-card bg-surface-container-low rounded-xl p-6 md:p-8 flex flex-col items-center justify-center text-center h-full border border-dashed border-outline-variant teal-shadow teal-shadow-hover transition-all"
              onMouseEnter={e => { if (window.innerWidth > 768) e.currentTarget.style.transform = 'translateY(-4px)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <span className="material-symbols-outlined text-secondary text-6xl mb-md">rocket_launch</span>
              <h3 className="font-montserrat font-semibold text-2xl text-primary mb-sm">Not sure where to start?</h3>
              <p className="font-inter text-body-md text-on-surface-variant mb-lg">
                Take our comprehensive assessment test to find the perfect course for your level.
              </p>
              <a
                href={`https://wa.me/917901034846?text=${encodeURIComponent(
                  activeFilter === 'coaching'
                    ? "Hi, I would like to enroll in the IIT/NEET Coaching Program at DHIYONI Tutorials. Could you please help me with the details, such as the subjects covered, class schedule, teaching methodology, fees, and the enrollment process?\n\nThank you."
                    : activeFilter === 'languages'
                    ? "Hi, I would like to enroll in the Languages Program at DHIYONI Tutorials. Could you please help me with the details, such as the subjects covered, class schedule, teaching methodology, fees, and the enrollment process?\n\nThank you."
                    : activeFilter === 'extracurriculars'
                    ? "Hi, I would like to enroll in the Extracurriculars Program at DHIYONI Tutorials. Could you please help me with the details, such as the subjects covered, class schedule, teaching methodology, fees, and the enrollment process?\n\nThank you."
                    : "Hi, I would like to enroll in the Grade 6–12 Program at DHIYONI Tutorials. Could you please help me with the details, such as the subjects covered, class schedule, teaching methodology, fees, and the enrollment process?\n\nThank you."
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold px-lg py-sm rounded-full hover:scale-105 transition-transform shadow-lg flex items-center justify-center gap-2 mx-auto text-white"
                style={{ backgroundColor: '#25D366' }}
              >
                <span className="material-symbols-outlined text-[24px]">chat</span>
                <span>Chat Now</span>
              </a>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
