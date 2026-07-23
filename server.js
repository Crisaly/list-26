/**
 * FreshTrack Mobile Terminal - standalone backend
 * Replaces the old Google Apps Script + Google Sheets backend.
 * Data is stored in db.json on disk (see note in README about persistence on Render).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, 'db.json');
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- tiny JSON "database" helpers ----------
function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    const empty = { items: [], passwords: [], recipients: [], logs: [] };
    fs.writeFileSync(DB_PATH, JSON.stringify(empty, null, 2));
    return empty;
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

// ---------- API routes (mirror the old Apps Script functions) ----------

// verifyOperatorPassword(name, password)
app.post('/api/verify-password', (req, res) => {
  try {
    const db = readDb();
    const cleanName = String(req.body.name || '').trim().toUpperCase();
    const cleanPass = String(req.body.password || '').trim();

    const match = db.passwords.find(
      (p) => String(p.name || '').trim().toUpperCase() === cleanName &&
             String(p.password || '').trim() === cleanPass
    );

    res.json({ verified: !!match });
  } catch (err) {
    res.json({ verified: false, error: String(err) });
  }
});

// getInitialData()
app.get('/api/initial-data', (req, res) => {
  try {
    const db = readDb();
    res.json({
      success: true,
      items: db.items || [],
      recipients: db.recipients || [],
      logs: db.logs || []
    });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

// dispatchOrderList(recipientName, itemsList)
app.post('/api/dispatch-order', (req, res) => {
  try {
    const db = readDb();
    const { recipientName, itemsList } = req.body;
    const orderId = 'FT-' + Math.floor(10000 + Math.random() * 90000);

    db.logs.push({
      orderId,
      timestamp: new Date().toISOString().slice(0, 16).replace('T', ' '),
      picker: String(recipientName || '').toUpperCase(),
      status: 'Pending',
      duration: 'N/A',
      rawItemsJson: JSON.stringify(itemsList || [])
    });

    writeDb(db);
    res.json({ success: true, orderId });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

// logCompletedRun(orderId, duration, updatedItemsJson)
app.post('/api/log-completed-run', (req, res) => {
  try {
    const db = readDb();
    const { orderId, duration, updatedItemsJson } = req.body;
    const cleanOrderId = String(orderId || '').trim();

    const row = db.logs.find((l) => String(l.orderId).trim() === cleanOrderId);
    if (!row) {
      return res.json({ success: false, error: 'Order context row match mismatch.' });
    }

    row.status = 'Completed';
    row.duration = duration + 'm';
    if (updatedItemsJson) row.rawItemsJson = updatedItemsJson;

    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`FreshTrack server running on port ${PORT}`);
});
