import Feedback from '../models/Feedback.js';
import sendEmail from '../config/email.js';

// @desc    Submit new feedback
// @route   POST /api/feedback
// @access  Public
export const submitFeedback = async (req, res) => {
  try {
    const { name, userType, email, contactNumber, message, rating } = req.body;

    const feedback = await Feedback.create({
      name,
      userType,
      email,
      contactNumber,
      message,
      rating,
    });

    // Optional: Send email notification to admin
    try {
      const emailContent = `
        <h2>New Feedback Received</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>User Type:</strong> ${userType}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Contact Number:</strong> ${contactNumber || 'N/A'}</p>
        <p><strong>Rating:</strong> ${rating} / 5 Stars</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `;

      await sendEmail({
        to: process.env.EMAIL_TO || 'dhiyonitutorials.info@gmail.com',
        replyTo: email,
        subject: `New Feedback from ${name} (${userType}) - ${rating} Stars`,
        html: emailContent,
      });
    } catch (emailError) {
      console.error('Error sending feedback notification email:', emailError);
      // We don't fail the request if email sending fails
    }

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback,
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    
    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// @desc    Get all feedbacks
// @route   GET /api/feedback
// @access  Private/Admin
export const getFeedbacks = async (req, res) => {
  try {
    const feedbacks = await Feedback.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: feedbacks.length,
      data: feedbacks,
    });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private/Admin
export const deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findById(req.params.id);
    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }
    
    await feedback.deleteOne();
    
    res.status(200).json({ success: true, message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
