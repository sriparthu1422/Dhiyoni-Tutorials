import express from 'express';
import { getTutors, createTutor, updateTutor, deleteTutor } from '../controllers/tutorController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getTutors)
  .post(protect, createTutor);

router.route('/:id')
  .put(protect, updateTutor)
  .delete(protect, deleteTutor);

export default router;
