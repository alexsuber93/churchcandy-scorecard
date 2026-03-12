// ── Formatting helpers ────────────────────────────────────────────────────────
export function formatValue(value, type) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  switch (type) {
    case 'currency':
      return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    case 'percent':
      return n.toFixed(1) + '%';
    default:
      return n.toLocaleString('en-US');
  }
}

// Returns { direction: 'up'|'down'|'flat', pct: number }
export function calcChange(current, previous) {
  if (current === null || current === undefined) return null;
  if (previous === null || previous === undefined) return null;
  const c = Number(current);
  const p = Number(previous);
  if (p === 0) return { direction: c > 0 ? 'up' : c < 0 ? 'down' : 'flat', pct: null };
  const pct = ((c - p) / Math.abs(p)) * 100;
  return { direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', pct: Math.abs(pct) };
}

// Returns true/false if value meets goal, or null if no goal/no value
export function checkGoal(value, goal) {
  if (!goal || value === null || value === undefined) return null;
  const v = Number(value);
  const g = Number(goal.value);
  switch (goal.operator) {
    case '>':  return v > g;
    case '>=': return v >= g;
    case '<':  return v < g;
    case '<=': return v <= g;
    case '=':  return v === g;
    default:   return null;
  }
}

// Returns human-readable goal string like "Goal: > 13" or "Goal: <= $25"
export function formatGoal(goal, type) {
  if (!goal) return null;
  const val = formatValue(goal.value, type);
  return `Goal: ${goal.operator} ${val}`;
}
