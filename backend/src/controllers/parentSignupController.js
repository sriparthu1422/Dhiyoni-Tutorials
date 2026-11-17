import ParentSignup from '../models/ParentSignup.js';
import { sendParentSignupEmail } from '../config/email.js';
import { resolveSubmissionId, normalizeSubmissionPayload, isPayloadIdentical, findExistingSubmission } from '../utils/submissionUtils.js';
import { buildSubmissionQuery, executePaginatedQuery, isValidObjectId } from '../utils/queryUtils.js';

// @desc    Create student/parent signup request (idempotent submission)
// @route   POST /api/parent-signups
// @access  Public
export const createParentSignup = async (req, res) => {
  const subIdResult = resolveSubmissionId(req.body.submissionId);
  if (!subIdResult.valid) {
    return res.status(400).json({ message: subIdResult.error });
  }

  const submissionId = subIdResult.submissionId;
  const normalizedPayload = normalizeSubmissionPayload('parentSignup', req.body);

  // In-memory schema pre-validation to fast-fail invalid inputs
  const validationDoc = new ParentSignup({ submissionId, ...normalizedPayload });
  const validationError = validationDoc.validateSync();
  if (validationError) {
    const messages = Object.values(validationError.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  try {
    // 1. Check for existing submission with the same submissionId
    const existing = await findExistingSubmission(ParentSignup, { submissionId });
    if (existing) {
      if (isPayloadIdentical('parentSignup', existing, normalizedPayload)) {
        // Replay: Return 200 without sending duplicate notification emails
        return res.status(200).json(existing);
      }
      return res.status(409).json({
        message: 'A submission with this ID already exists with different details.',
      });
    }

    // 2. Persist new student/parent signup record
    const signup = await ParentSignup.create({
      submissionId,
      ...normalizedPayload,
    });

    // 3. Forward details via email (non-blocking failure: database persistence is preserved)
    try {
      await sendParentSignupEmail(signup);
    } catch (emailError) {
      console.error('⚠️ SMTP Failure: Failed to forward parent signup email:', emailError.message);
      // Non-fatal: Record is safely persisted in MongoDB as primary source of truth. Do NOT delete record.
    }

    return res.status(201).json(signup);
  } catch (error) {
    // 4. Race condition handling: concurrent request with same submissionId
    if (error.code === 11000) {
      const winningDoc = await findExistingSubmission(ParentSignup, { submissionId });
      if (winningDoc) {
        if (isPayloadIdentical('parentSignup', winningDoc, normalizedPayload)) {
          return res.status(200).json(winningDoc);
        }
        return res.status(409).json({
          message: 'A submission with this ID already exists with different details.',
        });
      }
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    return res.status(400).json({ message: error.message || 'Failed to record registration.' });
  }
};

// @desc    Get all parent signup requests (with search, filter, sort, and server-side pagination)
// @route   GET /api/parent-signups
// @access  Private (Admin)
export const getParentSignups = async (req, res) => {
  try {
    const queryOptions = buildSubmissionQuery(req.query, {
      searchFields: ['studentName', 'parentName', 'email', 'contact', 'subject', 'grade', 'city', 'state', 'submissionId'],
      allowedStatuses: ['Pending', 'Contacted', 'Enrolled', 'Rejected'],
      defaultSort: 'createdAt',
    });

    const result = await executePaginatedQuery(ParentSignup, queryOptions);

    if (req.query.all === 'true') {
      return res.json(result.data);
    }

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Get single parent signup request by ID
// @route   GET /api/parent-signups/:id
// @access  Private (Admin)
export const getParentSignupById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid parent signup ID format' });
    }

    const signup = await ParentSignup.findById(req.params.id).select('-__v');

    if (!signup) {
      return res.status(404).json({ message: 'Signup request not found' });
    }

    res.json({ success: true, data: signup });
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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid parent signup ID format' });
    }

    if (!status || !['Pending', 'Contacted', 'Enrolled', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid or missing status. Allowed: Pending, Contacted, Enrolled, Rejected' });
    }

    const signup = await ParentSignup.findById(req.params.id);

    if (signup) {
      signup.status = status;
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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid parent signup ID format' });
    }

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
