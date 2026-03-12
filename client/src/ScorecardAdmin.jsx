import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react';

const TYPES      = ['number', 'currency', 'percent'];
const DIRECTIONS = ['up', 'down', 'neutral'];
const OPERATORS  = ['>', '>=', '<', '<=', '='];

const EMPTY_METRIC = {
  key: '', label: '', owner: '', type: 'number',
  category: '', goodDirection: 'up', goal: null,
};

export default function ScorecardAdmin() {
  const [scorecards, setScorecards]   = useState([]);
  const [activeId, setActiveId]       = useState(null);
  const [editing, setEditing]         = useState(null);   // metric being edited
  const [adding, setAdding]           = useState(false);
  const [newMetric, setNewMetric]     = useState({ ...EMPTY_METRIC });
  const [newSCName, setNewSCName]     = useState('');
  const [newSCColor, setNewSCColor]   = useState('#6366f1');
  const [showNewSC, setShowNewSC]     = useState(false);
  const [editSC, setEditSC]           = useState(false);
  const [scNameEdit, setScNameEdit]   = useState('');
  const [scColorEdit, setScColorEdit] = useState('');

  const load = () => {
    fetch('/api/scorecards')
      .then(r => r.json())
      .then(data => {
        setScorecards(data);
        setActiveId(id => id ?? (data[0]?.id ?? null));
      })
      .catch(() => {});
  };

  useEffect(load, []);

  const activeScorecard = scorecards.find(s => s.id === activeId);

  // ── Scorecard CRUD ──────────────────────────────────────────────────────────
  const createScorecard = async () => {
    if (!newSCName.trim()) return;
    await fetch('/api/scorecards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSCName.trim(), color: newSCColor }),
    });
    setNewSCName('');
    setNewSCColor('#6366f1');
    setShowNewSC(false);
    load();
  };

  const updateScorecard = async () => {
    if (!activeScorecard) return;
    await fetch(`/api/scorecards/${activeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: scNameEdit, color: scColorEdit }),
    });
    setEditSC(false);
    load();
  };

  // ── Metric helpers ──────────────────────────────────────────────────────────
  const saveMetrics = async (metrics) => {
    await fetch(`/api/scorecards/${activeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metrics }),
    });
    load();
  };

  const addMetric = async () => {
    if (!newMetric.label.trim()) return;
    const key = newMetric.key.trim()
      || newMetric.label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '');
    const goal = newMetric.goal?.operator && newMetric.goal?.value !== ''
      ? { operator: newMetric.goal.operator, value: Number(newMetric.goal.value) }
      : null;
    const metric = { ...newMetric, key, goal };
    await saveMetrics([...(activeScorecard.metrics ?? []), metric]);
    setNewMetric({ ...EMPTY_METRIC });
    setAdding(false);
  };

  const deleteMetric = (key) =>
    saveMetrics(activeScorecard.metrics.filter(m => m.key !== key));

  const updateMetric = async (updated) => {
    const goal = updated.goal?.operator && updated.goal?.value !== ''
      ? { operator: updated.goal.operator, value: Number(updated.goal.value) }
      : null;
    const metric = { ...updated, goal };
    await saveMetrics(activeScorecard.metrics.map(m => m.key === metric.key ? metric : m));
    setEditing(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Manage Scorecards</h1>
        <p className="text-slate-500 text-sm mt-0.5">Add, edit, or remove metrics for each scorecard.</p>
      </div>

      <div className="flex gap-6">
        {/* ── Scorecard selector ─────────────────────────────────────────────── */}
        <div className="w-48 flex-shrink-0 space-y-1">
          {scorecards.map(sc => (
            <button
              key={sc.id}
              onClick={() => { setActiveId(sc.id); setEditing(null); setAdding(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${
                sc.id === activeId
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: sc.color }} />
              {sc.name}
            </button>
          ))}

          {showNewSC ? (
            <div className="mt-2 p-3 border border-slate-200 rounded-lg bg-white space-y-2">
              <input
                value={newSCName}
                onChange={e => setNewSCName(e.target.value)}
                placeholder="Scorecard name"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') createScorecard();
                  if (e.key === 'Escape') setShowNewSC(false);
                }}
                className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Color:</label>
                <input
                  type="color"
                  value={newSCColor}
                  onChange={e => setNewSCColor(e.target.value)}
                  className="w-8 h-6 rounded cursor-pointer"
                />
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={createScorecard}
                  className="flex-1 text-xs bg-indigo-600 text-white rounded-md py-1 hover:bg-indigo-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewSC(false)}
                  className="flex-1 text-xs border border-slate-200 text-slate-600 rounded-md py-1 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewSC(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors mt-1"
            >
              <Plus size={14} /> New Scorecard
            </button>
          )}
        </div>

        {/* ── Metrics panel ──────────────────────────────────────────────────── */}
        {activeScorecard && (
          <div className="flex-1 min-w-0">
            {/* Scorecard name/color edit */}
            <div className="flex items-center justify-between mb-4">
              {editSC ? (
                <div className="flex items-center gap-2">
                  <input
                    value={scNameEdit}
                    onChange={e => setScNameEdit(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <input
                    type="color"
                    value={scColorEdit}
                    onChange={e => setScColorEdit(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer"
                  />
                  <button onClick={updateScorecard} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setEditSC(false)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: activeScorecard.color }} />
                  <h2 className="text-lg font-semibold text-slate-800">{activeScorecard.name}</h2>
                  <button
                    onClick={() => { setEditSC(true); setScNameEdit(activeScorecard.name); setScColorEdit(activeScorecard.color); }}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              )}

              <button
                onClick={() => { setAdding(true); setEditing(null); }}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={15} /> Add Metric
              </button>
            </div>

            {/* Add metric form */}
            {adding && (
              <div className="mb-4 bg-white border border-indigo-200 rounded-xl p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">New Metric</h3>
                <MetricForm
                  metric={newMetric}
                  onChange={setNewMetric}
                  onSave={addMetric}
                  onCancel={() => { setAdding(false); setNewMetric({ ...EMPTY_METRIC }); }}
                />
              </div>
            )}

            {/* Metrics table */}
            {activeScorecard.metrics.length === 0 && !adding ? (
              <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
                No metrics yet. Click "Add Metric" to get started.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Label</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Owner</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Category</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Goal</th>
                      <th className="px-4 py-3 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeScorecard.metrics.map(m =>
                      editing?.key === m.key ? (
                        <tr key={m.key} className="bg-indigo-50">
                          <td colSpan={6} className="px-4 py-4">
                            <MetricForm
                              metric={editing}
                              onChange={setEditing}
                              onSave={() => updateMetric(editing)}
                              onCancel={() => setEditing(null)}
                            />
                          </td>
                        </tr>
                      ) : (
                        <tr key={m.key} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-slate-800">{m.label}</td>
                          <td className="px-4 py-3 text-slate-500">{m.owner || '—'}</td>
                          <td className="px-4 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                              {m.type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{m.category || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">
                            {m.goal ? `${m.goal.operator} ${m.goal.value}` : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditing({ ...m, goal: m.goal ?? { operator: '<=', value: '' } });
                                  setAdding(false);
                                }}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => deleteMetric(m.key)}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MetricForm ────────────────────────────────────────────────────────────────
function MetricForm({ metric, onChange, onSave, onCancel }) {
  const [enableGoal, setEnableGoal] = useState(!!metric.goal);

  const set = (field, value) => {
    if (field.startsWith('goal.')) {
      const gField = field.slice(5);
      onChange(prev => ({
        ...prev,
        goal: { ...(prev.goal ?? { operator: '<=', value: '' }), [gField]: value },
      }));
    } else {
      onChange(prev => ({ ...prev, [field]: value }));
    }
  };

  const toggleGoal = (checked) => {
    setEnableGoal(checked);
    onChange(prev => ({
      ...prev,
      goal: checked ? { operator: '<=', value: '' } : null,
    }));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Label *</label>
          <input
            value={metric.label}
            onChange={e => set('label', e.target.value)}
            placeholder="e.g. New Clients Signed"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Owner</label>
          <input
            value={metric.owner}
            onChange={e => set('owner', e.target.value)}
            placeholder="e.g. Abe"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Key (auto-fills)</label>
          <input
            value={metric.key}
            onChange={e => set('key', e.target.value)}
            placeholder="auto-generated"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <select
            value={metric.type}
            onChange={e => set('type', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
          <input
            value={metric.category}
            onChange={e => set('category', e.target.value)}
            placeholder="e.g. Acquisition"
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Good Direction</label>
          <select
            value={metric.goodDirection}
            onChange={e => set('goodDirection', e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="up">Higher is better</option>
            <option value="down">Lower is better</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
      </div>

      {/* Goal target */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={enableGoal}
            onChange={e => toggleGoal(e.target.checked)}
            className="rounded"
          />
          Has Goal Target
        </label>
        {enableGoal && metric.goal && (
          <div className="flex items-center gap-2">
            <select
              value={metric.goal.operator}
              onChange={e => set('goal.operator', e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <input
              type="number"
              value={metric.goal.value}
              onChange={e => set('goal.value', e.target.value)}
              placeholder="Target value"
              className="w-28 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Check size={13} /> Save
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 border border-slate-200 text-slate-600 text-xs font-medium px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}
