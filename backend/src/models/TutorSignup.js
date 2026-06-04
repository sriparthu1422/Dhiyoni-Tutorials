import mongoose from 'mongoose';

const tutorSignupSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full Name is required'],
    trim: true
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  contact: {
    type: String,
    required: [true, 'Contact Number is required'],
    trim: true
  },
  dob: {
    type: Date,
    required: [true, 'Date of Birth is required']
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  qualification: {
    type: String,
    required: [true, 'Qualification is required'],
    trim: true
  },
  occupation: {
    type: String,
    required: [true, 'Occupation is required'],
    trim: true
  },
  experience: {
    type: String,
    trim: true,
    default: ''
  },
  grades: {
    type: String,
    required: [true, 'Grades to teach is required'],
    trim: true
  },
  subjects: {
    type: String,
    required: [true, 'Subjects is required'],
    trim: true
  },
  time: {
    type: String,
    required: [true, 'Preferred time is required'],
    trim: true
  },
  boards: {
    type: [String],
    default: []
  },
  hasTech: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['Pending', 'Interview Scheduled', 'Approved', 'Rejected'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

const TutorSignup = mongoose.model('TutorSignup', tutorSignupSchema);
export default TutorSignup;
