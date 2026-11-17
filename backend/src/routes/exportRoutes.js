import express from 'express';
import {
  initiateExport,
  getExportJobStatus,
  getExportHistory,
} from '../controllers/exportController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, admin, initiateExport)
  .get(protect, admin, getExportHistory);

router.route('/:jobId')
  .get(protect, admin, getExportJobStatus);

export default router;

