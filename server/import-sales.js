/**
 * Import historical data from the Sales Team Scorecard CSV.
 * Run once: node import-sales.js
 *
 * Column headers are week RANGES like "03/08 - 03/14" (newest first).
 * The week_start is the start date of each range, with year inferred
 * by counting backwards from today.
 */
const fs   = require('fs');
const path = require('path');

const DB_PATH  = path.join(__dirname, 'db.json');
const CSV_PATH = path.join(
  process.env.HOME,
  'Downloads',
  'Sales Team Scorecard - Scorecard 2.0.csv'
);

// ── Metric definitions ────────────────────────────────────────────────────────
const METRICS = [
  // Team totals
  { key: 'team_total_sales',     label: 'Total Sales',               owner: 'Team', type: 'number',  category: 'Team Totals', goodDirection: 'up',   goal: null },
  { key: 'team_calls_sched',     label: 'Total Calls Scheduled',     owner: 'Team', type: 'number',  category: 'Team Totals', goodDirection: 'up',   goal: null },
  { key: 'team_calls_conducted', label: 'Total Calls Conducted',     owner: 'Team', type: 'number',  category: 'Team Totals', goodDirection: 'up',   goal: null },
  { key: 'team_close_rate',      label: 'Team Close Rate',           owner: 'Team', type: 'percent', category: 'Team Totals', goodDirection: 'up',   goal: null },
  // Abe
  { key: 'abe_sales',            label: 'Number of Sales',           owner: 'Abe',  type: 'number',  category: 'Abe',  goodDirection: 'up',   goal: { operator: '>', value: 6  } },
  { key: 'abe_calls_sched',      label: 'Discovery Calls Scheduled', owner: 'Abe',  type: 'number',  category: 'Abe',  goodDirection: 'up',   goal: { operator: '>', value: 25 } },
  { key: 'abe_calls_conducted',  label: 'Discovery Calls Conducted', owner: 'Abe',  type: 'number',  category: 'Abe',  goodDirection: 'up',   goal: { operator: '>', value: 15 } },
  { key: 'abe_no_shows',         label: 'No Call/No Shows',          owner: 'Abe',  type: 'number',  category: 'Abe',  goodDirection: 'down', goal: { operator: '<', value: 5  } },
  { key: 'abe_not_qualified',    label: 'Not Qualified',             owner: 'Abe',  type: 'number',  category: 'Abe',  goodDirection: 'down', goal: { operator: '<', value: 5  } },
  // Alex
  { key: 'alex_sales',           label: 'Number of Sales',           owner: 'Alex', type: 'number',  category: 'Alex', goodDirection: 'up',   goal: { operator: '>', value: 6  } },
  { key: 'alex_calls_sched',     label: 'Discovery Calls Scheduled', owner: 'Alex', type: 'number',  category: 'Alex', goodDirection: 'up',   goal: { operator: '>', value: 25 } },
  { key: 'alex_calls_conducted', label: 'Discovery Calls Conducted', owner: 'Alex', type: 'number',  category: 'Alex', goodDirection: 'up',   goal: { operator: '>', value: 15 } },
  { key: 'alex_no_shows',        label: 'No Call/No Shows',          owner: 'Alex', type: 'number',  category: 'Alex', goodDirection: 'down', goal: { operator: '<', value: 5  } },
  { key: 'alex_not_qualified',   label: 'Not Qualified',             owner: 'Alex', type: 'number',  category: 'Alex', goodDirection: 'down', goal: { operator: '<', value: 5  } },
  // Gabe
  { key: 'gabe_sales',           label: 'Number of Sales',           owner: 'Gabe', type: 'number',  category: 'Gabe', goodDirection: 'up',   goal: { operator: '>', value: 2  } },
];

// ── CSV helpers ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

function parseValue(str) {
  if (!str) return null;
  const s = str.trim();
  if (s === '' || s === '#DIV/0!' || s === 'N/A') return null;
  // Strip %, $, commas — keep value as-is (30% → 30)
  const clean = s.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

/**
 * Parse column headers like "03/08 - 03/14" into ISO date strings.
 * Headers are newest-first; infer years by tracking month transitions going back.
 */
function parseDateColumns(headers) {
  // Extract start "MM/DD" from each range header
  const parts = headers.map(h => {
    if (!h || !h.includes('-')) return null;
    const start = h.split('-')[0].trim();         // "03/08" or "03/08 "
    const segs  = start.split('/').map(s => parseInt(s, 10));
    if (segs.length < 2 || isNaN(segs[0])) return null;
    return { month: segs[0], day: segs[1] };
  });

  // Walk newest → oldest, decrementing year at December→January transition
  const today   = new Date();
  let refYear   = today.getFullYear();

  const dates = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) { dates.push(null); continue; }

    // On the very first item, if the date would be in the future, drop a year
    if (i === 0) {
      const cand = new Date(`${refYear}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}T12:00:00`);
      if (cand > today) refYear--;
    } else {
      // If the current month is GREATER than the previous month, we crossed Dec→Jan
      // going backwards in time, so decrement the year.
      const prev = parts[i - 1];
      if (prev && p.month > prev.month) refYear--;
    }

    dates.push(`${refYear}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}`);
  }
  return dates;
}

// ── Row identification rules ──────────────────────────────────────────────────
// Each rule: { match: (person, metric, goal) => bool, metricKey: string }
// "person" is the last non-blank person seen.
const ROW_RULES = [
  // Team total rows: person="" metric="" label in cols[2]
  { matchTeam: 'Total Sales',                     key: 'team_total_sales'     },
  { matchTeam: 'Total Discovery Calls Scheduled', key: 'team_calls_sched'     },
  { matchTeam: 'Total Discovery Calls Conducted', key: 'team_calls_conducted' },
  { matchTeam: 'Team Close Rate %',               key: 'team_close_rate'      },
  // Abe
  { person: 'Abe',  metric: 'Number of Sales',             key: 'abe_sales'           },
  { person: 'Abe',  metric: 'Discovery Calls Scheduled',   key: 'abe_calls_sched'     },
  { person: 'Abe',  metric: 'Discovery Calls Conducted',   key: 'abe_calls_conducted' },
  { person: 'Abe',  metric: 'No Call/No Shows',            key: 'abe_no_shows'        },
  { person: 'Abe',  metric: 'Not Qualified',               key: 'abe_not_qualified'   },
  // Alex
  { person: 'Alex', metric: 'Number of Sales',             key: 'alex_sales'          },
  { person: 'Alex', metric: 'Discovery Calls Scheduled',   key: 'alex_calls_sched'    },
  { person: 'Alex', metric: 'Discovery Calls Conducted',   key: 'alex_calls_conducted'},
  { person: 'Alex', metric: 'No Call/No Shows',            key: 'alex_no_shows'       },
  { person: 'Alex', metric: 'Not Qualified',               key: 'alex_not_qualified'  },
  // Gabe — second row only (goal = ">2"), identified by goal string
  { person: 'Gabe', metric: 'Number of Sales', goal: '>2', key: 'gabe_sales'          },
];

// ── Main ──────────────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(23, 59, 59, 999);

const csvText = fs.readFileSync(CSV_PATH, 'utf8');
const lines   = csvText.split('\n').filter(l => l.trim());

// Header: "Sales Team Scorecard,,Weekly Goals,03/08 - 03/14,..."
const header     = parseCSVLine(lines[0]);
const rangeHdrs  = header.slice(3);                        // date ranges at cols[3+]
const isoDatesFwd = parseDateColumns(rangeHdrs);           // newest-first dates

const dateCols = isoDatesFwd
  .map((date, i) => ({ colIndex: i + 3, date }))
  .filter(c => c.date && new Date(c.date + 'T12:00:00') <= today);

console.log(`Found ${dateCols.length} date columns up to today.`);
console.log('  Most recent:', dateCols[0]?.date);
console.log('  Oldest:     ', dateCols[dateCols.length - 1]?.date);

const weekMap = {};
dateCols.forEach(c => { weekMap[c.date] = {}; });

let currentPerson = '';

for (let li = 1; li < lines.length; li++) {
  const cols    = parseCSVLine(lines[li]);
  const rawPerson = cols[0] || '';
  const metric    = cols[1] || '';
  const goalStr   = cols[2] || '';

  // Update running person when a new non-blank name appears
  if (rawPerson) currentPerson = rawPerson;

  // ── Team total rows: person="" metric="" label in cols[2] ──────────────────
  if (!rawPerson && !metric && goalStr) {
    const rule = ROW_RULES.find(r => r.matchTeam && r.matchTeam === goalStr);
    if (rule) {
      dateCols.forEach(c => {
        const val = parseValue(cols[c.colIndex]);
        if (val !== null) weekMap[c.date][rule.key] = val;
      });
    }
    continue;
  }

  // ── Rep rows ───────────────────────────────────────────────────────────────
  const rule = ROW_RULES.find(r => {
    if (r.matchTeam) return false;
    if (r.person !== currentPerson) return false;
    if (r.metric !== metric)        return false;
    if (r.goal !== undefined && r.goal !== goalStr) return false;
    return true;
  });
  if (!rule) continue;

  dateCols.forEach(c => {
    const val = parseValue(cols[c.colIndex]);
    if (val !== null) weekMap[c.date][rule.key] = val;
  });
}

// ── Write to db.json ──────────────────────────────────────────────────────────
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
db.scorecards['sales'].metrics = METRICS;
db.entries['sales'] = {};

let count = 0;
for (const [weekStart, metrics] of Object.entries(weekMap)) {
  if (Object.keys(metrics).length === 0) continue;
  db.entries['sales'][weekStart] = {
    week_start: weekStart,
    entered_by: 'import',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metrics,
  };
  count++;
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`✅  sales: wrote ${count} weekly entries.`);
