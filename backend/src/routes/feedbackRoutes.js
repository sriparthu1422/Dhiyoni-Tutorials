import express from 'express';
import {
  submitFeedback,
  getFeedbacks,
  getFeedbackById,
  deleteFeedback,
} from '../controllers/feedbackController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { formSubmissionRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.route('/')
  .post(formSubmissionRateLimiter, submitFeedback)
  .get(protect, admin, getFeedbacks);

router.route('/:id')
  .get(protect, admin, getFeedbackById)
  .delete(protect, admin, deleteFeedback);

export default router;
