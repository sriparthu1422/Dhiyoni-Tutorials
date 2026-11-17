import express from 'express';
import {
  subscribeNewsletter,
  getNewsletters,
  getNewsletterById,
  deleteNewsletter,
} from '../controllers/newsletterController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(subscribeNewsletter)
  .get(protect, admin, getNewsletters);

router.route('/:id')
  .get(protect, admin, getNewsletterById)
  .delete(protect, admin, deleteNewsletter);

export default router;
