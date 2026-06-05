import ParentSignup from '../models/ParentSignup.js';
import { sendParentSignupEmail } from '../config/email.js';

// @desc    Create student/parent signup request
// @route   POST /api/parent-signups
// @access  Public
export const createParentSignup = async (req, res) => {
  const {
    studentName,
    gender,
    grade,
    subject,
    parentName,
    contact,
    email,
    city,
    state,
    referral
  } = req.body;

  try {
    const signup = await ParentSignup.create({
      studentName,
      gender,
      grade,
      subject,
      parentName,
      contact,
      email,
      city,
      state,
      referral
    });

    // Forward details via email and AWAIT it so Vercel doesn't kill the background process
    try {
      await sendParentSignupEmail(signup);
    } catch (emailError) {
      console.error('⚠️ SMTP Failure: Failed to forward parent signup email:', emailError.message);
      // We log the error but still return 201 since the database save was successful
    }

    res.status(201).json(signup);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Get all parent signup requests
// @route   GET /api/parent-signups
// @access  Private (Admin)
export const getParentSignups = async (req, res) => {
  try {
    const signups = await ParentSignup.find({}).sort({ createdAt: -1 });
    res.json(signups);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update parent signup request status
// @route   PUT /api/parent-signups/:id
// @access  Private (Admin)
export const updateParentSignupStatus = async (req, res) => {
  const { status } = req.body;

  try {
    const signup = await ParentSignup.findById(req.params.id);

    if (signup) {
      signup.status = status || signup.status;
      const updatedSignup = await signup.save();
      res.json(updatedSignup);
    } else {
      res.status(404).json({ message: 'Signup request not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete parent signup request
// @route   DELETE /api/parent-signups/:id
// @access  Private (Admin)
export const deleteParentSignup = async (req, res) => {
  try {
    const signup = await ParentSignup.findById(req.params.id);

    if (signup) {
      await signup.deleteOne();
      res.json({ message: 'Signup request deleted' });
    } else {
      res.status(404).json({ message: 'Signup request not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
