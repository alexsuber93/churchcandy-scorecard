const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');
const https   = require('https');

// Load .env (simple parser, no extra dep)
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const app    = express();
const PORT   = process.env.PORT || 3001;
const DB     = path.join(__dirname, 'db.json');
const OLD_DB = path.join(__dirname, 'data.json');

// ── Directors scorecard (seeded on first run) ─────────────────────────────────
const DIRECTORS_SC = {
  id: 'directors', name: 'Directors', color: '#6366f1',
  metrics: [
    { key: 'new_clients_signed',    label: 'New Clients Signed',        owner: 'Abe',   type: 'number',   category: 'Acquisition', goodDirection: 'up',      goal: { operator: '>',  value: 13   } },
    { key: 'qualified_calls',       label: 'Qualified Calls Conducted', owner: 'Abe',   type: 'number',   category: 'Acquisition', goodDirection: 'up',      goal: { operator: '>=', value: 25   } },
    { key: 'total_clients',         label: 'Total Number of Clients',   owner: 'Alex',  type: 'number',   category: 'Acquisition', goodDirection: 'up',      goal: { operator: '>=', value: 500  } },
    { key: 'clients_cancelled',     label: 'Clients Cancelled',         owner: 'Alex',  type: 'number',   category: 'Acquisition', goodDirection: 'down',    goal: { operator: '<=', value: 3    } },
    { key: 'avg_cost_per_lead',     label: 'Avg Cost Per Lead',         owner: 'Alex',  type: 'currency', category: 'Financial',   goodDirection: 'down',    goal: { operator: '<=', value: 25   } },
    { key: 'total_pyvs',            label: 'Total PYVs',                owner: 'Alex',  type: 'number',   category: 'Performance', goodDirection: 'up',      goal: null },
    { key: 'testimonies_received',  label: 'Testimonies Received',      owner: 'Elise', type: 'number',   category: 'Performance', goodDirection: 'up',      goal: null },
    { key: 'issue_forms_submitted', label: 'Issue Forms Submitted',     owner: 'Elise', type: 'number',   category: 'Performance', goodDirection: 'down',    goal: { operator: '<=', value: 5    } },
    { key: 'clients_not_gp',        label: 'Clients Not Green/Purple',  owner: 'Elise', type: 'percent',  category: 'Performance', goodDirection: 'down',    goal: { operator: '<=', value: 50   } },
    { key: 'pct_pause_clients',     label: 'Pause Clients %',           owner: 'Elise', type: 'percent',  category: 'Performance', goodDirection: 'down',    goal: { operator: '<=', value: 10   } },
    { key: 'cpbc_marketing',        label: 'CPBC for Marketing',        owner: 'Ethan', type: 'currency', category: 'Financial',   goodDirection: 'down',    goal: { operator: '<=', value: 100  } },
    { key: 'ap_15_days',            label: 'A/P 15+ Days Past Due',     owner: 'Sara',  type: 'currency', category: 'Financial',   goodDirection: 'down',    goal: { operator: '<=', value: 1000 } },
    { key: 'refunds',               label: 'Refunds',                   owner: 'Sara',  type: 'currency', category: 'Financial',   goodDirection: 'down',    goal: { operator: '<=', value: 0    } },
    { key: 'credits',               label: 'Credits',                   owner: 'Sara',  type: 'currency', category: 'Financial',   goodDirection: 'neutral', goal: { operator: '<=', value: 0    } },
  ],
};

const PLACEHOLDER_SCS = [
  { id: 'sales',          name: 'Sales',          color: '#3b82f6', metrics: [] },
  { id: 'client-success', name: 'Client Success', color: '#10b981', metrics: [] },
  { id: 'meta-ads',       name: 'Meta Ads',       color: '#f59e0b', metrics: [] },
  { id: 'billing',        name: 'Billing',        color: '#8b5cf6', metrics: [] },
];

// ── One-time DB initialisation + migration ────────────────────────────────────
function initDB() {
  if (fs.existsSync(DB)) return;

  const db = { scorecards: {}, entries: {} };

  // Seed scorecards
  db.scorecards[DIRECTORS_SC.id] = DIRECTORS_SC;
  db.entries[DIRECTORS_SC.id]    = {};
  for (const sc of PLACEHOLDER_SCS) {
    db.scorecards[sc.id] = sc;
    db.entries[sc.id]    = {};
  }

  // Migrate historical entries from old data.json → directors
  if (fs.existsSync(OLD_DB)) {
    try {
      const old = JSON.parse(fs.readFileSync(OLD_DB, 'utf8'));
      db.entries['directors'] = old;
      console.log(`Migrated ${Object.keys(old).length} weeks from data.json`);
    } catch (e) {
      console.warn('Migration warning:', e.message);
    }
  }

  fs.writeFileSync(DB, JSON.stringify(db, null, 2));
  console.log('Initialised db.json with 5 scorecards');
}

initDB();

// ── DB helpers ────────────────────────────────────────────────────────────────
function load() {
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
  catch { return { scorecards: {}, entries: {} }; }
}
function save(db) { fs.writeFileSync(DB, JSON.stringify(db, null, 2)); }

app.use(cors());
app.use(express.json());

// ── Auth ─────────────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.APP_PASSWORD;
  if (!expected) return res.json({ ok: true }); // no password set = open access
  if (password === expected) return res.json({ ok: true });
  res.status(401).json({ ok: false, error: 'Incorrect password' });
});

// ── Scorecards ────────────────────────────────────────────────────────────────
app.get('/api/scorecards', (req, res) => {
  const db = load();
  res.json(Object.values(db.scorecards));
});

app.post('/api/scorecards', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const db = load();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (db.scorecards[id]) return res.status(409).json({ error: 'ID already exists' });
  db.scorecards[id] = { id, name, color: color || '#6366f1', metrics: [] };
  db.entries[id]    = {};
  save(db);
  res.json(db.scorecards[id]);
});

app.put('/api/scorecards/:id', (req, res) => {
  const db = load();
  const sc = db.scorecards[req.params.id];
  if (!sc) return res.status(404).json({ error: 'Not found' });
  const { name, color, metrics } = req.body;
  if (name    !== undefined) sc.name    = name;
  if (color   !== undefined) sc.color   = color;
  if (metrics !== undefined) sc.metrics = metrics;
  save(db);
  res.json(sc);
});

app.delete('/api/scorecards/:id', (req, res) => {
  const db = load();
  delete db.scorecards[req.params.id];
  delete db.entries[req.params.id];
  save(db);
  res.json({ success: true });
});

// ── Entries ───────────────────────────────────────────────────────────────────
app.get('/api/scorecards/:id/entries', (req, res) => {
  const db      = load();
  const entries = db.entries[req.params.id] || {};
  res.json(Object.values(entries).sort((a, b) => b.week_start.localeCompare(a.week_start)));
});

app.get('/api/scorecards/:id/entries/:weekStart', (req, res) => {
  const db = load();
  res.json((db.entries[req.params.id] || {})[req.params.weekStart] ?? null);
});

app.post('/api/scorecards/:id/entries', (req, res) => {
  const { week_start, entered_by, metrics } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start required' });
  const db  = load();
  const now = new Date().toISOString();
  if (!db.entries[req.params.id]) db.entries[req.params.id] = {};
  const normalised = {};
  for (const [k, v] of Object.entries(metrics || {})) {
    normalised[k] = (v === '' || v === null || v === undefined) ? null : Number(v);
  }
  const prev = db.entries[req.params.id][week_start];
  db.entries[req.params.id][week_start] = {
    week_start,
    entered_by: entered_by || '',
    created_at: prev?.created_at ?? now,
    updated_at: now,
    metrics: { ...(prev?.metrics ?? {}), ...normalised },
  };
  save(db);
  res.json({ success: true });
});

app.delete('/api/scorecards/:id/entries/:weekStart', (req, res) => {
  const db = load();
  if (db.entries[req.params.id]) delete db.entries[req.params.id][req.params.weekStart];
  save(db);
  res.json({ success: true });
});

// ── Airtable Sync ─────────────────────────────────────────────────────────────

const AT_BASE_CLIENTS = 'appi0KbaL1vLyegdX';
const AT_TABLE_CLIENTS = 'tbl2UOvH7QcFBRUWB';
const AT_BASE_ISSUES  = 'appMw2h8pkKsqbpx9';
const AT_TABLE_ISSUES = 'tblxSMRg2dgAXmPRe';

// Field IDs in Active Clients table
const AT_FIELDS = {
  status:         'fldL4fenaLL8LrBYa',   // multipleSelects: Active/Paused/Canceled/Setting Up...
  chiScore:       'fldfftVDAZ5sODgq6',   // singleSelect: Purple/Green/Yellow/Red
  adsRunning:     'fldy1aBaheddJzEfI',   // singleSelect: Yes/No
  setting7days:   'fldLR8MOtPVnRJTmn',   // formula: true if >7 days setting up
  dateOnboarded:  'fld6eO0tiy1bFQr8o',   // date: onboarding start
};

// CHI Score name → metric key
const CHI_MAP = {
  'Purple (It\'s Great)': 'pct_purple_chi',
  'Green (It\'s Good)':   'pct_green_chi',
  'Yellow (It\'s Okay)':  'pct_yellow_chi',
  'Red (It\'s Bad)':      'pct_red_chi',
};

function airtableFetch(token, url) {
  return new Promise((resolve, reject) => {
    const opts = {
      headers: { Authorization: `Bearer ${token}` },
    };
    https.get(url, opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function fetchAllPages(token, baseId, tableId, fields) {
  const fieldParams = fields.length
    ? fields.map(f => `fields[]=${f}`).join('&') + '&returnFieldsByFieldId=true'
    : 'returnFieldsByFieldId=true';
  let records = [];
  let offset  = '';
  do {
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?${fieldParams}${offset ? '&offset=' + encodeURIComponent(offset) : ''}`;
    const page = await airtableFetch(token, url);
    if (page.error) throw new Error(page.error.message || JSON.stringify(page.error));
    records = records.concat(page.records || []);
    offset  = page.offset || '';
  } while (offset);
  return records;
}

// Returns ISO week-start (Monday) for a given date
function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

app.get('/api/sync/client-success', async (req, res) => {
  const token = process.env.AIRTABLE_API_KEY;
  if (!token) return res.status(500).json({ error: 'AIRTABLE_API_KEY not set in server environment' });

  try {
    // ── 1. Fetch all client records ──────────────────────────────────────────
    const clientRecords = await fetchAllPages(token, AT_BASE_CLIENTS, AT_TABLE_CLIENTS, [
      AT_FIELDS.status, AT_FIELDS.chiScore, AT_FIELDS.adsRunning, AT_FIELDS.setting7days, AT_FIELDS.dateOnboarded,
    ]);

    // ── 2. Compute Client Success metrics ────────────────────────────────────
    // Status field: array of plain strings e.g. ["Active"], ["Paused"]
    // CHI Score field: plain string e.g. "Green (It's Good)"
    // Are Ads Running field: plain string e.g. "Running", "Not Running", "CC Paused"
    // 7+Days Setting Up field: string "Yes" or "No"

    let totalIncPaused = 0;
    let totalActive    = 0;
    let inactiveAds    = 0;
    let over1wkSetup   = 0;
    let over1wkOnboard = 0;
    const chiCounts    = { pct_purple_chi: 0, pct_green_chi: 0, pct_yellow_chi: 0, pct_red_chi: 0 };

    const now        = new Date();
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    for (const rec of clientRecords) {
      const c      = rec.fields || {};
      // Status is an array of plain strings
      const status = c[AT_FIELDS.status] || [];

      if (status.includes('Canceled')) continue;

      const isActive  = status.includes('Active');
      const isPaused  = status.includes('Paused');
      const isSetup   = status.includes('Setting Up');
      const isOnboard = status.some(s => s.toLowerCase().includes('onboard'));

      // Total clients = Active + Paused + Setting Up
      if (isActive || isPaused || isSetup) totalIncPaused++;
      if (isActive) totalActive++;

      // CHI score is a plain string (only count for Active clients)
      const chiScore = c[AT_FIELDS.chiScore];
      if (chiScore && CHI_MAP[chiScore] && isActive) {
        chiCounts[CHI_MAP[chiScore]]++;
      }

      // Inactive ads: Active clients where ads are Not Running or Ad Account Disabled
      if (isActive) {
        const adsVal = c[AT_FIELDS.adsRunning];
        if (adsVal === 'Not Running' || adsVal === 'Ad Account Disabled') inactiveAds++;
      }

      // Over 1 week setting up: formula returns "Yes" / "No"
      if (isSetup && c[AT_FIELDS.setting7days] === 'Yes') over1wkSetup++;

      // Over 1 week in onboarding: check date
      if (isOnboard && c[AT_FIELDS.dateOnboarded]) {
        if (new Date(c[AT_FIELDS.dateOnboarded]) < oneWeekAgo) over1wkOnboard++;
      }
    }

    // CHI percentages based on active clients that have a CHI score
    const chiTotal = Object.values(chiCounts).reduce((a, b) => a + b, 0);
    const pct = n => chiTotal > 0 ? parseFloat((n / chiTotal * 100).toFixed(1)) : 0;

    // ── 3. Fetch Issue Form Submissions for this week ────────────────────────
    let issuesSubmitted = 0;
    try {
      const thisWeekStart = weekStart(now);
      const issueRecords  = await fetchAllPages(token, AT_BASE_ISSUES, AT_TABLE_ISSUES, []);
      issuesSubmitted = issueRecords.filter(r =>
        r.createdTime && r.createdTime.slice(0, 10) >= thisWeekStart
      ).length;
    } catch (e) {
      console.warn('Issues fetch failed:', e.message);
    }

    // ── 4. Return metrics ────────────────────────────────────────────────────
    res.json({
      total_clients_incl_paused:    totalIncPaused,
      total_active_clients:         totalActive,
      issues_submitted:             issuesSubmitted,
      pct_purple_chi:               pct(chiCounts.pct_purple_chi),
      pct_green_chi:                pct(chiCounts.pct_green_chi),
      pct_yellow_chi:               pct(chiCounts.pct_yellow_chi),
      pct_red_chi:                  pct(chiCounts.pct_red_chi),
      clients_over_1wk_setting_up:  over1wkSetup,
      clients_inactive_ads:         inactiveAds,
      clients_over_1wk_onboarding:  over1wkOnboard,
      _meta: {
        total_records_scanned: clientRecords.length,
        chi_scored_clients:    chiTotal,
        generated_at:          now.toISOString(),
      },
    });

  } catch (err) {
    console.error('Airtable sync error:', err);
    res.status(500).json({ error: err.message });
  }
});

// In production, serve the built React app
const isProduction = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, '../client/dist'));
if (isProduction) {
  const clientDist = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => console.log(`Scorecard server running on port ${PORT}`));
