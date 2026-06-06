import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide your full name'],
      trim: true,
    },
    userType: {
      type: String,
      required: [true, 'Please select your user type'],
      enum: ['Teacher', 'Student', 'Parent'],
    },
    email: {
      type: String,
      required: [true, 'Please provide your email address'],
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email',
      ],
      trim: true,
      lowercase: true,
    },
    contactNumber: {
      type: String,
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Please provide your feedback message'],
    },
    rating: {
      type: Number,
      required: [true, 'Please provide a rating'],
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

const Feedback = mongoose.model('Feedback', feedbackSchema);

export default Feedback;
