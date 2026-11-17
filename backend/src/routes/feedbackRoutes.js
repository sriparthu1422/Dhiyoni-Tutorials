import express from 'express';
import {
  submitFeedback,
  getFeedbacks,
  getFeedbackById,
  deleteFeedback,
} from '../controllers/feedbackController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(submitFeedback)
  .get(protect, admin, getFeedbacks);

router.route('/:id')
  .get(protect, admin, getFeedbackById)
  .delete(protect, admin, deleteFeedback);

export default router;
