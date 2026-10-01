import React, { useState, useEffect } from 'react'
import SEO from '../components/SEO'

export default function Gallery() {
  const [galleryImages, setGalleryImages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gallery')
      .then(res => res.json())
      .then(data => {
        setGalleryImages(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load gallery', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="page-transition">
      <SEO title="Gallery | Dhiyoni Tutorials" description="Take a look at the learning environment and success stories at Dhiyoni Tutorials." />
      
      {/* Header */}
      <section className="bg-surface-container-low py-12 md:py-16 border-b border-outline-variant">
        <div className="section-container text-center max-w-3xl mx-auto">
          <h1 className="text-[50px] leading-tight font-montserrat font-bold text-primary mb-4">Our Gallery</h1>
          <p className="text-body-lg text-on-surface-variant font-inter">
            A glimpse into our engaging learning environments, interactive sessions, and student successes.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="py-12 md:py-16">
        <div className="section-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {loading ? (
              <div className="col-span-full text-center py-10">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-on-surface-variant font-medium">Loading gallery...</p>
              </div>
            ) : galleryImages.length === 0 ? (
              <div className="col-span-full text-center py-10">
                <p className="text-on-surface-variant font-medium">No images added to the gallery yet.</p>
              </div>
            ) : (
              galleryImages.map((img) => (
                <div key={img._id} className="group relative rounded-xl overflow-hidden aspect-square bg-surface-container border border-outline-variant shadow-sm hover:shadow-md transition-all">
                  <img 
                    src={img.url} 
                    alt={img.alt} 
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://placehold.co/800x800/e2e8f0/64748b?text=Image+Unavailable';
                    }}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                    <div className="p-4 w-full">
                      <span className="text-white font-montserrat font-semibold text-sm block">{img.category}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
