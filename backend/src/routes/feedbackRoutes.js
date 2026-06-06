import express from 'express';
import { submitFeedback, getFeedbacks, deleteFeedback } from '../controllers/feedbackController.js';

const router = express.Router();

router.route('/')
  .post(submitFeedback)
  .get(getFeedbacks);

router.route('/:id')
  .delete(deleteFeedback);

export default router;
