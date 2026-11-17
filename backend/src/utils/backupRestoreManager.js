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
