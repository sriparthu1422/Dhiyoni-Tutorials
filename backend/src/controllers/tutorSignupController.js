import TutorSignup from '../models/TutorSignup.js';
import { sendTutorApplicationEmail } from '../config/email.js';

// @desc    Create tutor application request
// @route   POST /api/tutor-signups
// @access  Public
export const createTutorSignup = async (req, res) => {
  const {
    fullName,
    gender,
    email,
    contact,
    dob,
    location,
    qualification,
    occupation,
    experience,
    grades,
    subjects,
    time,
    boards,
    hasTech
  } = req.body;

  try {
    const signup = await TutorSignup.create({
      fullName,
      gender,
      email,
      contact,
      dob: new Date(dob),
      location,
      qualification,
      occupation,
      experience,
      grades,
      subjects,
      time,
      boards: Array.isArray(boards) ? boards : [],
      hasTech: hasTech === true || hasTech === 'true'
    });

    // Forward details via email and AWAIT it so Vercel doesn't kill the background process
    try {
      await sendTutorApplicationEmail(signup);
    } catch (emailError) {
      console.error('⚠️ SMTP Failure: Failed to forward application email:', emailError.message);
      // We log the error but still return 201 since the database save was successful
    }

    res.status(201).json(signup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all tutor applications
// @route   GET /api/tutor-signups
// @access  Private (Admin)
export const getTutorSignups = async (req, res) => {
  try {
    const signups = await TutorSignup.find({}).sort({ createdAt: -1 });
    res.json(signups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update tutor application status
// @route   PUT /api/tutor-signups/:id
// @access  Private (Admin)
export const updateTutorSignupStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const signup = await TutorSignup.findById(req.params.id);

    if (signup) {
      signup.status = status || signup.status;
      const updatedSignup = await signup.save();
      res.json(updatedSignup);
    } else {
      res.status(404).json({ message: 'Application not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete tutor application
// @route   DELETE /api/tutor-signups/:id
// @access  Private (Admin)
export const deleteTutorSignup = async (req, res) => {
  try {
    const signup = await TutorSignup.findById(req.params.id);

    if (signup) {
      await signup.deleteOne();
      res.json({ message: 'Application deleted' });
    } else {
      res.status(404).json({ message: 'Application not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
