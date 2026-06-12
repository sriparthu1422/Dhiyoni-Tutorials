import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import './index.css'
import App from './App.jsx'

// Intercept all API fetches to point to the backend URL in production
const originalFetch = window.fetch;
window.fetch = function (url, options) {
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    url = `${apiBase}${url}`;
  }
  return originalFetch(url, options);
};


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
)
