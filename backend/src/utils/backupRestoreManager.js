import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import mongoose from 'mongoose';

import Contact from '../models/Contact.js';
import ParentSignup from '../models/ParentSignup.js';
import TutorSignup from '../models/TutorSignup.js';
import Newsletter from '../models/Newsletter.js';
import Feedback from '../models/Feedback.js';
import Tutor from '../models/Tutor.js';
import Gallery from '../models/Gallery.js';
import ExportJob from '../models/ExportJob.js';
import SpreadsheetLock from '../models/SpreadsheetLock.js';
import User from '../models/User.js';

export const COLLECTIONS = [
  { name: 'contacts', model: Contact },
  { name: 'parentsignups', model: ParentSignup },
  { name: 'tutorsignups', model: TutorSignup },
  { name: 'newsletters', model: Newsletter },
  { name: 'feedbacks', model: Feedback },
  { name: 'tutors', model: Tutor },
  { name: 'galleries', model: Gallery },
  { name: 'exportjobs', model: ExportJob },
  { name: 'spreadsheetlocks', model: SpreadsheetLock },
  { name: 'users', model: User },
];

/**
 * Creates an isolated snapshot backup of all application collections.
 *
 * @param {string} targetDir - Directory where snapshot files will be written
 * @returns {Promise<{ success: boolean, snapshotDir: string, counts: Record<string, number>, hashes: Record<string, string> }>}
 */
export async function createDatabaseSnapshot(targetDir) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const counts = {};
  const hashes = {};
  const metadata = {
    timestamp: new Date().toISOString(),
    databaseName: mongoose.connection.name,
    collections: {},
  };

  for (const { name, model } of COLLECTIONS) {
    const docs = await model.find().lean();
    const rawJson = JSON.stringify(docs, null, 2);
    const filePath = path.join(targetDir, `${name}.json`);

    fs.writeFileSync(filePath, rawJson, 'utf8');

    const hash = crypto.createHash('sha256').update(rawJson).digest('hex');
    counts[name] = docs.length;
    hashes[name] = hash;

    // Get collection indexes
    let indexes = [];
    try {
      indexes = await model.collection.indexes();
    } catch {
      // Ignored if collection has not been created yet
    }

    metadata.collections[name] = {
      count: docs.length,
      sha256: hash,
      indexes,
    };
  }

  const metaPath = path.join(targetDir, 'SNAPSHOT_METADATA.json');
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), 'utf8');

  return {
    success: true,
    snapshotDir: targetDir,
    counts,
    hashes,
    metadata,
  };
}

/**
 * Verifies snapshot restore integrity in an isolated validation routine
 * without modifying any live production records.
 *
 * @param {string} snapshotDir - Directory containing snapshot JSON files
 * @returns {{ valid: boolean, verifiedCollections: number, totalRecords: number, errors: string[] }}
 */
export function verifySnapshotIntegrity(snapshotDir) {
  const metaPath = path.join(snapshotDir, 'SNAPSHOT_METADATA.json');
  if (!fs.existsSync(metaPath)) {
    return { valid: false, errors: ['SNAPSHOT_METADATA.json not found'] };
  }

  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const errors = [];
  let totalRecords = 0;
  let verifiedCollections = 0;

  for (const { name } of COLLECTIONS) {
    const filePath = path.join(snapshotDir, `${name}.json`);
    if (!fs.existsSync(filePath)) {
      errors.push(`Missing snapshot file for ${name}`);
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const calculatedHash = crypto.createHash('sha256').update(raw).digest('hex');
    const expectedHash = metadata.collections[name]?.sha256;

    if (calculatedHash !== expectedHash) {
      errors.push(`Hash mismatch for ${name}: expected ${expectedHash}, calculated ${calculatedHash}`);
      continue;
    }

    const parsedDocs = JSON.parse(raw);
    if (!Array.isArray(parsedDocs)) {
      errors.push(`${name}.json does not contain a JSON array`);
      continue;
    }

    totalRecords += parsedDocs.length;
    verifiedCollections++;
  }

  return {
    valid: errors.length === 0,
    verifiedCollections,
    totalRecords,
    errors,
  };
}

/**
 * Hydrates raw JSON documents with appropriate BSON types (ObjectId, Date).
 *
 * @param {Object} doc - Raw parsed JSON document
 * @returns {Object} Document with proper BSON types
 */
export function hydrateBsonTypes(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const hydrated = Array.isArray(doc) ? [] : {};

  for (const [key, value] of Object.entries(doc)) {
    if (value && typeof value === 'object') {
      hydrated[key] = hydrateBsonTypes(value);
    } else if (typeof value === 'string') {
      // 1. Cast 24-char hex strings for _id or ObjectId references
      if (key === '_id' || key === 'requestedBy' || key === 'lockedBy') {
        if (/^[0-9a-fA-F]{24}$/.test(value)) {
          hydrated[key] = new mongoose.Types.ObjectId(value);
          continue;
        }
      }
      // 2. Cast ISO date strings
      if (
        (key.endsWith('At') || key.endsWith('Timestamp') || key === 'dob') &&
        /^\d{4}-\d{2}-\d{2}/.test(value)
      ) {
        const parsedDate = new Date(value);
        if (!isNaN(parsedDate.getTime())) {
          hydrated[key] = parsedDate;
          continue;
        }
      }
      hydrated[key] = value;
    } else {
      hydrated[key] = value;
    }
  }
  return hydrated;
}

/**
 * Restores a snapshot into an ISOLATED test database connection.
 * Strictly forbids restoring over the production database.
 *
 * @param {Object} options
 * @param {string} options.snapshotDir - Directory containing snapshot JSON files
 * @param {mongoose.Connection} options.targetConnection - Isolated mongoose connection
 * @returns {Promise<{ success: boolean, targetDatabase: string, restoredCollections: Record<string, number>, totalRestored: number }>}
 */
export async function restoreToIsolatedDatabase({ snapshotDir, targetConnection }) {
  if (!targetConnection || !targetConnection.name) {
    throw new Error('Valid isolated targetConnection is required');
  }

  // Strict safety check: Never restore to production database!
  const targetDbName = targetConnection.name.toLowerCase();
  const prodDbMatch = (process.env.MONGODB_URI || '').match(/\/([a-zA-Z0-9_-]+)\?/);
  const prodDbName = prodDbMatch ? prodDbMatch[1].toLowerCase() : 'dhiyoni';

  if (targetDbName === prodDbName && !targetDbName.includes('test') && !targetDbName.includes('isolated')) {
    throw new Error(
      `SAFETY BLOCK: Cannot restore over production database "${targetConnection.name}". Only isolated test databases are allowed.`
    );
  }

  const metaPath = path.join(snapshotDir, 'SNAPSHOT_METADATA.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`SNAPSHOT_METADATA.json not found in ${snapshotDir}`);
  }

  const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const restoredCollections = {};
  let totalRestored = 0;

  for (const { name } of COLLECTIONS) {
    const filePath = path.join(snapshotDir, `${name}.json`);
    if (!fs.existsSync(filePath)) continue;

    const rawDocs = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const targetColl = targetConnection.collection(name);

    // Clear existing docs in isolated test collection
    await targetColl.deleteMany({});

    if (rawDocs.length > 0) {
      const hydratedDocs = rawDocs.map((d) => hydrateBsonTypes(d));
      await targetColl.insertMany(hydratedDocs, { ordered: true });
    }

    // Recreate indexes recorded in metadata
    const recordedIndexes = metadata.collections[name]?.indexes || [];
    for (const idx of recordedIndexes) {
      if (idx.name !== '_id_') {
        const options = {};
        if (idx.unique) options.unique = true;
        if (idx.sparse) options.sparse = true;
        if (idx.expireAfterSeconds !== undefined) options.expireAfterSeconds = idx.expireAfterSeconds;
        try {
          await targetColl.createIndex(idx.key, options);
        } catch {
          // Ignore index warning if already exists
        }
      }
    }

    restoredCollections[name] = rawDocs.length;
    totalRestored += rawDocs.length;
  }

  return {
    success: true,
    targetDatabase: targetConnection.name,
    restoredCollections,
    totalRestored,
  };
}

