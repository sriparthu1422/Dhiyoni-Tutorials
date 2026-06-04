import express from 'express';
import { createTutorSignup, getTutorSignups, updateTutorSignupStatus, deleteTutorSignup } from '../controllers/tutorSignupController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(createTutorSignup)
  .get(protect, getTutorSignups);

router.route('/:id')
  .put(protect, updateTutorSignupStatus)
  .delete(protect, deleteTutorSignup);

export default router;
