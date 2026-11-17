import TutorSignup from '../models/TutorSignup.js';
import { sendTutorApplicationEmail } from '../config/email.js';
import { resolveSubmissionId, normalizeSubmissionPayload, isPayloadIdentical, findExistingSubmission } from '../utils/submissionUtils.js';
import { buildSubmissionQuery, executePaginatedQuery, isValidObjectId } from '../utils/queryUtils.js';

// @desc    Create tutor application request (idempotent submission)
// @route   POST /api/tutor-signups
// @access  Public
export const createTutorSignup = async (req, res) => {
  const subIdResult = resolveSubmissionId(req.body.submissionId);
  if (!subIdResult.valid) {
    return res.status(400).json({ message: subIdResult.error });
  }

  const submissionId = subIdResult.submissionId;
  const normalizedPayload = normalizeSubmissionPayload('tutorSignup', req.body);

  // In-memory schema pre-validation to fast-fail invalid inputs
  const validationDoc = new TutorSignup({
    submissionId,
    ...normalizedPayload,
    dob: normalizedPayload.dob ? new Date(normalizedPayload.dob) : req.body.dob,
  });
  const validationError = validationDoc.validateSync();
  if (validationError) {
    const messages = Object.values(validationError.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  try {
    // 1. Check for existing submission with the same submissionId
    const existing = await findExistingSubmission(TutorSignup, { submissionId });
    if (existing) {
      if (isPayloadIdentical('tutorSignup', existing, normalizedPayload)) {
        // Replay: Return 200 without sending duplicate notification emails
        return res.status(200).json(existing);
      }
      return res.status(409).json({
        message: 'A submission with this ID already exists with different details.',
      });
    }

    // 2. Persist new tutor application record
    const signup = await TutorSignup.create({
      submissionId,
      ...normalizedPayload,
      dob: normalizedPayload.dob ? new Date(normalizedPayload.dob) : req.body.dob,
    });

    // 3. Forward details via email (non-blocking failure: database persistence is preserved)
    try {
      await sendTutorApplicationEmail(signup);
    } catch (emailError) {
      console.error('⚠️ SMTP Failure: Failed to forward application email:', emailError.message);
      // Non-fatal: Record is safely persisted in MongoDB as primary source of truth. Do NOT delete record.
    }

    return res.status(201).json(signup);
  } catch (error) {
    // 4. Race condition handling: concurrent request with same submissionId
    if (error.code === 11000) {
      const winningDoc = await findExistingSubmission(TutorSignup, { submissionId });
      if (winningDoc) {
        if (isPayloadIdentical('tutorSignup', winningDoc, normalizedPayload)) {
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

    return res.status(400).json({ message: error.message || 'Failed to record application.' });
  }
};

// @desc    Get all tutor applications (with search, filter, sort, and server-side pagination)
// @route   GET /api/tutor-signups
// @access  Private (Admin)
export const getTutorSignups = async (req, res) => {
  try {
    const queryOptions = buildSubmissionQuery(req.query, {
      searchFields: ['fullName', 'email', 'contact', 'location', 'qualification', 'occupation', 'grades', 'subjects', 'submissionId'],
      allowedStatuses: ['Pending', 'Interview Scheduled', 'Approved', 'Rejected'],
      defaultSort: 'createdAt',
    });

    const result = await executePaginatedQuery(TutorSignup, queryOptions);

    if (req.query.all === 'true') {
      return res.json(result.data);
    }

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Get single tutor application by ID
// @route   GET /api/tutor-signups/:id
// @access  Private (Admin)
export const getTutorSignupById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid tutor application ID format' });
    }

    const signup = await TutorSignup.findById(req.params.id).select('-__v');

    if (!signup) {
      return res.status(404).json({ message: 'Application not found' });
    }

    res.json({ success: true, data: signup });
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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid tutor application ID format' });
    }

    if (!status || !['Pending', 'Interview Scheduled', 'Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid or missing status. Allowed: Pending, Interview Scheduled, Approved, Rejected' });
    }

    const signup = await TutorSignup.findById(req.params.id);

    if (signup) {
      signup.status = status;
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
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid tutor application ID format' });
    }

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
