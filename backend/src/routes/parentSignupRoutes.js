import express from 'express';
import { createParentSignup, getParentSignups, updateParentSignupStatus, deleteParentSignup } from '../controllers/parentSignupController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(createParentSignup)
  .get(protect, getParentSignups);

router.route('/:id')
  .put(protect, updateParentSignupStatus)
  .delete(protect, deleteParentSignup);

export default router;
