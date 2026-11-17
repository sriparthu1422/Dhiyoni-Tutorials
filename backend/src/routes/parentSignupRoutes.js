import express from 'express';
import {
  createParentSignup,
  getParentSignups,
  getParentSignupById,
  updateParentSignupStatus,
  deleteParentSignup,
} from '../controllers/parentSignupController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(createParentSignup)
  .get(protect, admin, getParentSignups);

router.route('/:id')
  .get(protect, admin, getParentSignupById)
  .put(protect, admin, updateParentSignupStatus)
  .delete(protect, admin, deleteParentSignup);

export default router;
