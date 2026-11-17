import Feedback from '../models/Feedback.js';
import sendEmail from '../config/email.js';
import { resolveSubmissionId, normalizeSubmissionPayload, isPayloadIdentical, findExistingSubmission } from '../utils/submissionUtils.js';
import { buildSubmissionQuery, executePaginatedQuery, isValidObjectId } from '../utils/queryUtils.js';

// @desc    Submit new feedback (idempotent submission)
// @route   POST /api/feedback
// @access  Public
export const submitFeedback = async (req, res) => {
  const subIdResult = resolveSubmissionId(req.body.submissionId);
  if (!subIdResult.valid) {
    return res.status(400).json({ success: false, message: subIdResult.error });
  }

  const submissionId = subIdResult.submissionId;
  const normalizedPayload = normalizeSubmissionPayload('feedback', req.body);
  const { name, userType, email, contactNumber, message, rating } = normalizedPayload;

  // In-memory schema pre-validation to fast-fail invalid inputs
  const validationDoc = new Feedback({
    submissionId,
    name,
    userType,
    email,
    contactNumber,
    message,
    rating,
  });
  const validationError = validationDoc.validateSync();
  if (validationError) {
    const messages = Object.values(validationError.errors).map((err) => err.message);
    return res.status(400).json({ success: false, message: messages.join(', ') });
  }

  try {
    // 1. Check for existing submission with the same submissionId
    const existing = await findExistingSubmission(Feedback, { submissionId });
    if (existing) {
      if (isPayloadIdentical('feedback', existing, normalizedPayload)) {
        // Replay: Return 200 without sending duplicate notification emails
        return res.status(200).json({
          success: true,
          message: 'Feedback already submitted and recorded',
          data: existing,
        });
      }
      return res.status(409).json({
        success: false,
        message: 'A submission with this ID already exists with different details.',
      });
    }

    // 2. Persist new feedback record
    const feedback = await Feedback.create({
      submissionId,
      name,
      userType,
      email,
      contactNumber,
      message,
      rating,
    });

    // 3. Send email notification to admin (non-blocking failure: database persistence is preserved)
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
      // Non-fatal: Record is safely persisted in MongoDB as primary source of truth. Do NOT delete record.
    }

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: feedback,
    });
  } catch (error) {
    // 4. Duplicate key error handling (concurrent race)
    if (error.code === 11000) {
      const winningDoc = await findExistingSubmission(Feedback, { submissionId });
      if (winningDoc) {
        if (isPayloadIdentical('feedback', winningDoc, normalizedPayload)) {
          return res.status(200).json({
            success: true,
            message: 'Feedback already submitted and recorded',
            data: winningDoc,
          });
        }
        return res.status(409).json({
          success: false,
          message: 'A submission with this ID already exists with different details.',
        });
      }
    }

    console.error('Error submitting feedback:', error);

    // Handle Mongoose validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }

    return res.status(500).json({
      success: false,
      message: 'Server Error',
    });
  }
};

// @desc    Get all feedbacks (with search, filter, sort, and server-side pagination)
// @route   GET /api/feedback
// @access  Private/Admin
export const getFeedbacks = async (req, res) => {
  try {
    const queryOptions = buildSubmissionQuery(req.query, {
      searchFields: ['name', 'email', 'message', 'userType', 'contactNumber', 'submissionId'],
      defaultSort: 'createdAt',
    });

    const result = await executePaginatedQuery(Feedback, queryOptions);

    if (req.query.all === 'true') {
      return res.json(result.data);
    }

    res.status(200).json({
      success: true,
      count: result.data.length,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server Error',
    });
  }
};

// @desc    Get single feedback by ID
// @route   GET /api/feedback/:id
// @access  Private/Admin
export const getFeedbackById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid feedback ID format' });
    }

    const feedback = await Feedback.findById(req.params.id).select('-__v');

    if (!feedback) {
      return res.status(404).json({ success: false, message: 'Feedback not found' });
    }

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete feedback
// @route   DELETE /api/feedback/:id
// @access  Private/Admin
export const deleteFeedback = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid feedback ID format' });
    }

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
