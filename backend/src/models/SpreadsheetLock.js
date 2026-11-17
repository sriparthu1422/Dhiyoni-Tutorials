import mongoose from 'mongoose';

const spreadsheetLockSchema = new mongoose.Schema(
  {
    spreadsheetId: {
      type: String,
      required: [true, 'Spreadsheet ID is required'],
      unique: true,
      trim: true,
    },
    ownerToken: {
      type: String,
      required: [true, 'Owner token is required'],
      trim: true,
    },
    jobId: {
      type: String,
      required: [true, 'Job ID is required'],
      trim: true,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Locked by admin ID is required'],
    },
    lockedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: [true, 'Lock expiration timestamp is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const SpreadsheetLock = mongoose.model('SpreadsheetLock', spreadsheetLockSchema);

export default SpreadsheetLock;
