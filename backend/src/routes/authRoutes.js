import express from 'express';
import { authUser, getUserProfile, updatePassword } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', authUser);
router.get('/profile', protect, getUserProfile);
router.put('/password', protect, updatePassword);

export default router;
