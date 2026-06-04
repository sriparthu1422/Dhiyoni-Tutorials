import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Admin Login | DHIYONI Tutorials';
    // Redirect if already logged in
    const token = localStorage.getItem('dhiyoni_admin_token');
    if (token) {
      navigate('/admin');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Save token & user details
      localStorage.setItem('dhiyoni_admin_token', data.token);
      localStorage.setItem('dhiyoni_admin_user', JSON.stringify({
        username: data.username,
        email: data.email,
        role: data.role
      }));

      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-inter">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <img
          src={logo}
          alt="DHIYONI Tutorials Logo"
          className="h-20 w-auto object-contain mb-6"
        />
        <h2 className="text-center text-3xl font-montserrat font-bold text-primary">
          Admin Portal
        </h2>
        <p className="mt-2 text-center text-body-sm text-on-surface-variant">
          Access the dashboard to manage submissions and profiles
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-teal rounded-3xl border border-outline-variant/30 sm:px-10">
          {error && (
            <div className="mb-6 p-4 bg-error-container border border-error/20 rounded-xl text-error text-body-sm flex items-start gap-2">
              <span className="material-symbols-outlined shrink-0 text-[20px]">error</span>
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-xs">
              <label htmlFor="email" className="font-inter text-body-sm font-bold text-on-surface block">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                  mail
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dhiyoni.com"
                  className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl py-3.5 pl-12 pr-4 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-inter text-body-md"
                />
              </div>
            </div>

            <div className="space-y-xs">
              <label htmlFor="password" className="font-inter text-body-sm font-bold text-on-surface block">
                Password
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">
                  lock
                </span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#F9F9F9] border border-outline-variant rounded-xl py-3.5 pl-12 pr-12 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all font-inter text-body-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors focus:outline-none"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-white py-3.5 px-4 rounded-xl font-montserrat font-bold text-body-md hover:bg-primary-container active:scale-95 transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-[20px]">
                      progress_activity
                    </span>
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined text-[20px]">login</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
