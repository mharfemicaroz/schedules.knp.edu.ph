# Google Sheets API (Service Account)

This repo includes a tiny Express server that writes to Google Sheets using a service account. The frontend modal calls this server to insert/update visitor info.

## 1) Create a Service Account + Key

- In Google Cloud Console, create a project (or reuse one).
- Enable the Google Sheets API for the project.
- Create a Service Account and generate a JSON key file. Download it.
- Share your target Sheet with the service account email (Editor): `service-account-name@project.iam.gserviceaccount.com`

## 2) Configure Environment

Create a `.env` file in the project root:

```
# Server
SHEETS_SPREADSHEET_ID="<your spreadsheet id>"
SHEETS_WORKSHEET_NAME="Sheet1"  # or your tab name
GOOGLE_APPLICATION_CREDENTIALS="C:/absolute/path/to/your/service-account-key.json"
PORT=8787

# Frontend
# If the API runs on a different origin/port in dev, set this
VITE_API_BASE="http://localhost:8787"
```

Notes:
- `GOOGLE_APPLICATION_CREDENTIALS` must be an absolute path on the machine running the server.
- The sheet must have headers in row 1: `timestamp`, `name`, `role`, `ip`, `dateLastAccessed`.

## 3) Install and Run

```
npm install
npm run api     # starts the Express server
npm run dev     # starts Vite (frontend)
```

Open the app, the modal should appear on first visit. Submissions will go to the sheet.

## 4) API Endpoints

- GET `/api/visitor?ip=1.2.3.4` ? `{ exists: boolean }`
- POST `/api/visitor` JSON body `{ name, role, ip }` ? upsert by IP
- POST `/api/visitor` JSON body `{ ip, action: "touch" }` ? updates `dateLastAccessed` if IP exists

## Troubleshooting

- 403/401 from Sheets: Make sure the Sheet is shared with the service account.
- Missing fields: Confirm header names in row 1 match exactly.
- Frontend can’t reach API: Set `VITE_API_BASE` to the server origin and restart Vite.
