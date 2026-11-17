import express from 'express';
import {
  createContact,
  getContacts,
  getContactById,
  updateContactStatus,
  deleteContact,
} from '../controllers/contactController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { formSubmissionRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.route('/')
  .post(formSubmissionRateLimiter, createContact)
  .get(protect, admin, getContacts);

router.route('/:id')
  .get(protect, admin, getContactById)
  .put(protect, admin, updateContactStatus)
  .delete(protect, admin, deleteContact);

export default router;
