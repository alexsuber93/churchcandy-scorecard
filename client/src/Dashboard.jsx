import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatValue, calcChange, checkGoal, formatGoal } from './metrics.js';

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export default function Dashboard() {
  const { scorecardId } = useParams();
  const [scorecard, setScorecard] = useState(null);
  const [entries, setEntries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [weekIndex, setWeekIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    setWeekIndex(0);
    Promise.all([
      fetch('/api/scorecards').then(r => r.json()),
      fetch(`/api/scorecards/${scorecardId}/entries`).then(r => r.json()),
    ])
      .then(([scs, ents]) => {
        setScorecard(scs.find(s => s.id === scorecardId) ?? null);
        setEntries(ents);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [scorecardId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Loading…</div>
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400">Scorecard not found.</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <div className="text-5xl">📊</div>
        <h2 className="text-xl font-semibold text-slate-700">No data yet</h2>
        <p className="text-slate-500 max-w-sm">
          Head over to{' '}
          <Link to={`/scorecards/${scorecardId}/entry`} className="text-indigo-600 font-medium">
            Enter Numbers
          </Link>{' '}
          to submit your first weekly scorecard.
        </p>
      </div>
    );
  }

  const sorted   = [...entries].sort((a, b) => b.week_start.localeCompare(a.week_start));
  const maxIdx   = sorted.length - 1;
  const safeIdx  = Math.min(weekIndex, maxIdx);
  const current  = sorted[safeIdx];
  const previous = sorted[safeIdx + 1] ?? null;

  const chartData = [...sorted].reverse().map(e => ({
    week: format(parseISO(e.week_start), 'MMM d'),
    ...e.metrics,
  }));

  const weekLabel    = format(parseISO(current.week_start), 'MMMM d, yyyy');
  const categories   = [...new Set(scorecard.metrics.map(m => m.category).filter(Boolean))];
  const chartMetrics = scorecard.metrics.slice(0, 6);

  return (
    <div className="p-6 space-y-8">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: scorecard.color }} />
            <h1 className="text-2xl font-bold text-slate-800">{scorecard.name}</h1>
          </div>
          <p className="text-slate-500 text-sm">
            Week of {weekLabel}
            {current.entered_by && (
              <span className="ml-2 text-slate-400">· Entered by {current.entered_by}</span>
            )}
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekIndex(i => Math.min(i + 1, maxIdx))}
            disabled={safeIdx >= maxIdx}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setWeekIndex(0)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            Latest
          </button>
          <button
            onClick={() => setWeekIndex(i => Math.max(i - 1, 0))}
            disabled={safeIdx <= 0}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Metric cards ─────────────────────────────────────────────────────── */}
      {scorecard.metrics.length === 0 ? (
        <div className="text-center py-12 text-slate-400 bg-white rounded-xl border border-slate-200">
          <p className="text-lg">No metrics configured.</p>
          <p className="text-sm mt-1">
            Go to <Link to="/admin" className="text-indigo-600">Manage Scorecards</Link> to add metrics.
          </p>
        </div>
      ) : categories.length > 0 ? (
        categories.map(cat => (
          <section key={cat}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{cat}</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {scorecard.metrics.filter(m => m.category === cat).map(metric => (
                <MetricCard
                  key={metric.key}
                  metric={metric}
                  current={current.metrics?.[metric.key]}
                  previous={previous?.metrics?.[metric.key]}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <section>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {scorecard.metrics.map(metric => (
              <MetricCard
                key={metric.key}
                metric={metric}
                current={current.metrics?.[metric.key]}
                previous={previous?.metrics?.[metric.key]}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Trend charts ─────────────────────────────────────────────────────── */}
      {chartData.length > 1 && chartMetrics.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
            Trends (last {chartData.length} weeks)
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {chartMetrics.map((m, i) => (
              <div key={m.key} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
                <p className="text-sm font-medium text-slate-700 mb-3">{m.label}</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                      formatter={(v) => [formatValue(v, m.type), m.label]}
                    />
                    <Line
                      type="monotone"
                      dataKey={m.key}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── MetricCard ────────────────────────────────────────────────────────────────
function MetricCard({ metric, current, previous }) {
  const change    = calcChange(current, previous);
  const hasValue  = current !== null && current !== undefined;
  const goalMet   = checkGoal(current, metric.goal);
  const goalLabel = formatGoal(metric.goal, metric.type);

  // Left border color based on goal status
  const borderClass = goalMet === true  ? 'border-l-4 border-l-emerald-500'
                    : goalMet === false ? 'border-l-4 border-l-red-400'
                    : '';

  // Value text color
  const valueClass = goalMet === true  ? 'text-emerald-600'
                   : goalMet === false ? 'text-red-500'
                   : 'text-slate-800';

  let changeColor = 'text-slate-400';
  let ChangeIcon  = Minus;

  if (change && change.direction !== 'flat') {
    const isGood = metric.goodDirection === 'neutral' ? false
      : metric.goodDirection === 'up' ? change.direction === 'up'
      : change.direction === 'down';
    changeColor = isGood ? 'text-emerald-500' : 'text-red-500';
    ChangeIcon  = change.direction === 'up' ? TrendingUp : TrendingDown;
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow ${borderClass}`}>
      <p className="text-xs text-slate-500 font-medium leading-tight mb-1">{metric.label}</p>
      {metric.owner && <p className="text-xs text-slate-400 mb-2">{metric.owner}</p>}
      <p className={`text-xl font-bold ${valueClass}`}>
        {hasValue ? formatValue(current, metric.type) : '—'}
      </p>
      {change && (
        <div className={`flex items-center gap-1 mt-1.5 ${changeColor}`}>
          <ChangeIcon size={13} />
          <span className="text-xs font-medium">
            {change.pct !== null ? `${change.pct.toFixed(1)}%` : 'vs prev'}
          </span>
        </div>
      )}
      {goalLabel && (
        <p className="text-xs text-slate-400 mt-1.5">{goalLabel}</p>
      )}
    </div>
  );
}
