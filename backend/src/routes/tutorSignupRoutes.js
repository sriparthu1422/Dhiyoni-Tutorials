import express from 'express';
import {
  createTutorSignup,
  getTutorSignups,
  getTutorSignupById,
  updateTutorSignupStatus,
  deleteTutorSignup,
} from '../controllers/tutorSignupController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(createTutorSignup)
  .get(protect, admin, getTutorSignups);

router.route('/:id')
  .get(protect, admin, getTutorSignupById)
  .put(protect, admin, updateTutorSignupStatus)
  .delete(protect, admin, deleteTutorSignup);

export default router;
