import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

export default function SEO({ 
  title, 
  description, 
  keywords, 
  canonicalPath,
  canonicalUrl,
  canonical,
  image = 'https://www.dhiyonitutorials.com/og-image.png',
  schema 
}) {
  const location = useLocation();
  const siteUrl = 'https://www.dhiyonitutorials.com';

  // Support canonicalPath, canonicalUrl, canonical, or auto-detect from active router pathname
  const rawPath = canonicalPath ?? canonicalUrl ?? canonical ?? location.pathname ?? '';

  let fullCanonicalUrl = `${siteUrl}/`;

  if (typeof rawPath === 'string' && /^https?:\/\//i.test(rawPath)) {
    // If an absolute URL was provided, normalize to the canonical siteUrl domain and path
    try {
      const parsed = new URL(rawPath);
      fullCanonicalUrl = `${siteUrl}${parsed.pathname === '/' ? '/' : parsed.pathname.replace(/\/+$/, '')}`;
    } catch {
      fullCanonicalUrl = rawPath;
    }
  } else if (typeof rawPath === 'string') {
    // Strip query parameters and hash fragments
    const clean = rawPath.split('?')[0].split('#')[0].trim();
    if (!clean || clean === '/') {
      fullCanonicalUrl = `${siteUrl}/`;
    } else {
      const normalizedPath = clean.startsWith('/') ? clean : `/${clean}`;
      // Remove trailing slash for subpaths to ensure canonical consistency
      fullCanonicalUrl = `${siteUrl}${normalizedPath.replace(/\/+$/, '')}`;
    }
  }

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      {title && <title>{title}</title>}
      {title && <meta name="title" content={title} />}
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}

      {/* Canonical Link */}
      <link rel="canonical" href={fullCanonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={fullCanonicalUrl} />
      {title && <meta property="og:title" content={title} />}
      {description && <meta property="og:description" content={description} />}
      {image && <meta property="og:image" content={image} />}

      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={fullCanonicalUrl} />
      {title && <meta property="twitter:title" content={title} />}
      {description && <meta property="twitter:description" content={description} />}
      {image && <meta property="twitter:image" content={image} />}

      {/* JSON-LD Schema */}
      {schema && (
        <script type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      )}
    </Helmet>
  );
}

