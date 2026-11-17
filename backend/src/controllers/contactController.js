import Contact from '../models/Contact.js';
import { buildSubmissionQuery, executePaginatedQuery, isValidObjectId } from '../utils/queryUtils.js';
import { resolveSubmissionId, normalizeSubmissionPayload, isPayloadIdentical, findExistingSubmission } from '../utils/submissionUtils.js';

// @desc    Create contact inquiry (idempotent submission)
// @route   POST /api/contacts
// @access  Public
export const createContact = async (req, res) => {
  const subIdResult = resolveSubmissionId(req.body.submissionId);
  if (!subIdResult.valid) {
    return res.status(400).json({ message: subIdResult.error });
  }

  const submissionId = subIdResult.submissionId;
  const normalizedPayload = normalizeSubmissionPayload('contact', req.body);

  // In-memory schema pre-validation to avoid unnecessary DB calls and fast-fail invalid inputs
  const validationDoc = new Contact({ submissionId, ...normalizedPayload });
  const validationError = validationDoc.validateSync();
  if (validationError) {
    const messages = Object.values(validationError.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  try {
    // 1. Check for existing submission with the same submissionId
    const existing = await findExistingSubmission(Contact, { submissionId });
    if (existing) {
      if (isPayloadIdentical('contact', existing, normalizedPayload)) {
        return res.status(200).json(existing);
      }
      return res.status(409).json({
        message: 'A submission with this ID already exists with different details.',
      });
    }

    // 2. Persist new contact inquiry
    const contact = await Contact.create({
      submissionId,
      ...normalizedPayload,
    });

    return res.status(201).json(contact);
  } catch (error) {
    // 3. Race condition handling: concurrent request with same submissionId
    if (error.code === 11000) {
      const winningDoc = await findExistingSubmission(Contact, { submissionId });
      if (winningDoc) {
        if (isPayloadIdentical('contact', winningDoc, normalizedPayload)) {
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

    return res.status(400).json({ message: error.message || 'Failed to record contact inquiry.' });
  }
};

// @desc    Get all inquiries (with search, filter, sort, and server-side pagination)
// @route   GET /api/contacts
// @access  Private (Admin)
export const getContacts = async (req, res) => {
  try {
    const queryOptions = buildSubmissionQuery(req.query, {
      searchFields: ['name', 'email', 'subject', 'message', 'submissionId'],
      allowedStatuses: ['Pending', 'Resolved'],
      defaultSort: 'createdAt',
    });

    const result = await executePaginatedQuery(Contact, queryOptions);

    if (req.query.all === 'true') {
      return res.json(result.data);
    }

    res.json(result);
  } catch (error) {
    res.status(error.statusCode || 500).json({ message: error.message });
  }
};

// @desc    Get single inquiry by ID
// @route   GET /api/contacts/:id
// @access  Private (Admin)
export const getContactById = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid inquiry ID format' });
    }

    const contact = await Contact.findById(req.params.id).select('-__v');

    if (!contact) {
      return res.status(404).json({ message: 'Inquiry not found' });
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update inquiry status
// @route   PUT /api/contacts/:id
// @access  Private (Admin)
export const updateContactStatus = async (req, res) => {
  const { status } = req.body;

  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid inquiry ID format' });
    }

    if (!status || !['Pending', 'Resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid or missing status. Allowed: Pending, Resolved' });
    }

    const contact = await Contact.findById(req.params.id);

    if (contact) {
      contact.status = status;
      const updatedContact = await contact.save();
      res.json(updatedContact);
    } else {
      res.status(404).json({ message: 'Inquiry not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete contact inquiry
// @route   DELETE /api/contacts/:id
// @access  Private (Admin)
export const deleteContact = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid inquiry ID format' });
    }

    const contact = await Contact.findById(req.params.id);

    if (contact) {
      await contact.deleteOne();
      res.json({ message: 'Inquiry deleted' });
    } else {
      res.status(404).json({ message: 'Inquiry not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
