import { useState, useEffect, useCallback } from 'react';
import { getExportHistory, CATEGORY_LABELS } from '../services/exportService';

export default function ExportHistoryTab({ onOpenExportModal }) {
  const [historyData, setHistoryData] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedJob, setSelectedJob] = useState(null);
  const [copiedId, setCopiedId] = useState('');
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Load paginated history
  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();

    queueMicrotask(() => {
      if (!ignore) {
        setLoading(true);
        setError('');
      }
    });

    getExportHistory({ page: pagination.page, limit: 10 })
      .then((res) => {
        if (!ignore && res.success) {
          setHistoryData(res.data);
          if (res.pagination) {
            setPagination(res.pagination);
          }
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message || 'Failed to load export history');
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [pagination.page, reloadTrigger]);

  const handleRefresh = useCallback(() => {
    setReloadTrigger((prev) => prev + 1);
  }, []);

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const formatDate = (isoString) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return isoString;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'failed':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200 animate-pulse';
      case 'pending':
      default:
        return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner / Actions Bar */}
      <div className="bg-white p-6 rounded-2xl border border-outline-variant/30 teal-shadow flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-primary text-[28px]">
              table_chart
            </span>
            <h2 className="font-montserrat font-bold text-xl text-primary">
              Google Sheets Export History
            </h2>
          </div>
          <p className="font-inter text-xs text-on-surface-variant mt-1">
            Complete audit trail of all synchronization runs to the authorized Google Spreadsheet
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-outline-variant/60 text-xs font-semibold hover:bg-surface-container transition-all"
            title="Refresh history"
          >
            <span
              className={`material-symbols-outlined text-[18px] ${loading ? 'animate-spin' : ''}`}
            >
              refresh
            </span>
            <span>Refresh</span>
          </button>

          {onOpenExportModal && (
            <button
              onClick={onOpenExportModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-montserrat font-bold text-xs shadow-sm hover:shadow transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">cloud_upload</span>
              <span>New Export</span>
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{error}</span>
          </div>
          <button
            onClick={handleRefresh}
            className="font-bold underline text-rose-900 hover:text-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-outline-variant/30 teal-shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/40 text-on-surface-variant font-montserrat uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4 font-bold">Job ID</th>
                <th className="py-3.5 px-4 font-bold">Initiated At</th>
                <th className="py-3.5 px-4 font-bold">Requested By</th>
                <th className="py-3.5 px-4 font-bold">Collections</th>
                <th className="py-3.5 px-4 font-bold">Total Records</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {loading && historyData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-on-surface-variant">
                    <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-2 text-xs font-semibold">Loading export history...</p>
                  </td>
                </tr>
              ) : historyData.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-on-surface-variant">
                    <span className="material-symbols-outlined text-[36px] text-on-surface-variant/40">
                      folder_open
                    </span>
                    <p className="mt-2 text-sm font-semibold">No export jobs recorded yet</p>
                    <p className="text-xs text-on-surface-variant/70 mt-1">
                      Click &ldquo;New Export&rdquo; to trigger your first Google Sheets synchronization.
                    </p>
                  </td>
                </tr>
              ) : (
                historyData.map((job) => {
                  const total = job.recordCounts
                    ? Object.values(job.recordCounts).reduce(
                        (acc, val) => acc + (Number(val) || 0),
                        0
                      )
                    : 0;

                  return (
                    <tr key={job._id || job.jobId} className="hover:bg-slate-50/70 transition-colors">
                      {/* Job ID */}
                      <td className="py-3.5 px-4 font-mono font-bold text-primary">
                        <div className="flex items-center gap-1.5">
                          <span title={job.jobId} className="truncate max-w-[130px]">
                            {job.jobId}
                          </span>
                          <button
                            onClick={() => copyToClipboard(job.jobId, job.jobId)}
                            className="text-on-surface-variant hover:text-primary transition-colors p-0.5"
                            title="Copy Job ID"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {copiedId === job.jobId ? 'check' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-on-surface whitespace-nowrap">
                        {formatDate(job.createdAt || job.snapshotTimestamp)}
                      </td>

                      {/* Requested By */}
                      <td className="py-3.5 px-4 text-on-surface-variant">
                        {job.requestedBy?.username || job.requestedBy?.email || 'Admin'}
                      </td>

                      {/* Collections */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[220px]">
                          {Array.isArray(job.categories) && job.categories.length > 0 ? (
                            job.categories.map((c) => (
                              <span
                                key={c}
                                className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px] font-medium"
                              >
                                {CATEGORY_LABELS[c] || c}
                              </span>
                            ))
                          ) : (
                            <span className="text-on-surface-variant italic">All</span>
                          )}
                        </div>
                      </td>

                      {/* Total Records */}
                      <td className="py-3.5 px-4 font-montserrat font-bold text-on-surface">
                        {total}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(
                            job.status
                          )}`}
                        >
                          {job.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="px-2.5 py-1 rounded-lg border border-outline-variant/40 hover:bg-surface-container font-semibold text-[11px] text-primary transition-all"
                            title="View Details"
                          >
                            Details
                          </button>
                          {job.destination?.spreadsheetUrl && (
                            <a
                              href={job.destination.spreadsheetUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-lg hover:bg-emerald-50 text-emerald-700 transition-colors"
                              title="Open in Google Sheets"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                open_in_new
                              </span>
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="p-4 bg-surface-container-low border-t border-outline-variant/30 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant font-medium">
              Showing page <span className="font-bold">{pagination.page}</span> of{' '}
              <span className="font-bold">{pagination.totalPages}</span> ({pagination.total} total
              jobs)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={!pagination.hasPrevPage || loading}
                className="px-3 py-1.5 rounded-xl border border-outline-variant/60 font-semibold text-primary hover:bg-surface-container transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={!pagination.hasNextPage || loading}
                className="px-3 py-1.5 rounded-xl border border-outline-variant/60 font-semibold text-primary hover:bg-surface-container transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedJob && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-outline-variant max-w-lg w-full p-6 md:p-8 relative shadow-2xl space-y-5 animate-fade-in-up">
            <button
              onClick={() => setSelectedJob(null)}
              className="absolute top-5 right-5 text-on-surface-variant hover:text-primary transition-colors p-1.5 rounded-full hover:bg-surface-container"
              aria-label="Close details modal"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>

            <div className="border-b border-outline-variant/20 pb-4">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusBadge(
                    selectedJob.status
                  )}`}
                >
                  {selectedJob.status}
                </span>
                <span className="font-mono text-xs font-bold text-primary">
                  {selectedJob.jobId}
                </span>
              </div>
              <h3 className="font-montserrat font-bold text-lg text-primary mt-1">
                Export Job Breakdown
              </h3>
            </div>

            {/* Breakdown per Collection */}
            <div className="space-y-3">
              <h4 className="font-montserrat font-bold text-xs uppercase tracking-wider text-on-surface-variant">
                Synchronized Records
              </h4>
              {selectedJob.recordCounts ? (
                <div className="p-3 bg-slate-50 rounded-2xl border border-outline-variant/40 space-y-2 text-xs">
                  {Object.entries(selectedJob.recordCounts).map(([cat, count]) => (
                    <div key={cat} className="flex items-center justify-between">
                      <span className="text-on-surface font-medium">
                        {CATEGORY_LABELS[cat] || cat}:
                      </span>
                      <span className="font-mono font-bold text-primary">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-on-surface-variant italic">No count details available</p>
              )}
            </div>

            {/* Timestamps */}
            <div className="p-3 bg-surface-container-low rounded-2xl border border-outline-variant/30 text-xs space-y-1 text-on-surface-variant">
              <div>
                <span className="font-semibold">Snapshot: </span>
                {formatDate(selectedJob.snapshotTimestamp || selectedJob.createdAt)}
              </div>
              {selectedJob.startedAt && (
                <div>
                  <span className="font-semibold">Started At: </span>
                  {formatDate(selectedJob.startedAt)}
                </div>
              )}
              {selectedJob.completedAt && (
                <div>
                  <span className="font-semibold">Completed At: </span>
                  {formatDate(selectedJob.completedAt)}
                </div>
              )}
            </div>

            {/* Error Details if Failed */}
            {selectedJob.errorDetails && (
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-rose-900 text-xs space-y-1">
                <p className="font-bold">Error Message:</p>
                <p className="text-[11px] font-mono">{selectedJob.errorDetails.message}</p>
              </div>
            )}

            {/* Spreadsheet Destination */}
            {selectedJob.destination?.spreadsheetUrl && (
              <a
                href={selectedJob.destination.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-montserrat font-bold text-xs shadow-sm hover:shadow transition-all"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                <span>Open in Google Sheets</span>
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
