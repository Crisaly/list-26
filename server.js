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

app.use(express.json({ limit: '10mb' }));
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

// ---------- Admin: manage pickers (name / password / phone / email) ----------

// GET all pickers (excludes the MATRIX / ADMIN gate passcodes)
app.get('/api/admin/pickers', (req, res) => {
  try {
    const db = readDb();
    const pwLookup = {};
    (db.passwords || []).forEach((p) => {
      pwLookup[String(p.name || '').trim().toUpperCase()] = p.password;
    });

    const pickers = (db.recipients || []).map((r) => ({
      name: r.name,
      phone: r.phone || '',
      email: r.email || '',
      password: pwLookup[String(r.name || '').trim().toUpperCase()] || ''
    }));

    res.json({ success: true, pickers });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

// Add or update a picker
app.post('/api/admin/pickers', (req, res) => {
  try {
    const db = readDb();
    const name = String(req.body.name || '').trim().toUpperCase();
    const password = String(req.body.password || '').trim();
    const phone = String(req.body.phone || '').trim();
    const email = String(req.body.email || '').trim();

    if (!name || !password) {
      return res.json({ success: false, error: 'Name and password are required.' });
    }
    if (name === 'MATRIX' || name === 'ADMIN') {
      return res.json({ success: false, error: 'That name is reserved.' });
    }

    if (!db.recipients) db.recipients = [];
    if (!db.passwords) db.passwords = [];

    const existingRecipient = db.recipients.find((r) => String(r.name || '').trim().toUpperCase() === name);
    if (existingRecipient) {
      existingRecipient.phone = phone;
      existingRecipient.email = email;
    } else {
      db.recipients.push({ name, phone, email });
    }

    const existingPassword = db.passwords.find((p) => String(p.name || '').trim().toUpperCase() === name);
    if (existingPassword) {
      existingPassword.password = password;
    } else {
      db.passwords.push({ name, password });
    }

    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

// Remove a picker by name
app.delete('/api/admin/pickers/:name', (req, res) => {
  try {
    const db = readDb();
    const name = String(req.params.name || '').trim().toUpperCase();

    if (name === 'MATRIX' || name === 'ADMIN') {
      return res.json({ success: false, error: 'That name is reserved and cannot be removed.' });
    }

    db.recipients = (db.recipients || []).filter((r) => String(r.name || '').trim().toUpperCase() !== name);
    db.passwords = (db.passwords || []).filter((p) => String(p.name || '').trim().toUpperCase() !== name);

    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

// ---------- Admin: manage items (barcode / sku / description) ----------

app.get('/api/admin/items', (req, res) => {
  try {
    const db = readDb();
    res.json({ success: true, items: db.items || [] });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

// Add or update a single item
app.post('/api/admin/items', (req, res) => {
  try {
    const db = readDb();
    const barcode = String(req.body.barcode || '').trim();
    const sku = String(req.body.sku || '').trim();
    const description = String(req.body.description || '').trim();

    if (!barcode || !description) {
      return res.json({ success: false, error: 'Barcode and description are required.' });
    }

    if (!db.items) db.items = [];
    const existing = db.items.find((i) => i.barcode === barcode);
    if (existing) {
      existing.sku = sku;
      existing.description = description;
    } else {
      db.items.push({ barcode, sku, description });
    }

    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

// Bulk import items - accepts pasted text, one item per line.
// Each line can be tab-separated (pasting straight from Google Sheets) or
// comma-separated: Barcode, Item Code, Description
app.post('/api/admin/items/import', (req, res) => {
  try {
    const db = readDb();
    const text = String(req.body.text || '');

    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!db.items) db.items = [];

    let imported = 0;
    lines.forEach((line) => {
      const cols = line.includes('\t') ? line.split('\t') : line.split(',');
      const barcode = (cols[0] || '').trim();
      const sku = (cols[1] || '').trim();
      const description = (cols[2] || '').trim();

      // skip header rows
      if (!barcode || barcode.toLowerCase() === 'barcode') return;

      const existing = db.items.find((i) => i.barcode === barcode);
      if (existing) {
        existing.sku = sku;
        existing.description = description;
      } else {
        db.items.push({ barcode, sku, description });
      }
      imported++;
    });

    writeDb(db);
    res.json({ success: true, imported });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

// Remove an item by barcode
app.delete('/api/admin/items/:barcode', (req, res) => {
  try {
    const db = readDb();
    const barcode = String(req.params.barcode || '').trim();
    db.items = (db.items || []).filter((i) => i.barcode !== barcode);
    writeDb(db);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`FreshTrack server running on port ${PORT}`);
});
