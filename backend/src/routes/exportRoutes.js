import express from 'express';
import {
  initiateExport,
  getExportJobStatus,
  getExportHistory,
} from '../controllers/exportController.js';
import { protect, admin } from '../middleware/authMiddleware.js';
import { exportRateLimiter } from '../middleware/rateLimitMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, admin, exportRateLimiter, initiateExport)
  .get(protect, admin, getExportHistory);

router.route('/:jobId')
  .get(protect, admin, getExportJobStatus);

export default router;
