import mongoose from 'mongoose';

const parentSignupSchema = new mongoose.Schema({
  studentName: {
    type: String,
    required: [true, 'Student Name is required'],
    trim: true
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    trim: true
  },
  grade: {
    type: String,
    required: [true, 'Grade/Class is required'],
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true
  },
  parentName: {
    type: String,
    required: [true, 'Parent Name is required'],
    trim: true
  },
  contact: {
    type: String,
    required: [true, 'Contact Number is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  city: {
    type: String,
    required: [true, 'City/Location is required'],
    trim: true
  },
  state: {
    type: String,
    required: [true, 'State is required'],
    trim: true
  },
  referral: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: ['Pending', 'Contacted', 'Enrolled', 'Rejected'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

const ParentSignup = mongoose.model('ParentSignup', parentSignupSchema);
export default ParentSignup;
