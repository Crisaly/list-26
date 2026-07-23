/**
 * Import items from a CSV export of your Google Sheet's DATA tab.
 *
 * Usage:
 *   1. In Google Sheets, open the DATA tab -> File > Download > Comma Separated Values (.csv)
 *   2. Save it into this project folder as items.csv
 *      (columns must be: Barcode, Item Code, Description - same order as the sheet)
 *   3. Run:  node import-items.js
 *
 * This replaces the "items" array in db.json with the CSV contents.
 * It does NOT touch passwords, recipients, or logs.
 */
const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'items.csv');
const DB_PATH = path.join(__dirname, 'db.json');

if (!fs.existsSync(CSV_PATH)) {
  console.error('items.csv not found. Export your DATA tab from Google Sheets as items.csv first.');
  process.exit(1);
}

function parseCsvLine(line) {
  // simple CSV parser handling quoted commas
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result.map((s) => s.trim());
}

const lines = fs.readFileSync(CSV_PATH, 'utf8').split(/\r?\n/).filter((l) => l.trim());
const rows = lines.slice(1); // skip header row

const items = rows
  .map((line) => {
    const [barcode, sku, description] = parseCsvLine(line);
    return {
      barcode: (barcode || '').trim(),
      sku: (sku || '').trim(),
      description: (description || '').trim()
    };
  })
  .filter((item) => item.barcode);

const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
db.items = items;
fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

console.log(`Imported ${items.length} items into db.json`);
