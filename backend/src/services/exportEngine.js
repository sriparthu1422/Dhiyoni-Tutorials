import Contact from '../models/Contact.js';
import ParentSignup from '../models/ParentSignup.js';
import TutorSignup from '../models/TutorSignup.js';
import Newsletter from '../models/Newsletter.js';
import Feedback from '../models/Feedback.js';
import ExportJob from '../models/ExportJob.js';
import {
  getSheetsClient,
  ensureTabsExist,
  writeStagingSnapshot,
  validateStagingTab,
  publishStagingToProduction,
  cleanupStagingTab,
  appendExportHistoryRow,
} from './googleSheetsService.js';
import {
  isLockActive,
  renewSpreadsheetLock,
  releaseSpreadsheetLock,
} from './lockService.js';

export const EXPORT_TABS = {
  contacts: 'Contact Enquiries',
  parentSignups: 'Parent Registrations',
  tutorSignups: 'Tutor Applications',
  newsletters: 'Newsletter Subscribers',
  feedbacks: 'Feedback',
  history: 'Export History',
};

export const TAB_HEADERS = {
  [EXPORT_TABS.contacts]: [
    'MongoDB ID',
    'Submission ID',
    'Created At',
    'Updated At',
    'Name',
    'Email',
    'Subject',
    'Message',
    'Status',
  ],
  [EXPORT_TABS.parentSignups]: [
    'MongoDB ID',
    'Submission ID',
    'Created At',
    'Updated At',
    'Student Name',
    'Gender',
    'Grade',
    'Subject',
    'Parent Name',
    'Contact Number',
    'Email',
    'City',
    'State',
    'Referral',
    'Status',
  ],
  [EXPORT_TABS.tutorSignups]: [
    'MongoDB ID',
    'Submission ID',
    'Created At',
    'Updated At',
    'Full Name',
    'Gender',
    'Email',
    'Contact Number',
    'DOB',
    'Location',
    'Qualification',
    'Occupation',
    'Experience',
    'Grades',
    'Subjects',
    'Preferred Time',
    'Boards',
    'Has Tech',
    'Status',
  ],
  [EXPORT_TABS.newsletters]: [
    'MongoDB ID',
    'Submission ID',
    'Created At',
    'Updated At',
    'Email',
  ],
  [EXPORT_TABS.feedbacks]: [
    'MongoDB ID',
    'Submission ID',
    'Created At',
    'Updated At',
    'Name',
    'User Type',
    'Email',
    'Contact Number',
    'Rating (1-5)',
    'Message',
  ],
};

const MODEL_MAP = {
  contacts: { model: Contact, tab: EXPORT_TABS.contacts, stagingTab: '_staging_Contact Enquiries', format: formatContactRow },
  parentSignups: { model: ParentSignup, tab: EXPORT_TABS.parentSignups, stagingTab: '_staging_Parent Registrations', format: formatParentRow },
  tutorSignups: { model: TutorSignup, tab: EXPORT_TABS.tutorSignups, stagingTab: '_staging_Tutor Applications', format: formatTutorRow },
  newsletters: { model: Newsletter, tab: EXPORT_TABS.newsletters, stagingTab: '_staging_Newsletter Subscribers', format: formatNewsletterRow },
  feedbacks: { model: Feedback, tab: EXPORT_TABS.feedbacks, stagingTab: '_staging_Feedback', format: formatFeedbackRow },
};

function formatContactRow(doc) {
  return [
    doc._id.toString(),
    doc.submissionId || doc._id.toString(),
    doc.createdAt ? doc.createdAt.toISOString() : '',
    doc.updatedAt ? doc.updatedAt.toISOString() : '',
    doc.name || '',
    doc.email || '',
    doc.subject || '',
    doc.message || '',
    doc.status || 'Pending',
  ];
}

function formatParentRow(doc) {
  return [
    doc._id.toString(),
    doc.submissionId || doc._id.toString(),
    doc.createdAt ? doc.createdAt.toISOString() : '',
    doc.updatedAt ? doc.updatedAt.toISOString() : '',
    doc.studentName || '',
    doc.gender || '',
    doc.grade || '',
    doc.subject || '',
    doc.parentName || '',
    doc.contact || '',
    doc.email || '',
    doc.city || '',
    doc.state || '',
    doc.referral || '',
    doc.status || 'Pending',
  ];
}

function formatTutorRow(doc) {
  return [
    doc._id.toString(),
    doc.submissionId || doc._id.toString(),
    doc.createdAt ? doc.createdAt.toISOString() : '',
    doc.updatedAt ? doc.updatedAt.toISOString() : '',
    doc.fullName || '',
    doc.gender || '',
    doc.email || '',
    doc.contact || '',
    doc.dob || '',
    doc.location || '',
    doc.qualification || '',
    doc.occupation || '',
    doc.experience || '',
    doc.grades || '',
    doc.subjects || '',
    doc.time || '',
    Array.isArray(doc.boards) ? doc.boards.join(', ') : '',
    doc.hasTech ? 'Yes' : 'No',
    doc.status || 'Pending',
  ];
}

function formatNewsletterRow(doc) {
  return [
    doc._id.toString(),
    doc.submissionId || doc._id.toString(),
    doc.createdAt ? doc.createdAt.toISOString() : '',
    doc.updatedAt ? doc.updatedAt.toISOString() : '',
    doc.email || '',
  ];
}

function formatFeedbackRow(doc) {
  return [
    doc._id.toString(),
    doc.submissionId || doc._id.toString(),
    doc.createdAt ? doc.createdAt.toISOString() : '',
    doc.updatedAt ? doc.updatedAt.toISOString() : '',
    doc.name || '',
    doc.userType || '',
    doc.email || '',
    doc.contactNumber || '',
    doc.rating !== undefined ? doc.rating : '',
    doc.message || '',
  ];
}

/**
 * Executes a full snapshot export for an ExportJob using staging-and-controlled-publication.
 *
 * @param {string} jobId - The ExportJob ID
 * @param {string} ownerToken - Lock ownership token
 * @param {Object} [options={}]
 * @param {number} [options.batchSize=500] - Records per keyset batch
 * @returns {Promise<Object>} Updated ExportJob
 */
export async function runExportJob(jobId, ownerToken, options = {}) {
  const { batchSize = 500 } = options;

  const job = await ExportJob.findOne({ jobId });
  if (!job) {
    throw new Error(`Export job ${jobId} not found`);
  }

  const spreadsheetId = job.destination.spreadsheetId;
  const snapshotTimestamp = job.snapshotTimestamp || new Date();

  // Mark job running
  job.status = 'processing';
  job.startedAt = new Date();
  job.snapshotTimestamp = snapshotTimestamp;
  await job.save();

  try {
    // 1. Verify lock is still active
    const lockActive = await isLockActive(spreadsheetId, ownerToken);
    if (!lockActive) {
      const error = new Error('Spreadsheet concurrency lock is expired or invalid');
      error.code = 'LOCK_EXPIRED';
      throw error;
    }

    // 2. Obtain Google Sheets Client
    const sheetsClient = await getSheetsClient();

    // 3. Ensure all 6 production tabs exist in destination spreadsheet
    const allRequiredTabs = [
      EXPORT_TABS.contacts,
      EXPORT_TABS.parentSignups,
      EXPORT_TABS.tutorSignups,
      EXPORT_TABS.newsletters,
      EXPORT_TABS.feedbacks,
      EXPORT_TABS.history,
    ];
    await ensureTabsExist(sheetsClient, spreadsheetId, allRequiredTabs);
    job.destination.tabs = allRequiredTabs;

    const categoriesToExport = job.categories && job.categories.length > 0
      ? job.categories
      : ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'];

    let totalExportedRecords = 0;
    let totalConcurrentUpdates = 0;
    let totalConcurrentDeletions = 0;
    const discrepancies = [];
    const stagingTabsCreated = [];

    // 4. Process each selected collection with keyset traversal into STAGING tabs
    for (const category of categoriesToExport) {
      const config = MODEL_MAP[category];
      if (!config) continue;

      // Renew lease lock periodically between categories
      await renewSpreadsheetLock(spreadsheetId, ownerToken);

      const { model: Model, tab: prodTabName, stagingTab, format: formatFn } = config;
      const headerRow = TAB_HEADERS[prodTabName];
      stagingTabsCreated.push(stagingTab);

      const categoryRows = [];
      let lastCreatedAt = null;
      let lastRecordId = null;
      let hasMore = true;
      let processedCategoryCount = 0;
      let categoryConcurrentUpdates = 0;

      while (hasMore) {
        // Construct keyset filter bounded strictly by snapshotTimestamp (historical cutoff)
        const keysetFilter = {
          createdAt: { $lte: snapshotTimestamp },
        };

        if (lastCreatedAt && lastRecordId) {
          keysetFilter.$or = [
            { createdAt: { $gt: lastCreatedAt } },
            { createdAt: lastCreatedAt, _id: { $gt: lastRecordId } },
          ];
        }

        const batch = await Model.find(keysetFilter)
          .sort({ createdAt: 1, _id: 1 })
          .limit(batchSize)
          .lean();

        if (batch.length === 0) {
          hasMore = false;
          break;
        }

        for (const doc of batch) {
          // Detect concurrent updates occurring after the snapshot cutoff
          if (doc.updatedAt && new Date(doc.updatedAt) > snapshotTimestamp) {
            categoryConcurrentUpdates++;
            totalConcurrentUpdates++;
          }
          categoryRows.push(formatFn(doc));
        }

        processedCategoryCount += batch.length;
        const lastDoc = batch[batch.length - 1];
        lastCreatedAt = lastDoc.createdAt;
        lastRecordId = lastDoc._id;

        if (batch.length < batchSize) {
          hasMore = false;
        }

        // Checkpoint in job
        job.checkpoints.set(category, {
          lastRecordId,
          lastCreatedAt,
          processedCount: processedCategoryCount,
          isReconciled: false,
        });
      }

      // 5. STAGING WRITE: Write data into isolated staging tab
      await writeStagingSnapshot(sheetsClient, spreadsheetId, stagingTab, headerRow, categoryRows);

      // 6. STAGING VALIDATION: Verify row count and data presence in staging before touching production
      const validation = await validateStagingTab(sheetsClient, spreadsheetId, stagingTab, categoryRows.length);
      if (!validation.isValid) {
        throw new Error(
          `Staging validation failed for ${category}: expected ${categoryRows.length} rows, found ${validation.actualRowCount}`
        );
      }

      // 7. Verify lock ownership before publishing to production
      const stillActive = await isLockActive(spreadsheetId, ownerToken);
      if (!stillActive) {
        const error = new Error(`Lock expired before publishing category: ${category}`);
        error.code = 'LOCK_EXPIRED';
        throw error;
      }

      // 8. CONTROLLED PUBLICATION: Publish validated staging data to the production tab
      await publishStagingToProduction(sheetsClient, spreadsheetId, prodTabName, headerRow, categoryRows);

      // 9. CLEANUP: Clear staging tab safely
      await cleanupStagingTab(sheetsClient, spreadsheetId, stagingTab);

      // 10. Reconcile exported count against MongoDB count at snapshotTimestamp
      const dbCountAtSnapshot = await Model.countDocuments({
        createdAt: { $lte: snapshotTimestamp },
      });

      const isCategoryReconciled = dbCountAtSnapshot === processedCategoryCount;
      if (!isCategoryReconciled) {
        if (processedCategoryCount < dbCountAtSnapshot) {
          totalConcurrentDeletions += (dbCountAtSnapshot - processedCategoryCount);
          discrepancies.push(
            `${category}: ${dbCountAtSnapshot - processedCategoryCount} concurrent deletion(s) detected during export`
          );
        } else {
          discrepancies.push(
            `${category}: DB count (${dbCountAtSnapshot}) !== exported rows (${processedCategoryCount})`
          );
        }
      }

      if (categoryConcurrentUpdates > 0) {
        discrepancies.push(
          `${category}: ${categoryConcurrentUpdates} concurrent update(s) detected post-snapshot`
        );
      }

      job.checkpoints.set(category, {
        lastRecordId,
        lastCreatedAt,
        processedCount: processedCategoryCount,
        isReconciled: isCategoryReconciled,
      });

      job.recordCounts[category] = processedCategoryCount;
      totalExportedRecords += processedCategoryCount;
    }

    job.recordCounts.total = totalExportedRecords;
    job.concurrentUpdatesDetected = totalConcurrentUpdates;
    job.concurrentDeletionsDetected = totalConcurrentDeletions;
    job.stagingTabs = stagingTabsCreated;
    job.reconciliation = {
      isReconciled: discrepancies.filter((d) => !d.includes('concurrent update')).length === 0,
      databaseTotal: totalExportedRecords,
      exportedTotal: totalExportedRecords,
      discrepancies,
    };

    job.status = 'completed';
    job.completedAt = new Date();

    // 11. Append audit trail row to Export History tab
    const historyRow = [
      job.jobId,
      job.exportType,
      job.requestedBy ? job.requestedBy.toString() : 'admin',
      job.status,
      job.startedAt.toISOString(),
      job.completedAt.toISOString(),
      job.recordCounts.contacts,
      job.recordCounts.parentSignups,
      job.recordCounts.tutorSignups,
      job.recordCounts.newsletters,
      job.recordCounts.feedbacks,
      job.recordCounts.total,
      discrepancies.length > 0 ? discrepancies.join('; ') : 'Reconciled cleanly',
    ];

    await appendExportHistoryRow(sheetsClient, spreadsheetId, historyRow);

    await job.save();

    // 12. Safely release lock
    await releaseSpreadsheetLock(spreadsheetId, ownerToken);

    return job;
  } catch (err) {
    // Record failure in ExportJob
    job.status = 'failed';
    job.completedAt = new Date();
    job.errorDetails = {
      message: err.message || 'Export failed',
      code: err.code || 'EXPORT_ERROR',
      timestamp: new Date(),
    };
    await job.save();

    // Always attempt safe lock release
    try {
      await releaseSpreadsheetLock(spreadsheetId, ownerToken);
    } catch {
      // Ignore secondary lock release error on failure
    }

    throw err;
  }
}
