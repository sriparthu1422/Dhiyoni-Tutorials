import { useState, useEffect } from 'react';
import { getExportJobStatus, CATEGORY_LABELS } from '../services/exportService';

const ACTIVE_JOB_STORAGE_KEY = 'dhiyoni_active_export_jobId';

export default function ExportStatusTracker({
  jobId,
  initialData = null,
  onJobComplete,
  onDismiss,
}) {
  const [job, setJob] = useState(initialData);
  const [pollError, setPollError] = useState('');
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    try {
      sessionStorage.setItem(ACTIVE_JOB_STORAGE_KEY, jobId);
    } catch {
      // Ignore storage errors in restricted contexts
    }

    let isSubscribed = true;
    let timer = null;

    const fetchCurrentStatus = async () => {
      try {
        const res = await getExportJobStatus(jobId);
        if (isSubscribed && res.success && res.data) {
          setJob(res.data);
          setPollError('');

          if (res.data.status === 'completed' && onJobComplete) {
            onJobComplete(res.data);
          }

          if (res.data.status === 'completed' || res.data.status === 'failed') {
            if (timer) {
              clearInterval(timer);
              timer = null;
            }
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setPollError(err.message || 'Unable to update export progress');
        }
      }
    };

    // Immediate status check
    fetchCurrentStatus();

    const startPolling = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        fetchCurrentStatus();
      }, 2500);
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchCurrentStatus();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [jobId, onJobComplete]);

  if (!jobId && !job) return null;

  const handleDismiss = () => {
    try {
      sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    } catch {
      // Ignore
    }
    if (onDismiss) onDismiss();
  };

  const status = job?.status || 'pending';
  const spreadsheetUrl =
    job?.destination?.spreadsheetUrl ||
    (job?.destination?.spreadsheetId
      ? `https://docs.google.com/spreadsheets/d/${job.destination.spreadsheetId}`
      : null);

  const totalRecords = job?.recordCounts
    ? Object.values(job.recordCounts).reduce((acc, count) => acc + (Number(count) || 0), 0)
    : 0;

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-md w-full shadow-2xl rounded-2xl overflow-hidden border border-outline-variant bg-white animate-fade-in-up">
      {/* Tracker Header Bar */}
      <div
        className={`px-4 py-3 flex items-center justify-between text-white ${
          status === 'completed'
            ? 'bg-emerald-600'
            : status === 'failed'
            ? 'bg-rose-600'
            : 'bg-primary'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {status === 'completed' ? (
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
          ) : status === 'failed' ? (
            <span className="material-symbols-outlined text-[20px]">error</span>
          ) : (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
          )}
          <span className="font-montserrat font-bold text-xs">
            {status === 'completed'
              ? 'Export Completed'
              : status === 'failed'
              ? 'Export Failed'
              : status === 'processing'
              ? 'Exporting to Google Sheets...'
              : 'Export Queued'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
            aria-label={expanded ? 'Collapse tracker' : 'Expand tracker'}
          >
            <span className="material-symbols-outlined text-[18px]">
              {expanded ? 'expand_more' : 'expand_less'}
            </span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors text-white"
            aria-label="Dismiss export notification"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      </div>

      {/* Tracker Body (Expandable) */}
      {expanded && (
        <div className="p-4 space-y-3.5 text-xs bg-slate-50/50">
          <div className="flex items-center justify-between text-on-surface-variant">
            <span className="font-mono text-[11px] truncate max-w-[200px]" title={jobId}>
              Job: {jobId}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                status === 'completed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : status === 'failed'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {status}
            </span>
          </div>

          {/* Progress / Status Description */}
          {status === 'pending' && (
            <div className="space-y-1.5 text-on-surface-variant">
              <p>Acquiring exclusive spreadsheet lock and preparing snapshot...</p>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-1/4 h-full bg-primary rounded-full animate-pulse"></div>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="space-y-1.5 text-on-surface-variant">
              <p>Writing staging snapshot to Google Sheets and publishing tabs...</p>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-blue-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          )}

          {/* Completed State: Counts Breakdown */}
          {status === 'completed' && (
            <div className="space-y-2.5">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-emerald-900">
                  <span>Total Records Exported:</span>
                  <span className="text-sm font-montserrat">{totalRecords}</span>
                </div>
                {job?.recordCounts && (
                  <div className="pt-1.5 border-t border-emerald-200/60 space-y-1 text-[11px] text-emerald-800">
                    {Object.entries(job.recordCounts).map(([cat, count]) => (
                      <div key={cat} className="flex items-center justify-between">
                        <span>{CATEGORY_LABELS[cat] || cat}:</span>
                        <span className="font-mono font-semibold">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {spreadsheetUrl && (
                <a
                  href={spreadsheetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-montserrat font-bold text-xs shadow-sm hover:shadow transition-all"
                >
                  <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                  <span>Open Google Spreadsheet</span>
                </a>
              )}
            </div>
          )}

          {/* Failed State: Error Details */}
          {status === 'failed' && (
            <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-900 space-y-1">
              <p className="font-bold">Export failed during execution:</p>
              <p className="text-[11px]">{job?.errorDetails?.message || 'Unknown error occurred'}</p>
            </div>
          )}

          {pollError && (
            <p className="text-[11px] text-amber-600 italic">Notice: {pollError}</p>
          )}

          {/* Dismiss Action */}
          <div className="flex justify-end pt-1">
            <button
              onClick={handleDismiss}
              className="text-[11px] text-on-surface-variant hover:text-primary font-semibold underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
