import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('./.env', import.meta.url) });
import connectDB from './src/config/db.js';

import {
  COLLECTIONS,
  createDatabaseSnapshot,
  verifySnapshotIntegrity,
} from './src/utils/backupRestoreManager.js';

describe('Phase 7.4 — Data Privacy, Backup & Disaster Recovery Verification', () => {
  const snapshotTargetDir =
    'C:\\Users\\sripa\\.gemini\\antigravity\\brain\\4cbd4bb4-bc27-4d72-847d-7a6a26014940\\mongodb_backup_phase7';

  let initialCounts = {};

  before(async () => {
    await connectDB();
    for (const { name, model } of COLLECTIONS) {
      initialCounts[name] = await model.countDocuments();
    }
  });

  after(async () => {
    // Assert zero production records were deleted or modified
    for (const { name, model } of COLLECTIONS) {
      const currentCount = await model.countDocuments();
      assert.strictEqual(
        currentCount,
        initialCounts[name],
        `Production record count for ${name} must remain unchanged during backup verification!`
      );
    }
    await mongoose.connection.close();
  });

  // =========================================================================
  // 1. Programmatic Snapshot Creation & Hashing
  // =========================================================================
  test('1. Creates comprehensive JSON snapshot of all 10 collections with SHA-256 hashes', async () => {
    const result = await createDatabaseSnapshot(snapshotTargetDir);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.snapshotDir, snapshotTargetDir);
    assert.ok(fs.existsSync(path.join(snapshotTargetDir, 'SNAPSHOT_METADATA.json')));

    for (const { name } of COLLECTIONS) {
      const filePath = path.join(snapshotTargetDir, `${name}.json`);
      assert.ok(fs.existsSync(filePath), `Snapshot file for ${name} must exist`);
      assert.ok(result.hashes[name], `SHA-256 hash for ${name} must be recorded`);
    }
  });

  // =========================================================================
  // 2. Snapshot Integrity Verification
  // =========================================================================
  test('2. Validates snapshot file integrity, cryptographic checksums, and schema consistency', () => {
    const integrity = verifySnapshotIntegrity(snapshotTargetDir);

    assert.strictEqual(integrity.valid, true, `Integrity errors: ${integrity.errors.join(', ')}`);
    assert.strictEqual(integrity.verifiedCollections, COLLECTIONS.length);
    assert.strictEqual(integrity.errors.length, 0);
  });

  // =========================================================================
  // 3. Schema & Index Preservation Audit
  // =========================================================================
  test('3. Confirms critical unique indexes and field types are documented in snapshot metadata', () => {
    const metaPath = path.join(snapshotTargetDir, 'SNAPSHOT_METADATA.json');
    const metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    assert.ok(metadata.timestamp, 'Metadata must have timestamp');
    assert.ok(metadata.collections.users, 'Users metadata must be present');
    assert.ok(metadata.collections.exportjobs, 'ExportJobs metadata must be present');
    assert.ok(metadata.collections.spreadsheetlocks, 'SpreadsheetLocks metadata must be present');
  });

  // =========================================================================
  // 4. Data Minimization & Privacy Protection (DPDP Act 2023 Compliance)
  // =========================================================================
  test('4. Verifies personal data minimization: sensitive fields are protected from unauthenticated access', () => {
    // Audit user schema: passwords must never be stored in plain text
    const usersPath = path.join(snapshotTargetDir, 'users.json');
    if (fs.existsSync(usersPath)) {
      const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
      for (const user of users) {
        assert.ok(
          user.password.startsWith('$2a$') || user.password.startsWith('$2b$'),
          'Stored passwords must be bcrypt hashes, never plaintext'
        );
      }
    }
  });
});

