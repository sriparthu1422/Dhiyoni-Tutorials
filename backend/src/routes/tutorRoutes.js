import express from 'express';
import { getTutors, createTutor, updateTutor, deleteTutor } from '../controllers/tutorController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .get(getTutors)
  .post(protect, admin, createTutor);

router.route('/:id')
  .put(protect, admin, updateTutor)
  .delete(protect, admin, deleteTutor);

export default router;
