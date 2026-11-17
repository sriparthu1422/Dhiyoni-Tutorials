import Newsletter from '../models/Newsletter.js';
import { resolveSubmissionId, normalizeSubmissionPayload, isPayloadIdentical, findExistingSubmission } from '../utils/submissionUtils.js';
import { buildSubmissionQuery, executePaginatedQuery, isValidObjectId } from '../utils/queryUtils.js';

// @desc    Subscribe email (idempotent subscription)
// @route   POST /api/newsletters
// @access  Public
export const subscribeNewsletter = async (req, res) => {
  const subIdResult = resolveSubmissionId(req.body.submissionId);
  if (!subIdResult.valid) {
    return res.status(400).json({ message: subIdResult.error });
  }

  const submissionId = subIdResult.submissionId;
  const normalizedPayload = normalizeSubmissionPayload('newsletter', req.body);
  const { email } = normalizedPayload;

  // In-memory schema pre-validation to fast-fail invalid inputs
  const validationDoc = new Newsletter({ submissionId, email });
  const validationError = validationDoc.validateSync();
  if (validationError) {
    const messages = Object.values(validationError.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  try {
    // 1. Check if a submission with the same submissionId already exists
    const existingBySubId = await findExistingSubmission(Newsletter, { submissionId });
    if (existingBySubId) {
      if (isPayloadIdentical('newsletter', existingBySubId, normalizedPayload)) {
        return res.status(200).json(existingBySubId);
      }
      return res.status(409).json({
        message: 'A submission with this ID already exists with different details.',
      });
    }

    // 2. Check if email is already subscribed under a different submission
    const existingByEmail = await findExistingSubmission(Newsletter, { email });
    if (existingByEmail) {
      return res.status(400).json({ message: 'Email is already subscribed' });
    }

    // 3. Persist new newsletter subscription
    const subscription = await Newsletter.create({
      submissionId,
      email,
    });

    return res.status(201).json(subscription);
  } catch (error) {
    // 4. Duplicate key error handling (concurrent race)
    if (error.code === 11000) {
      // Check if collision was on submissionId
      const winningDoc = await findExistingSubmission(Newsletter, { submissionId });
      if (winningDoc) {
        if (isPayloadIdentical('newsletter', winningDoc, normalizedPayload)) {
          return res.status(200).json(winningDoc);
        }
        return res.status(409).json({
          message: 'A submission with this ID already exists with different details.',
        });
      }

      // Check if collision was on email uniqueness
      return res.status(400).json({ message: 'Email is already subscribed' });
    }

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ message: messages.join(', ') });
    }

    return res.status(400).json({ message: error.message || 'Failed to subscribe newsletter.' });
  }
};

// @desc    Get all subscribers (with search, sort, and server-side pagination)
// @route   GET /api/newsletters
// @access  Private (Admin)
export const getNewsletters = async (req, res) => {
  try {
    const queryOptions = buildSubmissionQuery(req.query, {
      searchFields: ['email', 'submissionId'],
      defaultSort: 'createdAt',
    });

    const result = await executePaginatedQuery(Newsletter, queryOptions);

    if (req.query.all === 'true') {
      return res.json(result.data);
    }

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Get single subscriber by ID
// @route   GET /api/newsletters/:id
// @access  Private (Admin)
export const getNewsletterById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid subscriber ID format' });
    }

    const subscription = await Newsletter.findById(req.params.id).select('-__v');

    if (!subscription) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }

    res.json({ success: true, data: subscription });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete subscriber
// @route   DELETE /api/newsletters/:id
// @access  Private (Admin)
export const deleteNewsletter = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid subscriber ID format' });
    }

    const subscription = await Newsletter.findById(req.params.id);

    if (subscription) {
      await subscription.deleteOne();
      res.json({ message: 'Subscription removed' });
    } else {
      res.status(404).json({ message: 'Subscription not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
