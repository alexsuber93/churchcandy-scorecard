/**
 * Import historical data from the Client Success CSV.
 * Run once: node import-client-success.js
 */
const fs   = require('fs');
const path = require('path');

const DB_PATH  = path.join(__dirname, 'db.json');
const CSV_PATH = path.join(
  process.env.HOME,
  'Downloads',
  '2026 - Client Success Scorecard - Master AM Scorecard 1.csv'
);

// ── Metric definitions ────────────────────────────────────────────────────────
const METRICS = [
  { key: 'total_clients_incl_paused',    label: 'Total Clients (Incl. Paused)',    owner: '', type: 'number',  category: 'Client Counts',   goodDirection: 'up',   goal: { operator: '>=', value: 600  } },
  { key: 'total_active_clients',         label: 'Total Active Clients',            owner: '', type: 'number',  category: 'Client Counts',   goodDirection: 'up',   goal: { operator: '>=', value: 550  } },
  { key: 'issues_submitted',             label: 'Issues Submitted',                owner: '', type: 'number',  category: 'Client Health',   goodDirection: 'down', goal: { operator: '<=', value: 15   } },
  { key: 'clients_cancelled_paused',     label: 'Clients Cancelled/Paused',        owner: '', type: 'number',  category: 'Client Health',   goodDirection: 'down', goal: { operator: '<=', value: 5    } },
  { key: 'pct_purple_chi',               label: '% Clients in Purple CHI',         owner: '', type: 'percent', category: 'CHI Distribution', goodDirection: 'up',  goal: { operator: '>=', value: 15 } },
  { key: 'pct_green_chi',                label: '% Clients in Green CHI',          owner: '', type: 'percent', category: 'CHI Distribution', goodDirection: 'up',  goal: { operator: '>=', value: 60 } },
  { key: 'pct_yellow_chi',               label: '% Clients in Yellow CHI',         owner: '', type: 'percent', category: 'CHI Distribution', goodDirection: 'down', goal: { operator: '<=', value: 20 } },
  { key: 'pct_red_chi',                  label: '% Clients in Red CHI',            owner: '', type: 'percent', category: 'CHI Distribution', goodDirection: 'down', goal: { operator: '<=', value: 5 } },
  { key: 'clients_over_1wk_setting_up',  label: 'Clients Over 1 Wk Setting Up',   owner: '', type: 'number',  category: 'Pipeline',        goodDirection: 'down', goal: { operator: '<=', value: 5    } },
  { key: 'clients_inactive_ads',         label: 'Clients with Inactive Ads',       owner: '', type: 'number',  category: 'Pipeline',        goodDirection: 'down', goal: { operator: '<=', value: 20   } },
  { key: 'clients_over_1wk_onboarding',  label: 'Clients Over 1 Wk Onboarding',   owner: '', type: 'number',  category: 'Pipeline',        goodDirection: 'down', goal: { operator: '<=', value: 0    } },
  { key: 'testimonies_received',         label: 'Testimonies Received',            owner: '', type: 'number',  category: 'Performance',     goodDirection: 'up',   goal: { operator: '>=', value: 10   } },
  { key: 'client_meetings',              label: 'Client Meetings',                 owner: '', type: 'number',  category: 'Performance',     goodDirection: 'up',   goal: { operator: '>=', value: 50   } },
];

// Row index (0-based, after header) → metric key
// Row 0 = header, rows 1-14 = weekly data section
// Row labels in CSV (row[0] column is the metric name)
const ROW_KEY_MAP = {
  'Total Number of Clients (Including Paused)': 'total_clients_incl_paused',
  'Total Number of Active Clients':             'total_active_clients',
  'Issues Submitted':                           'issues_submitted',
  'Clients Cancelled, Force Cancelled, or Paused': 'clients_cancelled_paused',  // header row double-duty
  // Row 5 (index 4) — blank label with separate paused count — skip (duplicate)
  '% of Clients in Purple CHI':   'pct_purple_chi',
  '% of Clients in Green CHI':    'pct_green_chi',
  '% of Clients in Yellow CHI':   'pct_yellow_chi',
  '% of Clients in Red CHI':      'pct_red_chi',
  'Clients Over a Week in Setting Up': 'clients_over_1wk_setting_up',
  'Clients with Inactive Ads':         'clients_inactive_ads',
  'Clients over a Week in Onboarding': 'clients_over_1wk_onboarding',
  'Testimonies Received':              'testimonies_received',
  'Client Meetings':                   'client_meetings',
};

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

// "1/6/2026" → "2026-01-06"
function parseDate(str) {
  const [m, d, y] = str.trim().split('/');
  if (!m || !d || !y) return null;
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

function parseValue(str) {
  if (!str) return null;
  const s = str.trim();
  if (s === '' || s === '#DIV/0!' || s === 'N/A') return null;
  // Strip %, $, commas — keep the numeric value as-is (9.8% → 9.8)
  const clean = s.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(23, 59, 59, 999);

const csvText = fs.readFileSync(CSV_PATH, 'utf8');
const lines   = csvText.split('\n').filter(l => l.trim());

// Header row: col 0 = "Clients Cancelled..." (used as scorecard name), col 1 = "Goal", col 2+ = dates
const header   = parseCSVLine(lines[0]);
// The actual dates start at col 2
const dateCols = header.slice(2).map((h, i) => ({
  index: i + 2,
  raw:   h,
  date:  parseDate(h),
})).filter(c => {
  if (!c.date) return false;
  const d = new Date(c.date + 'T12:00:00');
  return d <= today;
});

console.log(`Found ${dateCols.length} date columns up to today.`);

// Build weekly entry map
const weekMap = {};
dateCols.forEach(c => { weekMap[c.date] = {}; });

// Only process rows 1-14 (weekly section); row 16+ is monthly summary → stop at "Measurable" header
for (let li = 1; li < lines.length; li++) {
  const cols   = parseCSVLine(lines[li]);
  const label  = cols[0] || '';
  // Stop when we hit the monthly section header
  if (label === 'Measurable') break;
  const mKey = ROW_KEY_MAP[label];
  if (!mKey) continue;

  // Determine type from metric definition
  dateCols.forEach(c => {
    const val = parseValue(cols[c.index]);
    if (val !== null) {
      weekMap[c.date][mKey] = val;
    }
  });
}

// ── Write to db.json ──────────────────────────────────────────────────────────
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
db.scorecards['client-success'].metrics = METRICS;
db.entries['client-success'] = {};

let count = 0;
for (const [weekStart, metrics] of Object.entries(weekMap)) {
  if (Object.keys(metrics).length === 0) continue;
  db.entries['client-success'][weekStart] = {
    week_start: weekStart,
    entered_by: 'import',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metrics,
  };
  count++;
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`✅  client-success: wrote ${count} weekly entries.`);
