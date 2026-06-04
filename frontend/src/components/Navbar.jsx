import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import logo from '../assets/logo.png'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/courses', label: 'Courses' },
  // { to: '/tutors', label: 'Tutors' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 bg-surface-container-low transition-shadow duration-300 ${
        scrolled ? 'shadow-teal-hover' : 'shadow-teal'
      }`}
    >
      <nav className="section-container flex justify-between items-center py-1">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src={logo}
            alt="DHIYONI Tutorials"
            className="h-20 md:h-24 w-auto object-contain"
          />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex gap-8 items-center">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`font-inter font-medium text-body-md transition-colors duration-200 ${
                isActive(to)
                  ? 'text-secondary font-bold border-b-2 border-secondary pb-0.5'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="flex gap-3 items-center">
          <Link
            to="/tutor-signup"
            className={`hidden lg:inline-block font-bold px-md py-xs border-2 rounded-lg transition-all text-sm ${
              isActive('/tutor-signup')
                ? 'bg-primary text-white border-primary shadow-teal'
                : 'text-primary border-primary hover:bg-surface-container-highest'
            }`}
          >
            Tutor Sign Up
          </Link>
          <Link
            to="/parent-signup"
            className={`hidden lg:inline-block font-bold px-md py-xs rounded-lg shadow-teal hover:opacity-90 active:scale-95 transition-all text-sm whitespace-nowrap ${
              isActive('/parent-signup')
                ? 'bg-primary text-white border-2 border-primary'
                : 'bg-secondary-container text-on-secondary-container border-2 border-transparent'
            }`}
          >
            <span className="hidden lg:inline">Student/Parent </span>Sign Up
          </Link>
          <button
            className="lg:hidden text-primary p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-outlined text-[28px]">
              {mobileOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden bg-surface-container-low border-t border-outline-variant overflow-hidden transition-all duration-300 ${
          mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="flex flex-col px-4 py-4 space-y-3 shadow-md">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMobileOpen(false)}
              className={`font-medium text-body-md block py-1 transition-colors ${
                isActive(to) ? 'text-secondary font-bold' : 'text-on-surface-variant'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/tutor-signup"
            onClick={() => setMobileOpen(false)}
            className={`font-bold py-2 border-2 rounded-lg text-center block mt-2 ${
              isActive('/tutor-signup')
                ? 'bg-primary text-white border-primary'
                : 'text-primary border-primary'
            }`}
          >
            Tutor Sign Up
          </Link>
          <Link
            to="/parent-signup"
            onClick={() => setMobileOpen(false)}
            className={`font-bold py-2 rounded-lg text-center block ${
              isActive('/parent-signup')
                ? 'bg-primary text-white'
                : 'bg-secondary-container text-on-secondary-container'
            }`}
          >
            Parent Sign Up
          </Link>
        </div>
      </div>
    </header>
  )
}
