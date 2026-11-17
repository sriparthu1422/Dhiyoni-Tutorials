import crypto from 'node:crypto';
import ExportJob from '../models/ExportJob.js';
import { acquireSpreadsheetLock } from '../services/lockService.js';
import { runExportJob } from '../services/exportEngine.js';

const SPREADSHEET_ID_REGEX = /^[a-zA-Z0-9-_]{15,100}$/;
const VALID_CATEGORIES = ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'];

/**
 * Normalizes a Google Spreadsheet ID by extracting the ID from full URLs or query params.
 * @param {string} input
 * @returns {string}
 */
export function normalizeSpreadsheetId(input) {
  if (!input || typeof input !== 'string') return '';
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/d\/([a-zA-Z0-9-_]{15,100})/);
  if (urlMatch) return urlMatch[1];
  return trimmed.split('/')[0].split('?')[0].split('#')[0].trim();
}

export const DEFAULT_SPREADSHEET_ID = '14sbOQb6MiXqKNWpVGjHvBOovNz9p3uNHl_pmCFgKGZY';

// @desc    Initiate a new Google Sheets export job
// @route   POST /api/export
// @access  Private (Admin)
export const initiateExport = async (req, res) => {
  try {
    const {
      spreadsheetId: reqSpreadsheetId,
      categories: reqCategories,
      exportType = 'full',
      runSync = false,
    } = req.body || {};

    // 1. Resolve & Validate Spreadsheet ID
    const rawSpreadsheetId = (
      reqSpreadsheetId ||
      process.env.GOOGLE_SPREADSHEET_ID ||
      DEFAULT_SPREADSHEET_ID
    ).trim();
    const spreadsheetId = normalizeSpreadsheetId(rawSpreadsheetId);
    if (!spreadsheetId) {
      return res.status(400).json({
        message: 'Destination spreadsheetId is required. Provide it in the request or set GOOGLE_SPREADSHEET_ID in backend/.env',
      });
    }

    if (!SPREADSHEET_ID_REGEX.test(spreadsheetId)) {
      return res.status(400).json({
        message: 'Invalid spreadsheetId format. Expected 15-100 alphanumeric characters, hyphens, or underscores',
      });
    }

    // 2. Validate Categories if provided
    let categories = VALID_CATEGORIES;
    if (reqCategories !== undefined) {
      if (!Array.isArray(reqCategories) || reqCategories.length === 0) {
        return res.status(400).json({
          message: 'categories must be a non-empty array of collection names',
        });
      }
      for (const cat of reqCategories) {
        if (!VALID_CATEGORIES.includes(cat)) {
          return res.status(400).json({
            message: `Invalid category: '${cat}'. Allowed categories: ${VALID_CATEGORIES.join(', ')}`,
          });
        }
      }
      categories = reqCategories;
    }

    // 3. Request-Level Idempotency Check (Idempotency-Key Header or clientRequestId body param)
    const rawClientRequestId = (req.headers['idempotency-key'] || req.body?.clientRequestId || '').trim();
    const clientRequestId = rawClientRequestId || null;

    if (clientRequestId) {
      const existingJob = await ExportJob.findOne({ clientRequestId });
      if (existingJob) {
        // Compare canonical sorted category arrays
        const reqCategoriesSorted = categories.slice().sort().join(',');
        const existingCategoriesSorted = existingJob.categories.slice().sort().join(',');
        const isDestinationMismatch =
          existingJob.destination?.spreadsheetId &&
          existingJob.destination.spreadsheetId !== spreadsheetId;

        if (existingCategoriesSorted !== reqCategoriesSorted || isDestinationMismatch) {
          return res.status(400).json({
            message: 'Idempotency key reuse with conflicting export parameters (mismatched export categories or destination).',
            jobId: existingJob.jobId,
          });
        }

        // Return existing job without re-initiating
        return res.status(200).json({
          success: true,
          message: 'Export job already initiated with this request ID',
          jobId: existingJob.jobId,
          status: existingJob.status,
          destination: existingJob.destination,
          isExisting: true,
        });
      }
    }

    // 4. Generate unique Job Identifier
    const jobId = `exp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    // 5. Acquire exclusive atomic spreadsheet lock
    const lockResult = await acquireSpreadsheetLock(
      spreadsheetId,
      jobId,
      req.user._id,
      300000 // 5-minute lease duration
    );

    if (!lockResult.acquired) {
      // If clientRequestId was provided, check if the concurrent in-flight job belongs to this request
      if (clientRequestId) {
        for (let i = 0; i < 5; i++) {
          const inFlightJob = await ExportJob.findOne({ clientRequestId });
          if (inFlightJob) {
            return res.status(200).json({
              success: true,
              message: 'Export job already initiated with this request ID',
              jobId: inFlightJob.jobId,
              status: inFlightJob.status,
              destination: inFlightJob.destination,
              isExisting: true,
            });
          }
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
      }

      return res.status(409).json({
        message: 'Concurrent export in progress: Destination spreadsheet is currently locked by another export job',
        activeJobId: lockResult.existingLock?.jobId,
        lockedAt: lockResult.existingLock?.lockedAt,
        expiresAt: lockResult.existingLock?.expiresAt,
      });
    }

    // 6. Create ExportJob record
    let job;
    try {
      job = await ExportJob.create({
        jobId,
        clientRequestId,
        exportType,
        categories,
        requestedBy: req.user._id,
        status: 'pending',
        destination: {
          spreadsheetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
          tabs: [],
        },
        snapshotTimestamp: new Date(),
      });
    } catch (createErr) {
      // Handle concurrent race condition for duplicate clientRequestId
      if (createErr.code === 11000 && clientRequestId) {
        // Safely release the lock acquired by this attempt so no lock is leaked
        try {
          await releaseSpreadsheetLock(spreadsheetId, lockResult.ownerToken);
        } catch {
          // Ignore secondary release errors
        }

        const winningJob = await ExportJob.findOne({ clientRequestId });
        if (winningJob) {
          return res.status(200).json({
            success: true,
            message: 'Export job already initiated with this request ID',
            jobId: winningJob.jobId,
            status: winningJob.status,
            destination: winningJob.destination,
            isExisting: true,
          });
        }
      }
      throw createErr;
    }

    // 6. Execution: synchronous on serverless (Vercel / Lambda) to prevent lifecycle freezing, or background in daemon mode
    const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (runSync || isServerless) {
      try {
        const completedJob = await runExportJob(jobId, lockResult.ownerToken);
        return res.status(200).json({
          success: true,
          message: 'Export completed successfully',
          jobId,
          status: 'completed',
          destination: completedJob.destination,
          data: completedJob,
        });
      } catch (err) {
        return res.status(err.statusCode || err.status || 500).json({
          success: false,
          message: err.message || 'Export failed during execution',
          jobId,
          status: 'failed',
        });
      }
    }

    // Default asynchronous execution
    runExportJob(jobId, lockResult.ownerToken).catch((err) => {
      console.error(`Background export job ${jobId} failed:`, err);
    });

    return res.status(202).json({
      success: true,
      message: 'Export job initiated successfully',
      jobId,
      status: 'pending',
      destination: job.destination,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get status and progress of an export job
// @route   GET /api/export/:jobId
// @access  Private (Admin)
export const getExportJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    if (!jobId || typeof jobId !== 'string') {
      return res.status(400).json({ message: 'Valid jobId parameter is required' });
    }

    const job = await ExportJob.findOne({ jobId })
      .populate('requestedBy', 'username email')
      .lean();

    if (!job) {
      return res.status(404).json({ message: `Export job '${jobId}' not found` });
    }

    res.json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get authorized export job history
// @route   GET /api/export
// @access  Private (Admin)
export const getExportHistory = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const skip = (page - 1) * limit;

    const [total, jobs] = await Promise.all([
      ExportJob.countDocuments(),
      ExportJob.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('requestedBy', 'username email')
        .lean(),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      success: true,
      count: jobs.length,
      data: jobs,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
