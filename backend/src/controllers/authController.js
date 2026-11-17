import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import ParentSignup from '../models/ParentSignup.js';
import TutorSignup from '../models/TutorSignup.js';
import Newsletter from '../models/Newsletter.js';
import Feedback from '../models/Feedback.js';

// Generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Update password
// @route   PUT /api/auth/password
// @access  Private
export const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect current password' });
    }

    // Hash of new password is automatically handled by userSchema pre-save hook
    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get aggregated overview counts for dashboard
// @route   GET /api/auth/dashboard-stats
// @access  Private (Admin)
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalContacts,
      pendingContacts,
      totalParents,
      pendingParents,
      totalTutors,
      pendingTutors,
      totalNewsletters,
      totalFeedbacks,
    ] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ status: 'Pending' }),
      ParentSignup.countDocuments(),
      ParentSignup.countDocuments({ status: 'Pending' }),
      TutorSignup.countDocuments(),
      TutorSignup.countDocuments({ status: 'Pending' }),
      Newsletter.countDocuments(),
      Feedback.countDocuments(),
    ]);

    res.json({
      success: true,
      data: {
        contacts: { total: totalContacts, pending: pendingContacts },
        parentSignups: { total: totalParents, pending: pendingParents },
        tutorSignups: { total: totalTutors, pending: pendingTutors },
        newsletters: { total: totalNewsletters, pending: 0 },
        feedbacks: { total: totalFeedbacks, pending: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
