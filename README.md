# Infizo

Mobile-first service log & repair tracker (React + Vite + Tailwind). Designs: `../screen_*`, tokens: `../field_ops_precision/DESIGN.md`.

    npm install
    npm run dev      # http://localhost:5173 (localhost only)
    npm run dev:lan  # also reachable from your phone on the same Wi-Fi (trusted networks only)
    npm run build

## Google Sheets setup
1. Create a Google Sheet → Extensions → Apps Script → paste `apps-script/Code.gs`.
2. Run `setup()` once (writes the 20 column headers).
3. Deploy → Web app → Execute as *Me*, access *Anyone* → copy the `/exec` URL.
4. In the app: Settings → paste URL → Save → Test.

Every ticket is one row keyed by `Ticket_ID`, updated in place. Photos are uploaded to a Drive folder and their URLs written to `Photo_URL_Front` / `Photo_URL_Label`. Without a URL the app works offline-first on the device and syncs later ("N pending" button in the header).

Notes: voice input uses the browser Web Speech API (Chrome/Edge/Safari); the camera uses the phone's native capture. Demo tickets can be removed in Settings.
