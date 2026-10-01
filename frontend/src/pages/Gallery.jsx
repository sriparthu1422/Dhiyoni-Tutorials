import React from 'react'
import SEO from '../components/SEO'

const galleryImages = [
  { id: 1, src: "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=800", alt: "Students in a modern classroom", category: "Classroom" },
  { id: 2, src: "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=800", alt: "Teacher assisting a student", category: "Mentorship" },
  { id: 3, src: "https://images.unsplash.com/photo-1516321497487-e288fb19713f?q=80&w=800", alt: "Online learning on laptop", category: "Online Classes" },
  { id: 4, src: "https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800", alt: "Group study session", category: "Collaboration" },
  { id: 5, src: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800", alt: "Student writing in notebook", category: "Focus" },
  { id: 6, src: "https://images.unsplash.com/photo-1427504494785-319ce8322641?q=80&w=800", alt: "University campus", category: "Campus" },
  { id: 7, src: "https://images.unsplash.com/photo-1532012197267-da84d127e765?q=80&w=800", alt: "Library books", category: "Resources" },
  { id: 8, src: "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=800", alt: "Student raising hand", category: "Interaction" }
]

export default function Gallery() {
  return (
    <div className="page-transition">
      <SEO title="Gallery | Dhiyoni Tutorials" description="Take a look at the learning environment and success stories at Dhiyoni Tutorials." />
      
      {/* Header */}
      <section className="bg-surface-container-low py-16 md:py-24 border-b border-outline-variant">
        <div className="section-container text-center max-w-3xl mx-auto">
          <h1 className="text-display-md font-montserrat font-bold text-primary mb-4">Our Gallery</h1>
          <p className="text-body-lg text-on-surface-variant font-inter">
            A glimpse into our engaging learning environments, interactive sessions, and student successes.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="py-16 md:py-24">
        <div className="section-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {galleryImages.map((img) => (
              <div key={img.id} className="group relative rounded-xl overflow-hidden aspect-square bg-surface-container border border-outline-variant shadow-sm hover:shadow-md transition-all">
                <img 
                  src={img.src} 
                  alt={img.alt} 
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-4 w-full">
                    <span className="text-white font-montserrat font-semibold text-sm block">{img.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
