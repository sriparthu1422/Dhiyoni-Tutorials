import express from 'express';
import {
  createTutorSignup,
  getTutorSignups,
  getTutorSignupById,
  updateTutorSignupStatus,
  deleteTutorSignup,
} from '../controllers/tutorSignupController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { formSubmissionRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.route('/')
  .post(formSubmissionRateLimiter, createTutorSignup)
  .get(protect, admin, getTutorSignups);

router.route('/:id')
  .get(protect, admin, getTutorSignupById)
  .put(protect, admin, updateTutorSignupStatus)
  .delete(protect, admin, deleteTutorSignup);

export default router;
