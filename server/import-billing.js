/**
 * Import Billing scorecard data from CSV
 * Run: node server/import-billing.js
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

const scorecards = Array.isArray(db.scorecards) ? db.scorecards : Object.values(db.scorecards);
const entries    = Array.isArray(db.entries)    ? db.entries    : Object.values(db.entries);

const billing = scorecards.find(s => s.id === 'billing');
if (!billing) { console.error('Billing scorecard not found'); process.exit(1); }

// ── Metrics ───────────────────────────────────────────────────────────────────
billing.metrics = [
  { key: 'overall_declined_payments',   label: 'Overall Declined Recurring Payments', owner: 'Mel',     type: 'number',   category: 'Declines',   goodDirection: 'down', goal: { operator: '<=', value: 20   } },
  { key: 'weekly_revenue_loss',         label: 'Weekly Revenue Loss (Declines)',       owner: 'Ariel',   type: 'currency', category: 'Declines',   goodDirection: 'down', goal: { operator: '<=', value: 3000 } },
  { key: 'weekly_revenue_loss_not_paid',label: 'Weekly Revenue Loss (Not Paid)',       owner: 'Mel',     type: 'currency', category: 'Declines',   goodDirection: 'down', goal: { operator: '<=', value: 1000 } },
  { key: 'billing_force_cancellation',  label: 'Billing Force Cancellation',           owner: 'Mel',     type: 'number',   category: 'Declines',   goodDirection: 'down', goal: { operator: '<=', value: 0   } },
  { key: 'account_vault_different',     label: 'Account Vault vs Paylink (Different)', owner: 'Jessica', type: 'number',   category: 'Paylink',    goodDirection: 'down', goal: { operator: '<=', value: 2   } },
  { key: 'account_vault_same',          label: 'Account Vault vs Paylink (Same)',      owner: 'Jessica', type: 'number',   category: 'Paylink',    goodDirection: 'down', goal: { operator: '<=', value: 2   } },
  { key: 'new_client_declines',         label: 'New Client Declines',                  owner: 'Jessica', type: 'percent',  category: 'Declines',   goodDirection: 'down', goal: { operator: '<=', value: 10  } },
];

// ── Bi-weekly periods (start date → data columns) ─────────────────────────────
// CSV columns 3–11 correspond to these period start dates
const PERIODS = [
  '2025-11-16',  // 11/16/25 - 11/29/25
  '2025-11-30',  // 11/30/25 - 12/13/25
  '2025-12-14',  // 12/14/25 - 12/27/25
  '2025-12-28',  // 12/28/25 - 1/10/26
  '2026-01-11',  // 1/11/26  - 1/24/26
  '2026-01-25',  // 01/25    - 02/07
  '2026-02-08',  // 02/08    - 02/21
  '2026-02-22',  // 02/22    - 03/07
  '2026-03-08',  // 03/08    - 03/21
];

// ── Raw data from CSV (index matches PERIODS above) ───────────────────────────
const RAW = {
  overall_declined_payments:    [13,    17,    15,    21,    null,  null,  10,    23,    null],
  weekly_revenue_loss:          [null,  null,  null,  null,  null,  null,  null,  null,  null],
  weekly_revenue_loss_not_paid: [0,     1150,  1800,  1150,  null,  null,  650,   4750,  null],
  billing_force_cancellation:   [0,     3,     0,     2,     null,  null,  1,     0,     null],
  account_vault_different:      [7,     8,     10,    11,    5,     11,    8,     12,    null],
  account_vault_same:           [2,     3,     2,     3,     4,     4,     1,     2,     null],
  new_client_declines:          [0,     6,     9,     4,     27,    14,    8,     5,     null],
};

// ── Write billing entries in server format: db.entries[scorecard_id][week_start] ──
// db.entries is an object keyed by scorecard id, each value is object keyed by week_start
if (!db.entries || Array.isArray(db.entries)) db.entries = {};
db.entries['billing'] = {};

let added = 0;

PERIODS.forEach((weekStart, i) => {
  const values = {};
  let hasData = false;
  billing.metrics.forEach(m => {
    const v = RAW[m.key]?.[i];
    if (v !== null && v !== undefined) {
      values[m.key] = v;
      hasData = true;
    }
  });

  if (!hasData) return;

  db.entries['billing'][weekStart] = {
    week_start:  weekStart,
    entered_by:  'Import',
    metrics:     values,
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  };
  added++;
});

// ── Save ─────────────────────────────────────────────────────────────────────
// scorecards must also be object keyed by id (server format)
if (Array.isArray(db.scorecards)) {
  const sc = {};
  db.scorecards.forEach(s => sc[s.id] = s);
  db.scorecards = sc;
}
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log(`✅ Billing metrics set: ${billing.metrics.length}`);
console.log(`✅ Entries imported: ${added}`);
billing.metrics.forEach(m => {
  const filled = PERIODS.filter((_, i) => RAW[m.key]?.[i] !== null && RAW[m.key]?.[i] !== undefined).length;
  console.log(`   ${m.label}: ${filled}/${PERIODS.length} weeks`);
});
