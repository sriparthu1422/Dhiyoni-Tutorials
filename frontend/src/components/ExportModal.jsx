import { useState } from 'react';
import {
  VALID_CATEGORIES,
  CATEGORY_LABELS,
  initiateExport,
} from '../services/exportService';

export default function ExportModal({ isOpen, onClose, onExportStarted }) {
  const [selectedCategories, setSelectedCategories] = useState([...VALID_CATEGORIES]);
  const [isAllSelected, setIsAllSelected] = useState(true);
  const [isInitiating, setIsInitiating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [conflictJob, setConflictJob] = useState(null);

  if (!isOpen) return null;

  const handleToggleAll = (checked) => {
    setIsAllSelected(checked);
    if (checked) {
      setSelectedCategories([...VALID_CATEGORIES]);
    } else {
      setSelectedCategories([]);
    }
    setErrorMessage('');
  };

  const handleCategoryToggle = (category) => {
    let updated;
    if (selectedCategories.includes(category)) {
      updated = selectedCategories.filter((c) => c !== category);
    } else {
      updated = [...selectedCategories, category];
    }
    setSelectedCategories(updated);
    setIsAllSelected(updated.length === VALID_CATEGORIES.length);
    setErrorMessage('');
  };

  const handleStartExport = async () => {
    if (selectedCategories.length === 0) {
      setErrorMessage('Please select at least one collection to export.');
      return;
    }

    setIsInitiating(true);
    setErrorMessage('');
    setConflictJob(null);

    try {
      const result = await initiateExport({
        categories: selectedCategories,
      });

      if (onExportStarted) {
        onExportStarted(result);
      }
      onClose();
    } catch (err) {
      if (err.status === 409) {
        setConflictJob({
          activeJobId: err.activeJobId,
          lockedAt: err.lockedAt,
          expiresAt: err.expiresAt,
        });
        setErrorMessage(
          err.message || 'Another export is currently in progress. Please wait for it to complete.'
        );
      } else {
        setErrorMessage(err.message || 'Failed to start export. Please try again.');
      }
    } finally {
      setIsInitiating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div className="bg-white rounded-3xl border border-outline-variant max-w-lg w-full p-6 md:p-8 relative shadow-2xl space-y-6 animate-fade-in-up">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isInitiating}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-full hover:bg-surface-container disabled:opacity-50"
          aria-label="Close export modal"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>

        {/* Header */}
        <div className="space-y-2 border-b border-outline-variant/20 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[24px]">table_chart</span>
            </div>
            <div>
              <h2 id="export-modal-title" className="font-montserrat font-bold text-xl text-primary">
                Export to Google Sheets
              </h2>
              <p className="font-inter text-xs text-on-surface-variant">
                One-click synchronization of MongoDB submissions to Google Spreadsheet
              </p>
            </div>
          </div>
        </div>

        {/* Destination Info Box */}
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
          <span className="material-symbols-outlined text-emerald-700 text-[20px] mt-0.5 shrink-0">
            verified
          </span>
          <div className="text-xs text-emerald-900 leading-relaxed">
            <span className="font-bold">Destination Spreadsheet:</span>
            <p className="font-semibold text-emerald-800">Dhiyoni Tutorials Website Submissions</p>
            <p className="text-[11px] text-emerald-700 mt-0.5">
              Exports are safely staged and published atomically without interrupting viewers.
            </p>
          </div>
        </div>

        {/* Error / Conflict Alert */}
        {errorMessage && (
          <div
            className={`p-4 rounded-2xl border text-xs leading-relaxed space-y-1.5 ${
              conflictJob
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2 font-bold">
              <span className="material-symbols-outlined text-[18px]">
                {conflictJob ? 'warning' : 'error'}
              </span>
              <span>{conflictJob ? 'Concurrent Export Active' : 'Export Request Failed'}</span>
            </div>
            <p>{errorMessage}</p>
            {conflictJob?.activeJobId && (
              <p className="font-mono text-[11px] text-amber-800 pt-1">
                Active Job ID: <span className="font-bold">{conflictJob.activeJobId}</span>
              </p>
            )}
          </div>
        )}

        {/* Scope Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-montserrat font-bold text-xs uppercase text-on-surface-variant tracking-wider">
              Select Collections to Export
            </label>
            <span className="text-xs text-on-surface-variant">
              {selectedCategories.length} of {VALID_CATEGORIES.length} selected
            </span>
          </div>

          {/* Select All Option */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-outline-variant/40 bg-surface-container-low hover:bg-surface-container transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={isAllSelected}
              onChange={(e) => handleToggleAll(e.target.checked)}
              disabled={isInitiating}
              className="w-4 h-4 text-emerald-600 rounded border-outline-variant focus:ring-emerald-500 cursor-pointer"
            />
            <span className="font-montserrat font-bold text-sm text-primary">
              All Collections (Recommended)
            </span>
          </label>

          {/* Individual Category Checkboxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {VALID_CATEGORIES.map((cat) => {
              const checked = selectedCategories.includes(cat);
              return (
                <label
                  key={cat}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                    checked
                      ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950 font-semibold'
                      : 'border-outline-variant/30 text-on-surface hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleCategoryToggle(cat)}
                    disabled={isInitiating}
                    className="w-4 h-4 text-emerald-600 rounded border-outline-variant focus:ring-emerald-500 cursor-pointer"
                  />
                  <span>{CATEGORY_LABELS[cat] || cat}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isInitiating}
            className="px-4 py-2.5 rounded-xl border border-outline-variant/50 text-on-surface font-semibold text-xs hover:bg-surface-container transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStartExport}
            disabled={isInitiating || selectedCategories.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-montserrat font-bold text-xs shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isInitiating ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Initiating...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                <span>Start Export</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

