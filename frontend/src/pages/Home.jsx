import { useState } from 'react'
import { Link } from 'react-router-dom'
import SEO from '../components/SEO'
const grade3to5Img = "https://res.cloudinary.com/uzj6j4kh/image/upload/v1790882721/Grades_3-5.png";
const grade6to12Img = 'https://res.cloudinary.com/uzj6j4kh/image/upload/v1790883725/Grades_6-12.png';
const iit1Img = 'https://res.cloudinary.com/uzj6j4kh/image/upload/v1790884417/IIT-2.png'
const iit2Img = 'https://res.cloudinary.com/uzj6j4kh/image/upload/v1790884417/IIT-2.png'
const languageImg = 'https://res.cloudinary.com/uzj6j4kh/image/upload/v1790884457/Language.png'
const extraImg = 'https://res.cloudinary.com/uzj6j4kh/image/upload/v1790884690/extra-Cg8JGDFC.png'

export default function Home() {
  const homeSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://www.dhiyonitutorials.com/#website",
        "url": "https://www.dhiyonitutorials.com/",
        "name": "Dhiyoni Tutorials",
        "description": "Online and Offline Tuitions for School Students",
        "publisher": {
          "@id": "https://www.dhiyonitutorials.com/#organization"
        }
      },
      {
        "@type": "EducationalOrganization",
        "@id": "https://www.dhiyonitutorials.com/#organization",
        "name": "Dhiyoni Tutorials",
        "url": "https://www.dhiyonitutorials.com/",
        "logo": "https://www.dhiyonitutorials.com/favicon.png",
        "description": "Dhiyoni Tutorials provides online and offline tuitions for school students in Grades 3 to 12 across CBSE, ICSE, and State Boards.",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "Flat no: 204, 3rd floor, Sigma Sarovar, Bandam kommu, Ameenpur Road",
          "addressLocality": "Hyderabad",
          "postalCode": "502032",
          "addressRegion": "Telangana",
          "addressCountry": "IN"
        },
        "sameAs": [
          "https://www.instagram.com/dhiyonitutorials",
          "https://www.facebook.com/profile.php?id=61580085693158",
          "https://www.youtube.com/@DhiyoniTutorials",
          "https://www.linkedin.com/company/132004109"
        ]
      }
    ]
  };

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
  const [feedbackSuccess, setFeedbackSuccess] = useState(false)

  /* Retained for Gallery Sneak Peek when re-enabled:
  const [galleryPreview, setGalleryPreview] = useState([])
  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setGalleryPreview(data.slice(0, 4));
        }
      })
      .catch(err => console.error('Failed to load gallery preview:', err));
  }, []);
  */

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
      setFeedbackSuccess(true)
      setFeedbackData({
        name: '',
        userType: '',
        email: '',
        contactNumber: '',
        message: '',
        rating: 0,
      })
      // Clear success message after 5 seconds
      setTimeout(() => {
        setFeedbackSuccess(false)
      }, 5000)
    } catch (err) {
      setFeedbackError(err.message)
    } finally {
      setFeedbackLoading(false)
    }
  }

  return (
    <div className="page-transition">
      <SEO 
        title="Online & Offline Tuitions | Dhiyoni Tutorials"
        description="Dhiyoni Tutorials offers online and offline tuitions for school students. Explore personalized academic support, available subjects and classes. Enquire today."
        canonicalPath="/"
        schema={homeSchema}
      />

      {/* ── HERO SECTION ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-surface py-lg">
        <div className="max-w-container-max mx-auto px-4 md:px-8 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-lg items-center">

          {/* Left: Text — order-2 on mobile, order-1 on desktop */}
          <div className="z-10 order-2 lg:order-1 mt-8 lg:mt-0 text-center lg:text-left">
            <span className="inline-block bg-tertiary-fixed text-primary px-sm py-xs rounded-full font-montserrat text-label-md mb-md">
              ONLINE &amp; OFFLINE TUITIONS
            </span>
            <h1 className="font-montserrat font-bold text-display-lg-mobile lg:text-display-lg text-primary mb-md leading-tight">
              Online &amp; Offline Tuitions <br className="hidden sm:block" />{' '}
              <span style={{ color: 'rgb(240, 90, 40)' }}>for School Students</span>
            </h1>
            <p className="font-inter text-body-md lg:text-body-lg text-on-surface-variant mb-lg max-w-xl mx-auto lg:mx-0">
              Dhiyoni Tutorials provides online and offline tuitions for school students through personalized academic support, live online learning sessions, and in-person tuition classes. Our teaching approach focuses on strengthening subject knowledge, improving conceptual understanding, and helping students build confidence in their studies.
            </p>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-md mb-lg justify-center lg:justify-start">
              <div className="flex items-center gap-sm">
                <div className="bg-tertiary-fixed text-primary p-xs rounded-full flex items-center justify-center w-8 h-8">
                  <span className="material-symbols-outlined text-[18px]">school</span>
                </div>
                <span className="font-montserrat text-label-md text-primary uppercase tracking-wide text-left">
                  Expert Educators<br />
                  <span className="font-inter text-body-sm normal-case text-black">Top 1% tutors</span>
                </span>
              </div>
              <div className="flex items-center gap-sm ml-10 sm:ml-0">
                <div className="bg-secondary-fixed text-secondary p-xs rounded-full flex items-center justify-center w-8 h-8">
                  <span className="material-symbols-outlined text-[18px]">psychology</span>
                </div>
                <span className="font-montserrat text-label-md text-secondary uppercase tracking-wide text-left">
                  Personalized Learning<br />
                  <span className="font-inter text-body-sm normal-case text-black">For every student</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Image — order-1 on mobile, order-2 on desktop */}
          <div className="relative order-1 lg:order-2 max-w-[500px] mx-auto lg:ml-auto lg:mr-0 w-full">
            <div className="relative z-10 rounded-3xl overflow-hidden teal-shadow">
              <img
                alt="Professional educator conducting online and offline tuition class"
                className="w-full aspect-square object-cover"
                loading="lazy"
                src="https://res.cloudinary.com/uzj6j4kh/image/upload/v1790884185/A_professional_educator_teaching_with_a_whiteboard_and_laptop.jpg"
              />
            </div>
            {/* Decorative blobs */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-secondary-fixed rounded-full -z-10 opacity-50 blur-xl" />
            <div className="absolute -bottom-8 -left-8 w-48 h-48 bg-tertiary-fixed rounded-full -z-10 opacity-30 blur-2xl" />
            {/* Glass rating card */}
            <div className="absolute bottom-3 left-3 glass-card p-sm rounded-xl teal-shadow border border-white/50 z-20">
              <div className="flex items-center gap-md">
                <div className="bg-secondary p-sm rounded-lg text-white">
                  <span className="material-symbols-outlined">star</span>
                </div>
                <div>
                  <p className="font-montserrat font-bold text-primary">4.6/5 Rating</p>
                  <p className="font-montserrat text-label-md text-on-surface-variant">by 10,000+ Students</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── KEY FEATURES SECTION ─────────────────────────────── */}
      <section className="py-xl bg-surface-container-low">
        <div className="max-w-container-max mx-auto px-4 md:px-8 lg:px-12">
          <div className="text-center mb-xl">
            <h2 className="font-montserrat font-semibold text-headline-lg-mobile md:text-headline-lg text-primary mb-sm">
              Online &amp; Offline Tuition Solutions
            </h2>
            <p className="font-inter text-on-surface-variant text-body-md max-w-2xl mx-auto">
              We combine modern interactive digital learning with structured in-person guidance to provide comprehensive academic support for school students.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {/* Feature 1 */}
            <div className="bg-white p-lg rounded-xl teal-shadow hover:-translate-y-2 transition-all duration-300">
              <div className="w-12 h-12 bg-primary-fixed flex items-center justify-center rounded-lg mb-md">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: '"FILL" 1' }}>
                  video_chat
                </span>
              </div>
              <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">Online Tuition Classes</h3>
              <p className="font-inter text-on-surface-variant text-body-md">
                Interactive live online sessions connecting students with top educators across India. Accessible from any device with real-time whiteboards and recorded revision.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white p-lg rounded-xl teal-shadow hover:-translate-y-2 transition-all duration-300">
              <div className="w-12 h-12 bg-secondary-fixed flex items-center justify-center rounded-lg mb-md">
                <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: '"FILL" 1' }}>
                  school
                </span>
              </div>
              <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">Offline Tuition Classes</h3>
              <p className="font-inter text-on-surface-variant text-body-md">
                Structured in-person tuition classes providing focused classroom attention, disciplined study habits, and localized academic support for school curricula.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white p-lg rounded-xl teal-shadow hover:-translate-y-2 transition-all duration-300">
              <div className="w-12 h-12 bg-tertiary-fixed flex items-center justify-center rounded-lg mb-md">
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: '"FILL" 1' }}>
                  groups
                </span>
              </div>
              <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">Personalized Mentorship</h3>
              <p className="font-inter text-on-surface-variant text-body-md">
                Direct access to experienced educators for individual doubt clearing, real-time feedback, and customized academic guidance for every learner.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── COURSE OVERVIEW SECTION ──────────────────────────── */}
      <section className="py-lg bg-white">
        <div className="max-w-container-max mx-auto px-4 md:px-8 lg:px-12">
          <div className="flex flex-col md:flex-row justify-between items-end mb-lg gap-md">
            <div>
              <h2 className="font-montserrat font-semibold text-headline-lg-mobile md:text-headline-lg text-primary mb-sm">
                Academic Programs
              </h2>
              <p className="font-inter text-on-surface-variant text-body-md">
                Curriculums tailored to meet the specific requirements of every grade level.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter items-stretch">

            {/* Grade 3-5 Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-outline-variant teal-shadow flex flex-col">
              <div className="aspect-video overflow-hidden">
                <img
                  alt="Elementary Education Grades 3-5 students learning online"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                  src={grade3to5Img}
                />
              </div>
              <div className="p-md flex flex-col flex-grow">
                <span className="bg-tertiary-fixed text-primary px-sm py-xs rounded font-montserrat text-label-md mb-base inline-block self-start">
                  FOUNDATION &amp; ACADEMICS
                </span>
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">Grades 3-5</h3>
                <p className="font-inter text-on-surface-variant text-body-md mb-md">
                  Building strong basics through play-way and interactive methods.
                </p>
                <div className="mt-auto">
                  <Link
                    to="/courses?filter=grade-3-5"
                    aria-label="View Grades 3 to 5 tuition classes"
                    className="w-full flex items-center justify-center gap-sm bg-secondary text-white font-bold py-sm px-md rounded-lg shadow-sm hover:bg-secondary/90 transition-all group/btn"
                  >
                    <span>View More</span>
                    <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Grade 6-12 Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-outline-variant teal-shadow flex flex-col">
              <div className="aspect-video overflow-hidden">
                <img
                  alt="Secondary Education Grades 6-12 online tuition"
                  className="w-full h-full object-cover object-[center_80%] group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                  src={grade6to12Img}
                />
              </div>
              <div className="p-md flex flex-col flex-grow">
                <span className="bg-secondary-fixed text-secondary px-sm py-xs rounded font-montserrat text-label-md mb-base inline-block self-start">
                  CORE ACADEMICS
                </span>
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">Grades 6-12</h3>
                <p className="font-inter text-on-surface-variant text-body-md mb-md">
                  In-depth subject expertise for Board Exams and competitive Success
                </p>
                <div className="mt-auto">
                  <Link
                    to="/courses?filter=grade-6-10"
                    aria-label="View Grades 6 to 12 tuition classes"
                    className="w-full flex items-center justify-center gap-sm bg-secondary text-white font-bold py-sm px-md rounded-lg shadow-sm hover:bg-secondary/90 transition-all group/btn"
                  >
                    <span>View More</span>
                    <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* IIT/NEET Foundation Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-outline-variant teal-shadow flex flex-col">
              <div className="aspect-video overflow-hidden">
                <img
                  alt="IIT NEET Foundation Courses for high school students"
                  className="w-full h-full object-cover object-[center_30%] group-hover:scale-110 transition-transform duration-500"
                  src={iit1Img}
                />
              </div>
              <div className="p-md flex flex-col flex-grow">
                <span className="bg-primary-fixed text-primary px-sm py-xs rounded font-montserrat text-label-md mb-base inline-block self-start">
                  COMPETITIVE
                </span>
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">IIT/NEET Foundation</h3>
                <p className="font-inter text-on-surface-variant text-body-md mb-md">
                  Specialized coaching starting from Grade 6 onwards.
                </p>
                <div className="mt-auto">
                  <Link
                    to="/courses?filter=foundation"
                    aria-label="View IIT-JEE and NEET foundation tuition programs"
                    className="w-full flex items-center justify-center gap-sm bg-secondary text-white font-bold py-sm px-md rounded-lg shadow-sm hover:bg-secondary/90 transition-all group/btn"
                  >
                    <span>View More</span>
                    <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* IIT/NEET Coaching Card */}
            <div className="group relative overflow-hidden rounded-2xl border border-outline-variant teal-shadow flex flex-col">
              <div className="aspect-video overflow-hidden">
                <img
                  alt="IIT NEET Coaching and Engineering Entrance preparation"
                  className="w-full h-full object-cover object-[center_16%] group-hover:scale-110 transition-transform duration-500"
                  src={iit2Img}
                />
              </div>
              <div className="p-md flex flex-col flex-grow">
                <span className="bg-secondary-fixed text-secondary px-sm py-xs rounded font-montserrat text-label-md mb-base inline-block self-start">
                  COMPETITIVE
                </span>
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">IIT/NEET Coaching</h3>
                <p className="font-inter text-on-surface-variant text-body-md mb-md">
                  Intensive preparation for Grade 11-12 entrance exams.
                </p>
                <div className="mt-auto">
                  <Link
                    to="/courses?filter=coaching"
                    aria-label="View IIT-JEE and NEET entrance coaching tuition"
                    className="w-full flex items-center justify-center gap-sm bg-secondary text-white font-bold py-sm px-md rounded-lg shadow-sm hover:bg-secondary/90 transition-all group/btn"
                  >
                    <span>View More</span>
                    <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
            
            {/* Language Excellence Card — spans 2 columns on lg */}
            <div className="group relative overflow-hidden rounded-2xl border border-outline-variant teal-shadow flex flex-col">
              <div className="aspect-video overflow-hidden">
                <img
                  alt="Language Excellence and Communication Skills online classes"
                  className="w-full h-full object-cover object-[center_20%] group-hover:scale-110 transition-transform duration-500"
                  src={languageImg}
                />
              </div>
              <div className="p-md flex flex-col flex-grow">
                <span className="bg-secondary-fixed text-secondary px-sm py-xs rounded font-montserrat text-label-md mb-base inline-block self-start">
                  LINGUISTIC
                </span>
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">Language Excellence</h3>
                <p className="font-inter text-on-surface-variant text-body-md mb-md">
                  Comprehensive programs in English, French, Hindi, and Telugu. 
                </p>
                <div className="mt-auto">
                  <Link
                    to="/courses?filter=languages"
                    aria-label="View Language Excellence and communication tuition"
                    className="w-full flex items-center justify-center gap-sm bg-secondary text-white font-bold py-sm px-md rounded-lg shadow-sm hover:bg-secondary/90 transition-all group/btn"
                  >
                    <span>View More</span>
                    <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>

            {/* Language Excellence Card — spans 2 columns on lg */}
            <div className="group relative overflow-hidden rounded-2xl border border-outline-variant teal-shadow flex flex-col">
              <div className="aspect-video overflow-hidden">
                <img
                  alt="Extracurricular Activities Coding and Vedic Math"
                  className="w-full h-full object-cover object-[center_25%] group-hover:scale-110 transition-transform duration-500"
                  src={extraImg}
                />
              </div>
              <div className="p-md flex flex-col flex-grow">
                <span className="bg-secondary-fixed text-secondary px-sm py-xs rounded font-montserrat text-label-md mb-base inline-block self-start">
                  EXTRACURRICULAR
                </span>
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">Extracurriculars</h3>
                <p className="font-inter text-on-surface-variant text-body-md mb-md">
                  Encouraging creativity, leadership, and overall development beyond academics.  
                </p>
                <div className="mt-auto">
                  <Link
                    to="/courses?filter=extracurriculars"
                    aria-label="View Extracurricular tuition activities and Vedic Math"
                    className="w-full flex items-center justify-center gap-sm bg-secondary text-white font-bold py-sm px-md rounded-lg shadow-sm hover:bg-secondary/90 transition-all group/btn"
                  >
                    <span>View More</span>
                    <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </div>
            {/* <div className="lg:col-span-2 group relative overflow-hidden rounded-2xl border border-outline-variant teal-shadow flex flex-col p-md bg-white">
              <div className="mb-md">
                <span className="bg-primary-fixed text-primary px-sm py-xs rounded font-montserrat text-label-md mb-base inline-block">
                  LINGUISTIC
                </span>
                <h3 className="font-montserrat font-semibold text-headline-md text-primary mb-sm">Language Excellence</h3>
                <p className="font-inter text-on-surface-variant text-body-md">
                  Comprehensive programs in English, French, Hindi, and Telugu.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-md flex-grow mb-md">
                <div className="bg-surface-container-low p-md rounded-xl text-center flex flex-col items-center justify-center border border-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[32px] mb-xs">edit_note</span>
                  <h4 className="font-montserrat font-semibold text-headline-md text-primary">Telugu</h4>
                </div>
                <div className="bg-surface-container-low p-md rounded-xl text-center flex flex-col items-center justify-center border border-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[32px] mb-xs">menu_book</span>
                  <h4 className="font-montserrat font-semibold text-headline-md text-primary">Hindi</h4>
                </div>
                <div className="bg-surface-container-low p-md rounded-xl text-center flex flex-col items-center justify-center border border-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[32px] mb-xs">language</span>
                  <h4 className="font-montserrat font-semibold text-headline-md text-primary">English</h4>
                </div>
                <div className="bg-surface-container-low p-md rounded-xl text-center flex flex-col items-center justify-center border border-surface-variant">
                  <span className="material-symbols-outlined text-primary text-[32px] mb-xs">translate</span>
                  <h4 className="font-montserrat font-semibold text-headline-md text-primary">French</h4>
                </div>
              </div>
              <div className="mt-auto">
                <Link
                  to="/courses?filter=languages"
                  className="w-full flex items-center justify-center gap-sm bg-secondary text-white font-bold py-sm px-md rounded-lg shadow-sm hover:bg-secondary/90 transition-all group/btn"
                >
                  <span>View More</span>
                  <span className="material-symbols-outlined text-[20px] transition-transform group-hover/btn:translate-x-1">arrow_forward</span>
                </Link>
              </div>
            </div> */}

          </div>
        </div>
      </section>

      {/* ── BOARDS COVERAGE ──────────────────────────────────── */}
      <section className="py-xl bg-background overflow-hidden">
        <div className="max-w-container-max mx-auto px-4 md:px-8 lg:px-12">
          <div className="flex flex-col lg:flex-row items-center gap-lg">

            {/* Left */}
            <div className="lg:w-1/3 text-center lg:text-left">
              <h2 className="font-montserrat font-semibold text-headline-lg-mobile md:text-headline-lg text-primary mb-md">
                Comprehensive <br className="hidden lg:block" />Board Coverage
              </h2>
              <p className="font-inter text-body-md text-on-surface-variant mb-lg">
                We provide specialized coaching tailored to the unique requirements and assessment patterns of leading educational boards.
              </p>
              <a
                href="https://wa.me/917901034846?text=Hi!%20I%20want%20to%20know%20more%20about%20DHIYONI%20Tutorials."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary text-white px-lg py-md rounded-lg font-bold hover:bg-primary-container transition-all teal-shadow w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[20px]">chat</span>
                Know More
              </a>
            </div>

            {/* Right: 2×2 board grid */}
            <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-md w-full">
              {[
                { name: 'CBSE', desc: 'Aligned with the latest NCERT curriculum and competitive exam mindset.' },
                { name: 'ICSE', desc: 'Strong foundation with concept clarity and application-based learning.' },
                { name: 'State Boards', desc: 'Local curriculum with focused preparation for state-level academic standards.' },
                { name: 'Cambridge', desc: 'International curriculum expertise for IGCSE and A-Level success.' },
              ].map(({ name, desc }) => (
                <div key={name} className="p-md bg-surface-container rounded-xl flex items-start gap-md">
                  <div className="text-secondary shrink-0">
                    <span className="material-symbols-outlined text-[32px]">verified_user</span>
                  </div>
                  <div>
                    <h5 className="font-montserrat font-semibold text-headline-md text-on-surface">{name}</h5>
                    <p className="font-inter text-body-sm text-on-surface-variant">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── GALLERY SNEAK PEEK ───────────────────────────────
      <section className="py-xl bg-white">
        <div className="max-w-container-max mx-auto px-4 md:px-8 lg:px-12 text-center">
          <h2 className="font-montserrat font-semibold text-headline-lg-mobile md:text-headline-lg text-primary mb-sm">
            Inside DHIYONI
          </h2>
          <p className="font-inter text-on-surface-variant text-body-md max-w-2xl mx-auto mb-12">
            A glimpse into our engaging learning environments and student success stories.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            {galleryPreview.length > 0 ? (
              galleryPreview.map((img) => (
                <div key={img._id} className="rounded-xl overflow-hidden aspect-[4/3] teal-shadow group relative">
                  <img 
                    src={img.url} 
                    alt={img.alt || "Gallery preview"} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://placehold.co/800x600/e2e8f0/64748b?text=Image+Unavailable';
                    }}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded text-[10px] text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    {img.category}
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-4 py-8 text-on-surface-variant text-sm font-medium">
                Gallery preview is empty. Add images from the admin panel.
              </div>
            )}
          </div>

          <Link
            to="/gallery"
            className="inline-flex items-center gap-2 font-bold px-8 py-3 border-2 border-primary text-primary rounded-lg hover:bg-primary hover:text-white transition-colors duration-300 shadow-sm"
          >
            <span>View Full Gallery</span>
            <span className="material-symbols-outlined text-[20px]">photo_library</span>
          </Link>
        </div>
      </section> */}

      {/* ── FEEDBACK SECTION ── */}
      <section className="bg-surface-container-low py-16 relative overflow-hidden">
        <div className="section-container">
          <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-outline-variant teal-shadow relative overflow-hidden">
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
                    placeholder="Your Name"
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
                    placeholder="you@example.com"
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
                  
                  {/* Inline Success Message */}
                  {feedbackSuccess && (
                    <div className="mt-6 w-full max-w-md bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-5 text-center animate-fade-in-up shadow-sm">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-[24px] text-emerald-600">check_circle</span>
                        <h4 className="font-montserrat font-bold text-lg">🎉 Feedback Submitted Successfully!</h4>
                      </div>
                      <p className="font-inter text-body-sm mb-2">
                        Thank you for sharing your feedback with us.
                      </p>
                      <p className="font-inter text-body-sm">
                        Your feedback is very important and helps us improve our services.
                      </p>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
