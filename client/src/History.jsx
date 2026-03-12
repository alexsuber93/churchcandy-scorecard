import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { Download, Trash2 } from 'lucide-react';
import { formatValue } from './metrics.js';

export default function History() {
  const { scorecardId } = useParams();
  const [scorecard, setScorecard] = useState(null);
  const [entries, setEntries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [deleting, setDeleting]   = useState(null);
  const [confirm, setConfirm]     = useState(null);

  useEffect(() => {
    fetch('/api/scorecards')
      .then(r => r.json())
      .then(scs => setScorecard(scs.find(s => s.id === scorecardId) ?? null))
      .catch(() => {});
  }, [scorecardId]);

  const load = () => {
    fetch(`/api/scorecards/${scorecardId}/entries`)
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(load, [scorecardId]);

  const handleDelete = async (weekStart) => {
    setDeleting(weekStart);
    await fetch(`/api/scorecards/${scorecardId}/entries/${weekStart}`, { method: 'DELETE' });
    setConfirm(null);
    setDeleting(null);
    load();
  };

  const exportCSV = () => {
    if (!scorecard) return;
    const headers = ['Week Start', 'Entered By', ...scorecard.metrics.map(m => m.label)];
    const rows = entries.map(e => [
      e.week_start,
      e.entered_by || '',
      ...scorecard.metrics.map(m => e.metrics?.[m.key] ?? ''),
    ]);
    const csv  = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${scorecardId}-history.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  const metrics = scorecard?.metrics ?? [];

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">History</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {scorecard?.name} · {entries.length} week{entries.length !== 1 ? 's' : ''} of data
          </p>
        </div>
        {entries.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Download size={15} />
            Export CSV
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          No entries yet. Add your first week of numbers.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(entry => (
            <div key={entry.week_start} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Week header */}
              <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-200">
                <div>
                  <span className="font-semibold text-slate-800 text-sm">
                    Week of {format(parseISO(entry.week_start), 'MMMM d, yyyy')}
                  </span>
                  {entry.entered_by && (
                    <span className="ml-3 text-xs text-slate-400">by {entry.entered_by}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {confirm === entry.week_start ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-500 font-medium">Delete this week?</span>
                      <button
                        onClick={() => handleDelete(entry.week_start)}
                        disabled={deleting === entry.week_start}
                        className="text-xs bg-red-500 hover:bg-red-600 text-white px-2.5 py-1 rounded-md font-medium transition-colors disabled:opacity-60"
                      >
                        {deleting === entry.week_start ? 'Deleting…' : 'Yes, delete'}
                      </button>
                      <button
                        onClick={() => setConfirm(null)}
                        className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirm(entry.week_start)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Metrics grid */}
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {metrics.map(m => (
                  <div key={m.key}>
                    <p className="text-xs text-slate-400 leading-tight">{m.label}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-0.5">
                      {formatValue(entry.metrics?.[m.key], m.type)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
