import mongoose from 'mongoose';

const gallerySchema = new mongoose.Schema({
  url: {
    type: String,
    required: [true, 'Image URL is required'],
  },
  alt: {
    type: String,
    default: 'Gallery Image'
  },
  category: {
    type: String,
    default: 'General'
  }
}, {
  timestamps: true
});

const Gallery = mongoose.model('Gallery', gallerySchema);
export default Gallery;
