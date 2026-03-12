/**
 * One-time import script: reads the historical CSV and writes data.json
 * Run with: node server/import-csv.js
 */
const fs   = require('fs');
const path = require('path');

const CSV_PATH = '/Users/alexsuber/Downloads/EOS Tracker - ChurchCandy - Scorecard 2.5.csv';
const DB_PATH  = path.join(__dirname, 'data.json');

// ── Column index → week_start (Monday of that week's date range) ──────────────
const WEEK_MAP = {
  3:  '2025-12-22', // 12/21-12/27 (NYE week — no meeting but data exists)
  4:  '2025-12-29', // 12/28-1/3
  5:  '2026-01-05', // 1/4-1/10
  6:  '2026-01-12', // 1/11-1/17
  7:  '2026-01-19', // 1/18-1/24
  8:  '2026-01-26', // 1/25-1/31
  9:  '2026-02-02', // 2/1-2/7
  10: '2026-02-09', // 2/8-2/14 (EOS meeting — still has data)
  11: '2026-02-16', // 2/15-2/21
  12: '2026-02-23', // 2/22-2/28
  13: '2026-03-02', // 3/1-3/7
};

// ── Metric row index (0 = first data row) → metric key ───────────────────────
const METRIC_KEYS = [
  'new_clients_signed',     // row 3
  'qualified_calls',        // row 4
  'total_clients',          // row 5
  'clients_cancelled',      // row 6
  'avg_cost_per_lead',      // row 7
  'total_pyvs',             // row 8
  'testimonies_received',   // row 9
  'issue_forms_submitted',  // row 10
  'clients_not_gp',         // row 11
  'pct_pause_clients',      // row 12
  'cpbc_marketing',         // row 13
  'ap_15_days',             // row 14
  'refunds',                // row 15
  'credits',                // row 16
];

// ── Parse CSV handling quoted fields that contain commas ──────────────────────
function parseCSV(text) {
  return text.split('\n').map(line => {
    const cells = [];
    let cell = '';
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  });
}

// ── Clean a raw cell value to a number (or null) ──────────────────────────────
function clean(raw) {
  if (!raw) return null;
  // Strip $, %, *, commas, whitespace
  const s = raw.replace(/[$%*,\s]/g, '');
  if (s === '' || s === '-') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ── Main import ───────────────────────────────────────────────────────────────
const rows      = parseCSV(fs.readFileSync(CSV_PATH, 'utf8'));
const dataRows  = rows.slice(2, 2 + METRIC_KEYS.length); // rows 2–15 (0-indexed)
const now       = new Date().toISOString();

// Start with any existing weeks we want to KEEP (e.g. current week entries)
const existing = fs.existsSync(DB_PATH)
  ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
  : {};

// Remove the two test entries that were added manually
delete existing['2026-03-09'];
delete existing['2026-03-02'];

// Initialise all CSV weeks
for (const weekStart of Object.values(WEEK_MAP)) {
  existing[weekStart] = {
    week_start: weekStart,
    entered_by: '',
    created_at: now,
    updated_at: now,
    metrics: {},
  };
}

// Fill in metric values
dataRows.forEach((row, i) => {
  const key = METRIC_KEYS[i];
  for (const [col, weekStart] of Object.entries(WEEK_MAP)) {
    existing[weekStart].metrics[key] = clean(row[parseInt(col)]);
  }
});

fs.writeFileSync(DB_PATH, JSON.stringify(existing, null, 2));

const weeks   = Object.keys(existing).sort();
const entries = Object.values(existing).filter(e =>
  Object.values(e.metrics).some(v => v !== null)
);
console.log(`✓ Imported ${entries.length} weeks with data (${weeks[0]} → ${weeks[weeks.length - 1]})`);
console.log('Weeks:', weeks.join(', '));
