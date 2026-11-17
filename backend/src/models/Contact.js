import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  submissionId: {
    type: String,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    default: 'Course Inquiry'
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Resolved'],
    default: 'Pending'
  }
}, {
  timestamps: true
});

// Indexes for query performance and idempotent submission tracking
contactSchema.index(
  { submissionId: 1 },
  {
    unique: true,
    partialFilterExpression: { submissionId: { $type: 'string' } },
  }
);
contactSchema.index({ createdAt: -1 });
contactSchema.index({ status: 1, createdAt: -1 });

const Contact = mongoose.model('Contact', contactSchema);
export default Contact;
