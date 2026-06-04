import express from 'express';
import { subscribeNewsletter, getNewsletters, deleteNewsletter } from '../controllers/newsletterController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(subscribeNewsletter)
  .get(protect, getNewsletters);

router.route('/:id')
  .delete(protect, deleteNewsletter);

export default router;
