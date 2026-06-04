import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import About from './pages/About'
import Courses from './pages/Courses'
import Tutors from './pages/Tutors'
import Contact from './pages/Contact'
import ParentSignUp from './pages/ParentSignUp'
import TutorSignUp from './pages/TutorSignUp'
import ExitIntentModal from './components/ExitIntentModal'
import AdminLogin from './pages/AdminLogin'
import AdminLayout from './components/AdminLayout'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [pathname])
  return null
}

function Layout() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <main className="pt-[88px] md:pt-[104px]">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/tutors" element={<Tutors />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/parent-signup" element={<ParentSignUp />} />
          <Route path="/tutor-signup" element={<TutorSignUp />} />
        </Routes>
      </main>
      <Footer />
      <ExitIntentModal />
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Admin Pages (Standalone layouts) */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminLayout />} />

        {/* Public Website (Standard layout with Navbar/Footer) */}
        <Route path="/*" element={<Layout />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
