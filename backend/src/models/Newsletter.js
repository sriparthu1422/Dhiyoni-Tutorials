import mongoose from 'mongoose';

const newsletterSchema = new mongoose.Schema({
  submissionId: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  }
}, {
  timestamps: true
});

// Indexes for query performance and idempotent submission tracking
newsletterSchema.index(
  { submissionId: 1 },
  {
    unique: true,
    partialFilterExpression: { submissionId: { $type: 'string' } },
  }
);
newsletterSchema.index({ createdAt: -1 });

const Newsletter = mongoose.model('Newsletter', newsletterSchema);
export default Newsletter;
