import express from 'express';
import { authUser, getUserProfile, updatePassword, getDashboardStats } from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/login', authUser);
router.get('/profile', protect, getUserProfile);
router.put('/password', protect, updatePassword);
router.get('/dashboard-stats', protect, admin, getDashboardStats);

export default router;
