import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

// Strict RFC 4122 UUIDv4 format regex (character 13 must be '4', variant bits must be 8, 9, a, or b)
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Safely queries for an existing submission.
 * If Mongoose is disconnected (e.g. during in-process unit tests without a mock findOne),
 * skips query buffering to avoid 10-second timeouts.
 *
 * @param {import('mongoose').Model} Model
 * @param {object} query
 * @returns {Promise<any>}
 */
export const findExistingSubmission = async (Model, query) => {
  if (mongoose.connection.readyState === 0) {
    return null;
  }
  return await Model.findOne(query);
};

/**
 * Validates or generates a submissionId.
 * - If submissionId is provided, validates that it is a valid UUID string.
 * - If not provided (or undefined/null), generates a new UUIDv4 for backward compatibility.
 * - Never trusts client-supplied MongoDB _id.
 *
 * @param {any} clientSubmissionId
 * @returns {{ valid: boolean, submissionId?: string, isGenerated?: boolean, error?: string }}
 */
export const resolveSubmissionId = (clientSubmissionId) => {
  if (clientSubmissionId === undefined || clientSubmissionId === null || clientSubmissionId === '') {
    return {
      valid: true,
      submissionId: randomUUID(),
      isGenerated: true,
    };
  }

  if (typeof clientSubmissionId !== 'string') {
    return {
      valid: false,
      error: 'Invalid submissionId format: submissionId must be a string.',
    };
  }

  const trimmed = clientSubmissionId.trim();
  if (!UUID_V4_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid submissionId format: must be a valid UUIDv4.',
    };
  }

  return {
    valid: true,
    submissionId: trimmed,
    isGenerated: false,
  };
};

/**
 * Normalizes and extracts only the permitted submission fields for a given form.
 * Prevents mass-assignment vulnerabilities and strips MongoDB metadata (_id, __v, status, createdAt, updatedAt).
 *
 * @param {'contact' | 'parentSignup' | 'tutorSignup' | 'newsletter' | 'feedback'} formType
 * @param {Record<string, any>} body
 * @returns {Record<string, any>}
 */
export const normalizeSubmissionPayload = (formType, body = {}) => {
  switch (formType) {
    case 'contact': {
      return {
        name: typeof body.name === 'string' ? body.name.trim() : body.name,
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
        subject: typeof body.subject === 'string' && body.subject.trim() ? body.subject.trim() : 'Course Inquiry',
        message: typeof body.message === 'string' ? body.message.trim() : body.message,
      };
    }

    case 'parentSignup': {
      return {
        studentName: typeof body.studentName === 'string' ? body.studentName.trim() : body.studentName,
        gender: typeof body.gender === 'string' ? body.gender.trim() : body.gender,
        grade: typeof body.grade === 'string' ? body.grade.trim() : body.grade,
        subject: typeof body.subject === 'string' ? body.subject.trim() : body.subject,
        parentName: typeof body.parentName === 'string' ? body.parentName.trim() : body.parentName,
        contact: typeof body.contact === 'string' ? body.contact.trim() : body.contact,
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
        city: typeof body.city === 'string' ? body.city.trim() : body.city,
        state: typeof body.state === 'string' ? body.state.trim() : body.state,
        referral: typeof body.referral === 'string' ? body.referral.trim() : '',
      };
    }

    case 'tutorSignup': {
      let normalizedDob = null;
      if (body.dob) {
        const parsedDate = new Date(body.dob);
        if (!isNaN(parsedDate.getTime())) {
          normalizedDob = parsedDate.toISOString().split('T')[0]; // compare YYYY-MM-DD
        }
      }

      let normalizedBoards = [];
      if (Array.isArray(body.boards)) {
        normalizedBoards = body.boards
          .map((b) => (typeof b === 'string' ? b.trim() : String(b)))
          .filter(Boolean)
          .sort();
      }

      return {
        fullName: typeof body.fullName === 'string' ? body.fullName.trim() : body.fullName,
        gender: typeof body.gender === 'string' ? body.gender.trim() : body.gender,
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
        contact: typeof body.contact === 'string' ? body.contact.trim() : body.contact,
        dob: normalizedDob,
        location: typeof body.location === 'string' ? body.location.trim() : body.location,
        qualification: typeof body.qualification === 'string' ? body.qualification.trim() : body.qualification,
        occupation: typeof body.occupation === 'string' ? body.occupation.trim() : body.occupation,
        experience: typeof body.experience === 'string' ? body.experience.trim() : '',
        grades: typeof body.grades === 'string' ? body.grades.trim() : body.grades,
        subjects: typeof body.subjects === 'string' ? body.subjects.trim() : body.subjects,
        time: typeof body.time === 'string' ? body.time.trim() : body.time,
        boards: normalizedBoards,
        hasTech: body.hasTech === true || body.hasTech === 'true',
      };
    }

    case 'newsletter': {
      return {
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
      };
    }

    case 'feedback': {
      return {
        name: typeof body.name === 'string' ? body.name.trim() : body.name,
        userType: typeof body.userType === 'string' ? body.userType.trim() : body.userType,
        email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
        contactNumber: typeof body.contactNumber === 'string' ? body.contactNumber.trim() : '',
        message: typeof body.message === 'string' ? body.message.trim() : body.message,
        rating: Number(body.rating),
      };
    }

    default:
      throw new Error(`Unknown formType: ${formType}`);
  }
};

/**
 * Performs a deterministic comparison between an existing persisted document and an incoming normalized payload.
 * Ignores all internal/server-generated fields (_id, createdAt, updatedAt, status, __v).
 *
 * @param {'contact' | 'parentSignup' | 'tutorSignup' | 'newsletter' | 'feedback'} formType
 * @param {Record<string, any>} existingDoc
 * @param {Record<string, any>} normalizedPayload
 * @returns {boolean}
 */
export const isPayloadIdentical = (formType, existingDoc, normalizedPayload) => {
  if (!existingDoc || !normalizedPayload) return false;

  const docNormalized = normalizeSubmissionPayload(formType, existingDoc);

  switch (formType) {
    case 'contact':
      return (
        docNormalized.name === normalizedPayload.name &&
        docNormalized.email === normalizedPayload.email &&
        docNormalized.subject === normalizedPayload.subject &&
        docNormalized.message === normalizedPayload.message
      );

    case 'parentSignup':
      return (
        docNormalized.studentName === normalizedPayload.studentName &&
        docNormalized.gender === normalizedPayload.gender &&
        docNormalized.grade === normalizedPayload.grade &&
        docNormalized.subject === normalizedPayload.subject &&
        docNormalized.parentName === normalizedPayload.parentName &&
        docNormalized.contact === normalizedPayload.contact &&
        docNormalized.email === normalizedPayload.email &&
        docNormalized.city === normalizedPayload.city &&
        docNormalized.state === normalizedPayload.state &&
        (docNormalized.referral || '') === (normalizedPayload.referral || '')
      );

    case 'tutorSignup': {
      const boardsEqual =
        Array.isArray(docNormalized.boards) &&
        Array.isArray(normalizedPayload.boards) &&
        docNormalized.boards.length === normalizedPayload.boards.length &&
        docNormalized.boards.every((val, idx) => val === normalizedPayload.boards[idx]);

      return (
        docNormalized.fullName === normalizedPayload.fullName &&
        docNormalized.gender === normalizedPayload.gender &&
        docNormalized.email === normalizedPayload.email &&
        docNormalized.contact === normalizedPayload.contact &&
        docNormalized.dob === normalizedPayload.dob &&
        docNormalized.location === normalizedPayload.location &&
        docNormalized.qualification === normalizedPayload.qualification &&
        docNormalized.occupation === normalizedPayload.occupation &&
        (docNormalized.experience || '') === (normalizedPayload.experience || '') &&
        docNormalized.grades === normalizedPayload.grades &&
        docNormalized.subjects === normalizedPayload.subjects &&
        docNormalized.time === normalizedPayload.time &&
        boardsEqual &&
        docNormalized.hasTech === normalizedPayload.hasTech
      );
    }

    case 'newsletter':
      return docNormalized.email === normalizedPayload.email;

    case 'feedback':
      return (
        docNormalized.name === normalizedPayload.name &&
        docNormalized.userType === normalizedPayload.userType &&
        docNormalized.email === normalizedPayload.email &&
        (docNormalized.contactNumber || '') === (normalizedPayload.contactNumber || '') &&
        docNormalized.message === normalizedPayload.message &&
        docNormalized.rating === normalizedPayload.rating
      );

    default:
      return false;
  }
};
