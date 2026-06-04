import mongoose from 'mongoose';

const tutorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  qualification: {
    type: String,
    required: [true, 'Qualification is required'],
    trim: true
  },
  experience: {
    type: String,
    required: [true, 'Experience is required'],
    trim: true
  },
  rating: {
    type: String,
    default: '5.0',
    trim: true
  },
  board: {
    type: String,
    required: [true, 'Board is required'],
    trim: true
  },
  image: {
    type: String,
    required: [true, 'Image URL/path is required'],
    trim: true
  }
}, {
  timestamps: true
});

const Tutor = mongoose.model('Tutor', tutorSchema);
export default Tutor;
