# FreshTrack Mobile Terminal (standalone)

This is your FreshTrack app rebuilt as a plain Node.js/Express web app — it no
longer needs a Google Sheet or Google Apps Script to run. All data (items,
picker passwords, recipients, order logs) lives in `db.json` on the server.

## What changed from the Apps Script version

- `Code.gs` → `server.js` (an Express server with the same 4 operations:
  verify password, get initial data, dispatch an order, log a completed run).
- Google Sheets tabs (`DATA`, `Passwords`, `Emails`, `PickingLogs`) → a single
  `db.json` file with `items`, `passwords`, `recipients`, `logs`.
- `Index.html` → `public/index.html`, with the `google.script.run(...)` calls
  replaced by plain `fetch()` calls to `/api/...` endpoints. Everything else
  (the swipe UI, matrix scanner, admin dashboard, print voucher) is unchanged.
- Picker mode is now chosen with a URL query string instead of server
  templating: `https://your-app.onrender.com/?mode=picker`

## Run it locally

```bash
npm install
npm start
```

Then open `http://localhost:3000` (manager view) or
`http://localhost:3000/?mode=picker` (picker view).

Default login passcodes from the seed data (change these — see below):
- Matrix tab: `changeme`
- Admin tab: `changeme`
- Sample picker "SAMPLE PICKER": `1234`

## Loading your real data

`db.json` ships with the ~24 items visible in your screenshot as a starting
point, plus one placeholder picker. To bring in your **full** item list:

1. In Google Sheets, open the `DATA` tab → File → Download → CSV.
2. Save the file into this folder as `items.csv`.
3. Run `node import-items.js` — this replaces the `items` array in `db.json`.

For passwords and recipients, just edit `db.json` directly — it's plain JSON:

```json
{
  "passwords": [
    { "name": "MATRIX", "password": "your-matrix-pin" },
    { "name": "ADMIN", "password": "your-admin-pin" },
    { "name": "JOHN", "password": "1234" }
  ],
  "recipients": [
    { "email": "john@example.com", "name": "JOHN", "phone": "+35799123456" }
  ]
}
```

Every picker name needs a matching row in both `passwords` and `recipients`.

## Push to GitHub

```bash
cd freshtrack
git init
git add .
git commit -m "Standalone FreshTrack app"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## Deploy on Render

1. Go to [render.com](https://render.com) → **New** → **Web Service**.
2. Connect the GitHub repo you just pushed.
3. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Click **Create Web Service**. Render will give you a URL like
   `https://freshtrack.onrender.com`.
   - Manager view: `https://freshtrack.onrender.com`
   - Picker view: `https://freshtrack.onrender.com/?mode=picker`

### Important: data persistence on Render

Render's free/standard web services use an **ephemeral filesystem** — it
resets on every deploy (but not on normal restarts/traffic). Since this app
stores data in `db.json` on disk, that means:
- Your data survives while the service is running.
- A new deploy (e.g. pushing a code change) wipes `db.json` back to whatever
  is in the repo.

For a small internal tool this is often fine, but if you want data to survive
deploys, do one of:
- Add a [Render Disk](https://render.com/docs/disks) (persistent volume) and
  point `DB_PATH` in `server.js` at a file on that disk, or
- Swap `db.json` for a small hosted database (e.g. Render's managed Postgres,
  or a free tier of Supabase/Neon) — happy to help wire that up if you want it.

## Changing the port

Render sets the `PORT` environment variable automatically; the server already
reads `process.env.PORT`, so no changes needed there.
