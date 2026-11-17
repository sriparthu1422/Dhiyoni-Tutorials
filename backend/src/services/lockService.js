import crypto from 'node:crypto';
import SpreadsheetLock from '../models/SpreadsheetLock.js';

/**
 * Atomically acquires an exclusive lease lock on a Google Spreadsheet.
 *
 * @param {string} spreadsheetId - The destination Google Spreadsheet ID
 * @param {string} jobId - The ExportJob ID requesting the lock
 * @param {string|mongoose.Types.ObjectId} adminId - The administrator ID
 * @param {number} [leaseDurationMs=300000] - Lock lease duration in ms (default: 5 minutes)
 * @returns {Promise<{ acquired: boolean, ownerToken?: string, lock?: Object, existingLock?: Object }>}
 */
export async function acquireSpreadsheetLock(spreadsheetId, jobId, adminId, leaseDurationMs = 300000) {
  if (!spreadsheetId || typeof spreadsheetId !== 'string') {
    throw new Error('Valid spreadsheetId is required to acquire lock');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + leaseDurationMs);
  const ownerToken = crypto.randomUUID();

  try {
    // 1. Attempt atomic takeover of an expired lease (stale-worker recovery)
    const reclaimedLock = await SpreadsheetLock.findOneAndUpdate(
      {
        spreadsheetId,
        expiresAt: { $lt: now }, // Lease expired
      },
      {
        $set: {
          ownerToken,
          jobId,
          lockedBy: adminId,
          lockedAt: now,
          expiresAt,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (reclaimedLock) {
      return {
        acquired: true,
        ownerToken,
        lock: reclaimedLock,
        recoveredFromStale: true,
      };
    }

    // 2. If no expired lock was found, check if an unexpired active lock exists
    const activeLock = await SpreadsheetLock.findOne({
      spreadsheetId,
      expiresAt: { $gte: now },
    });

    if (activeLock) {
      return {
        acquired: false,
        existingLock: activeLock,
      };
    }

    // 3. No document exists for this spreadsheet; attempt atomic creation
    const newLock = await SpreadsheetLock.create({
      spreadsheetId,
      ownerToken,
      jobId,
      lockedBy: adminId,
      lockedAt: now,
      expiresAt,
    });

    return {
      acquired: true,
      ownerToken,
      lock: newLock,
    };
  } catch (err) {
    if (err.code === 11000) {
      // Race condition: another worker created or claimed the lock in the same millisecond
      const existing = await SpreadsheetLock.findOne({ spreadsheetId });
      return {
        acquired: false,
        existingLock: existing,
      };
    }
    throw err;
  }
}

/**
 * Renews an active spreadsheet lock lease if the ownerToken matches and lease has not expired.
 *
 * @param {string} spreadsheetId
 * @param {string} ownerToken
 * @param {number} [extensionMs=300000]
 * @returns {Promise<boolean>}
 */
export async function renewSpreadsheetLock(spreadsheetId, ownerToken, extensionMs = 300000) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + extensionMs);

  const updated = await SpreadsheetLock.findOneAndUpdate(
    {
      spreadsheetId,
      ownerToken,
      expiresAt: { $gte: now }, // Only active unexpired locks can be renewed
    },
    {
      $set: { expiresAt },
    },
    { new: true }
  );

  return !!updated;
}

/**
 * Safely releases an exclusive spreadsheet lock.
 * Only releases if the ownerToken matches, protecting against stale workers releasing a new lock.
 *
 * @param {string} spreadsheetId
 * @param {string} ownerToken
 * @returns {Promise<boolean>}
 */
export async function releaseSpreadsheetLock(spreadsheetId, ownerToken) {
  if (!spreadsheetId || !ownerToken) return false;

  const result = await SpreadsheetLock.findOneAndDelete({
    spreadsheetId,
    ownerToken,
  });

  return !!result;
}

/**
 * Verifies if an ownership token currently holds a valid, unexpired lock.
 *
 * @param {string} spreadsheetId
 * @param {string} ownerToken
 * @returns {Promise<boolean>}
 */
export async function isLockActive(spreadsheetId, ownerToken) {
  if (!spreadsheetId || !ownerToken) return false;

  const now = new Date();
  const lock = await SpreadsheetLock.findOne({
    spreadsheetId,
    ownerToken,
    expiresAt: { $gte: now },
  });

  return !!lock;
}

