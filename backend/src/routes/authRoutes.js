import express from 'express';
import {
  authUser,
  logoutUser,
  getUserProfile,
  updatePassword,
  getDashboardStats,
} from '../controllers/authController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { loginRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.post('/login', loginRateLimiter, authUser);
router.post('/logout', protect, logoutUser);
router.get('/profile', protect, getUserProfile);
router.put('/password', protect, updatePassword);
router.get('/dashboard-stats', protect, admin, getDashboardStats);

export default router;
