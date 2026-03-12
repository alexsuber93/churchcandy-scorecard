/**
 * Import historical data from the Media Buyer CSV into the meta-ads scorecard.
 * Run once: node import-meta-ads.js
 */
const fs   = require('fs');
const path = require('path');

const DB_PATH  = path.join(__dirname, 'db.json');
const CSV_PATH = path.join(
  process.env.HOME,
  'Downloads',
  'Media Buyer L10 Meeting - ChurchCandy - Media Buyer Scorecard.csv'
);

// ── Metric definitions ────────────────────────────────────────────────────────
const METRICS = [
  { key: 'cost_per_lead',           label: 'Cost Per Lead',            owner: 'MB',   type: 'currency', category: 'Media Buying',      goodDirection: 'down', goal: { operator: '<',  value: 20  } },
  { key: 'total_over_30_cpl',       label: 'Total Over $30 CPL',       owner: 'MB',   type: 'number',   category: 'Media Buying',      goodDirection: 'down', goal: { operator: '<',  value: 90  } },
  { key: 'over_1wk_setting_up',     label: 'Over 1 Week Setting Up',   owner: 'MB',   type: 'number',   category: 'Media Buying',      goodDirection: 'down', goal: { operator: '<',  value: 5   } },
  { key: 'inactive_ads',            label: 'Inactive Ads',             owner: 'MB',   type: 'number',   category: 'Media Buying',      goodDirection: 'down', goal: { operator: '<',  value: 20  } },
  { key: 'clients_cancelled_paused',label: 'Clients Cancelled/Paused', owner: 'Alex', type: 'number',   category: 'Client Management', goodDirection: 'down', goal: { operator: '<',  value: 3   } },
  { key: 'total_clients',           label: 'Total Number of Clients',  owner: 'Alex', type: 'number',   category: 'Client Management', goodDirection: 'up',   goal: { operator: '>',  value: 500 } },
  { key: 'issues_forms_submitted',  label: 'Issues Forms Submitted',   owner: 'Alex', type: 'number',   category: 'Client Management', goodDirection: 'down', goal: { operator: '<',  value: 15  } },
];

// Maps each row's (owner, measurable) to a metric key
const ROW_KEY_MAP = {
  'MB|Cost Per Lead':               'cost_per_lead',
  'MB|Total Over $30 CPL':          'total_over_30_cpl',
  'MB|Over 1 Week Setting Up':      'over_1wk_setting_up',
  'MB|Inactive Ads':                'inactive_ads',
  'Alex|Clients Cancelled/Paused':  'clients_cancelled_paused',
  'Alex|Total Number of Clients':   'total_clients',
  'Alex|Issues Forms Submitted':    'issues_forms_submitted',
};

// ── CSV parsing helpers ───────────────────────────────────────────────────────
function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQ  = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur.trim());
  return result;
}

// Parse "M/D/YYYY" → "YYYY-MM-DD"
function parseDate(str) {
  const [m, d, y] = str.trim().split('/');
  if (!m || !d || !y) return null;
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
}

// Parse a cell value (currency, number, %). Returns number or null.
function parseValue(str) {
  if (!str) return null;
  const s = str.trim();
  if (s === '' || s === '#DIV/0!' || s === 'N/A') return null;
  // Remove $, %, commas
  const clean = s.replace(/[$,%]/g, '').replace(/,/g, '').trim();
  const n = parseFloat(clean);
  return isNaN(n) ? null : n;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const today = new Date();
today.setHours(23, 59, 59, 999);

const csvText = fs.readFileSync(CSV_PATH, 'utf8');
const lines   = csvText.split('\n').filter(l => l.trim());

const header    = parseCSVLine(lines[0]);
// columns 0=Owner, 1=Measurable, 2=Goal, 3+= date values
const dateCols  = header.slice(3).map((h, i) => ({
  index: i + 3,
  raw:   h,
  date:  parseDate(h),
})).filter(c => {
  if (!c.date) return false;
  const d = new Date(c.date + 'T12:00:00');
  return d <= today;
});

console.log(`Found ${dateCols.length} date columns up to today.`);

// Build { weekStart: { metricKey: value } }
const weekMap = {};
dateCols.forEach(c => { weekMap[c.date] = {}; });

for (let li = 1; li < lines.length; li++) {
  const cols   = parseCSVLine(lines[li]);
  const owner  = cols[0] || '';
  const label  = cols[1] || '';
  const rowKey = `${owner}|${label}`;
  const mKey   = ROW_KEY_MAP[rowKey];
  if (!mKey) continue;

  dateCols.forEach(c => {
    const val = parseValue(cols[c.index]);
    if (val !== null) {
      weekMap[c.date][mKey] = val;
    }
  });
}

// ── Write to db.json ──────────────────────────────────────────────────────────
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// Set metrics
db.scorecards['meta-ads'].metrics = METRICS;

// Set entries (overwrite)
db.entries['meta-ads'] = {};
let count = 0;
for (const [weekStart, metrics] of Object.entries(weekMap)) {
  // Skip weeks with no data at all
  if (Object.keys(metrics).length === 0) continue;
  db.entries['meta-ads'][weekStart] = {
    week_start:  weekStart,
    entered_by:  'import',
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
    metrics,
  };
  count++;
}

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`✅  meta-ads: wrote ${count} weekly entries.`);
