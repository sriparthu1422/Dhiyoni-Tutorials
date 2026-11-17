import mongoose from 'mongoose';

const checkpointSchema = new mongoose.Schema(
  {
    lastRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    lastCreatedAt: {
      type: Date,
      default: null,
    },
    processedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isReconciled: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const exportJobSchema = new mongoose.Schema(
  {
    jobId: {
      type: String,
      required: [true, 'Job ID is required'],
      trim: true,
    },
    exportType: {
      type: String,
      enum: ['full', 'incremental', 'category'],
      default: 'full',
      required: true,
    },
    categories: {
      type: [String],
      enum: ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'],
      default: ['contacts', 'parentSignups', 'tutorSignups', 'newsletters', 'feedbacks'],
      required: true,
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requested administrator ID is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
      required: true,
    },
    destination: {
      spreadsheetId: {
        type: String,
        trim: true,
        default: '',
      },
      spreadsheetUrl: {
        type: String,
        trim: true,
        default: '',
      },
      tabs: {
        type: [String],
        default: [],
      },
    },
    recordCounts: {
      contacts: { type: Number, default: 0, min: 0 },
      parentSignups: { type: Number, default: 0, min: 0 },
      tutorSignups: { type: Number, default: 0, min: 0 },
      newsletters: { type: Number, default: 0, min: 0 },
      feedbacks: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 },
    },
    failedCounts: {
      contacts: { type: Number, default: 0, min: 0 },
      parentSignups: { type: Number, default: 0, min: 0 },
      tutorSignups: { type: Number, default: 0, min: 0 },
      newsletters: { type: Number, default: 0, min: 0 },
      feedbacks: { type: Number, default: 0, min: 0 },
      total: { type: Number, default: 0, min: 0 },
    },
    reconciliation: {
      isReconciled: { type: Boolean, default: false },
      databaseTotal: { type: Number, default: 0, min: 0 },
      exportedTotal: { type: Number, default: 0, min: 0 },
      discrepancies: { type: [String], default: [] },
    },
    snapshotTimestamp: {
      type: Date,
      default: null,
    },
    concurrentUpdatesDetected: {
      type: Number,
      default: 0,
      min: 0,
    },
    concurrentDeletionsDetected: {
      type: Number,
      default: 0,
      min: 0,
    },
    stagingTabs: {
      type: [String],
      default: [],
    },
    errorDetails: {
      message: { type: String, default: '' },
      code: { type: String, default: '' },
      timestamp: { type: Date, default: null },
    },
    retryMetadata: {
      retryCount: { type: Number, default: 0, min: 0 },
      maxRetries: { type: Number, default: 3, min: 0 },
      lastRetryAt: { type: Date, default: null },
    },
    checkpoints: {
      type: Map,
      of: checkpointSchema,
      default: () => new Map(),
    },
    concurrencyLock: {
      isLocked: { type: Boolean, default: false },
      lockedAt: { type: Date, default: null },
      lockExpiresAt: { type: Date, default: null },
      lockedBy: { type: String, default: '' },
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
exportJobSchema.index({ jobId: 1 }, { unique: true });
exportJobSchema.index({ status: 1, createdAt: -1 });
exportJobSchema.index({ requestedBy: 1, createdAt: -1 });
exportJobSchema.index({ 'destination.spreadsheetId': 1, 'concurrencyLock.isLocked': 1 });

const ExportJob = mongoose.model('ExportJob', exportJobSchema);

export default ExportJob;

