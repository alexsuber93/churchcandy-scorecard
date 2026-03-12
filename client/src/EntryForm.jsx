import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { format, startOfWeek, parseISO } from 'date-fns';
import { CheckCircle, AlertCircle, Save, RefreshCw } from 'lucide-react';
import { formatValue } from './metrics.js';

// Scorecards that support Airtable sync, mapped to their sync endpoint
const AIRTABLE_SYNC_ENDPOINTS = {
  'client-success': '/api/sync/client-success',
};

function getMondayISO(date = new Date()) {
  const monday = startOfWeek(date, { weekStartsOn: 1 });
  return format(monday, 'yyyy-MM-dd');
}

export default function EntryForm() {
  const { scorecardId } = useParams();
  const [scorecard, setScorecard]         = useState(null);
  const [weekStart, setWeekStart]         = useState(getMondayISO());
  const [enteredBy, setEnteredBy]         = useState('');
  const [values, setValues]               = useState({});
  const [status, setStatus]               = useState(null); // 'saving' | 'success' | 'error'
  const [existingEntry, setExistingEntry] = useState(null);
  const [syncStatus, setSyncStatus]       = useState(null); // 'syncing' | 'done' | 'error' | null
  const [syncMsg, setSyncMsg]             = useState('');

  // Load scorecard definition
  useEffect(() => {
    fetch('/api/scorecards')
      .then(r => r.json())
      .then(scs => setScorecard(scs.find(s => s.id === scorecardId) ?? null))
      .catch(() => {});
  }, [scorecardId]);

  // Load existing entry when week or scorecard changes
  useEffect(() => {
    if (!weekStart || !scorecardId || !scorecard) return;
    fetch(`/api/scorecards/${scorecardId}/entries/${weekStart}`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          setExistingEntry(data);
          setEnteredBy(data.entered_by || '');
          const prefilled = {};
          scorecard.metrics.forEach(m => {
            const v = data.metrics?.[m.key];
            prefilled[m.key] = v !== null && v !== undefined ? String(v) : '';
          });
          setValues(prefilled);
        } else {
          setExistingEntry(null);
          setValues({});
        }
      })
      .catch(() => {});
  }, [weekStart, scorecardId, scorecard]);

  const handleChange = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch(`/api/scorecards/${scorecardId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart, entered_by: enteredBy, metrics: values }),
      });
      if (!res.ok) throw new Error();
      setStatus('success');
      setTimeout(() => setStatus(null), 4000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus(null), 4000);
    }
  };

  // ── Airtable sync ───────────────────────────────────────────────────────────
  const syncEndpoint = AIRTABLE_SYNC_ENDPOINTS[scorecardId];

  const handleAirtableSync = async () => {
    setSyncStatus('syncing');
    setSyncMsg('');
    try {
      const res  = await fetch(syncEndpoint);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');

      // Merge synced values into form (only override empty fields unless user confirms)
      const synced = {};
      let filled = 0;
      if (scorecard) {
        scorecard.metrics.forEach(m => {
          if (data[m.key] !== undefined && data[m.key] !== null) {
            synced[m.key] = String(data[m.key]);
            filled++;
          }
        });
      }
      setValues(prev => ({ ...prev, ...synced }));

      const meta = data._meta;
      setSyncMsg(`Filled ${filled} fields from ${meta?.total_records_scanned ?? '?'} Airtable records.`);
      setSyncStatus('done');
      setTimeout(() => { setSyncStatus(null); setSyncMsg(''); }, 6000);
    } catch (err) {
      setSyncMsg(err.message || 'Sync failed');
      setSyncStatus('error');
      setTimeout(() => { setSyncStatus(null); setSyncMsg(''); }, 6000);
    }
  };

  if (!scorecard) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  const categories    = [...new Set(scorecard.metrics.map(m => m.category).filter(Boolean))];
  const uncategorized = scorecard.metrics.filter(m => !m.category);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enter Weekly Numbers</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {scorecard.name} · Fill in the metrics for the selected week.
          </p>
        </div>

        {/* Airtable sync button — only shown for supported scorecards */}
        {syncEndpoint && (
          <button
            type="button"
            onClick={handleAirtableSync}
            disabled={syncStatus === 'syncing'}
            className="flex items-center gap-2 disabled:opacity-60 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors shrink-0" style={{ backgroundColor: '#FF7A1A' }}
          >
            <RefreshCw size={14} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            {syncStatus === 'syncing' ? 'Syncing…' : 'Import from Airtable'}
          </button>
        )}
      </div>

      {/* Sync status banner */}
      {syncStatus === 'done' && syncMsg && (
        <div className="mb-4 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 text-sm">
          <CheckCircle size={15} />
          <span>{syncMsg} Review values below, then save.</span>
        </div>
      )}
      {syncStatus === 'error' && syncMsg && (
        <div className="mb-4 flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm">
          <AlertCircle size={15} />
          <span>{syncMsg}</span>
          {syncMsg.includes('AIRTABLE_API_KEY') && (
            <span className="ml-1 text-slate-500">
              — Add your token to <code className="font-mono bg-slate-100 px-1 rounded">server/.env</code>
            </span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Week & name ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">
                Week (starting Monday)
              </label>
              <input
                type="date"
                value={weekStart}
                onChange={e => setWeekStart(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              {weekStart && (
                <p className="text-xs text-slate-400 mt-1">
                  Week of {format(parseISO(weekStart), 'MMMM d, yyyy')}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Entered by</label>
              <input
                type="text"
                value={enteredBy}
                onChange={e => setEnteredBy(e.target.value)}
                placeholder="Your name"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
          </div>
          {existingEntry && (
            <div className="mt-3 flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
              <AlertCircle size={14} />
              <span>This week already has data. Submitting will update it.</span>
            </div>
          )}
        </div>

        {/* ── Metrics ──────────────────────────────────────────────────── */}
        {scorecard.metrics.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-white rounded-xl border border-slate-200">
            No metrics configured for this scorecard.
          </div>
        ) : (
          <>
            {categories.map(cat => (
              <MetricSection
                key={cat}
                title={cat}
                metrics={scorecard.metrics.filter(m => m.category === cat)}
                values={values}
                onChange={handleChange}
              />
            ))}
            {uncategorized.length > 0 && (
              <MetricSection
                title="Metrics"
                metrics={uncategorized}
                values={values}
                onChange={handleChange}
              />
            )}
          </>
        )}

        {/* ── Submit ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pb-8">
          {status === 'success' && (
            <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
              <CheckCircle size={16} /> Saved successfully!
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-500 text-sm font-medium">
              <AlertCircle size={16} /> Error saving. Is the server running?
            </div>
          )}
          {!status && <div />}

          <button
            type="submit"
            disabled={status === 'saving'}
            className="flex items-center gap-2 disabled:opacity-60 text-white font-medium text-sm px-5 py-2.5 rounded-lg transition-colors" style={{ backgroundColor: '#2F2F8F' }}
          >
            <Save size={15} />
            {status === 'saving' ? 'Saving…' : existingEntry ? 'Update Entry' : 'Save Entry'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── MetricSection ─────────────────────────────────────────────────────────────
function MetricSection({ title, metrics, values, onChange }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
      </div>
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {metrics.map(metric => (
          <div key={metric.key}>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              {metric.label}
              {metric.owner && (
                <span className="ml-1 text-slate-400 font-normal">({metric.owner})</span>
              )}
              <span className="ml-1 text-slate-400 font-normal">
                {metric.type === 'currency' ? '($)' : metric.type === 'percent' ? '(%)' : '(#)'}
              </span>
            </label>
            <input
              type="number"
              step={metric.type === 'percent' || metric.type === 'currency' ? '0.01' : '1'}
              min="0"
              value={values[metric.key] ?? ''}
              onChange={e => onChange(metric.key, e.target.value)}
              placeholder="—"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
