import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Contact from '../models/Contact.js';
import ParentSignup from '../models/ParentSignup.js';
import TutorSignup from '../models/TutorSignup.js';
import Newsletter from '../models/Newsletter.js';
import Feedback from '../models/Feedback.js';

// Generate Token with 8-hour expiry and tokenVersion binding
const generateToken = (id, tokenVersion = 0) => {
  return jwt.sign({ id, tokenVersion }, process.env.JWT_SECRET, {
    expiresIn: '8h',
  });
};

// @desc    Auth user & get token (Sets HttpOnly cookie + returns token in body)
// @route   POST /api/auth/login
// @access  Public
export const authUser = async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      const token = generateToken(user._id, user.tokenVersion || 0);

      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('dhiyoni_admin_session', token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
        path: '/',
      });

      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

      res.json({
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        token,
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Log out user and invalidate server-side session
// @route   POST /api/auth/logout
// @access  Private
export const logoutUser = async (req, res) => {
  try {
    if (req.user) {
      await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } });
    }
  } catch (err) {
    // Non-fatal on logout
  }

  res.clearCookie('dhiyoni_admin_session', { path: '/' });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({ success: true, message: 'Logged out successfully' });
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

// @desc    Update password & immediately revoke all other active sessions
// @route   PUT /api/auth/password
// @access  Private
export const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'New password must be at least 8 characters long' });
  }

  if (currentPassword === newPassword) {
    return res.status(400).json({ message: 'New password must be different from current password' });
  }

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
    // Invalidate existing sessions
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Issue a refreshed token for current connection
    const refreshedToken = generateToken(user._id, user.tokenVersion);

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('dhiyoni_admin_session', refreshedToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000,
      path: '/',
    });

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      success: true,
      message: 'Password updated successfully. Other active sessions have been invalidated.',
      token: refreshedToken,
    });
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

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
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
