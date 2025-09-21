# Google Sheets Web App (Apps Script)

This minimal web app writes visitor info to a Google Sheet and prevents showing the modal again when an IP is already logged.

## Setup

1. Create a Google Sheet with headers in row 1:
   - A: `timestamp`
   - B: `name`
   - C: `role`
   - D: `ip`
   - E: `dateLastAccessed`

2. In the Sheet, click Extensions ? Apps Script. Replace the code with the script below.

3. Update the `SHEET_ID` constant to your Sheet ID (the long ID in the sheet URL).

4. Deploy: Deploy ? New deployment ? Type: Web app ? Execute as: Me ? Who has access: Anyone. Copy the web app URL.

5. In this project, create `.env` with:
   
   VITE_SHEETS_WEBAPP_URL="https://script.google.com/macros/s/XXXXXXXX/exec"

6. Run the app. On first visit for a new IP, the modal prompts for Name and Role, then logs to the sheet. Subsequent visits from the same IP quietly update `dateLastAccessed` and do not show the modal.

## Apps Script Code

```javascript
const SHEET_ID = 'PUT_YOUR_SHEET_ID_HERE';
const SHEET_NAME = 'Sheet1'; // change if needed

function getSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function doGet(e) {
  const ip = (e && e.parameter && e.parameter.ip) || '';
  const sheet = getSheet_();
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0] || [];
  const ipCol = headers.indexOf('ip');
  let exists = false;
  if (ip && ipCol >= 0) {
    for (let r = 1; r < values.length; r++) {
      if ((values[r][ipCol] || '').toString().trim() === ip) {
        exists = true;
        break;
      }
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ exists }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = getSheet_();
  const now = new Date();
  let payload = {};\n  try {\n    payload = JSON.parse(e.postData.contents);\n  } catch (err) {}\n  // fallback for form-encoded bodies (avoids CORS preflight)\n  if (!payload || Object.keys(payload).length === 0) {\n    payload = e.parameter || {};\n  }\n\n  const ip = (payload.ip || '').toString();
  const action = (payload.action || '').toString();

  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values[0] || [];

  const col = (name) => headers.indexOf(name);
  const cTs = col('timestamp');
  const cName = col('name');
  const cRole = col('role');
  const cIp = col('ip');
  const cLast = col('dateLastAccessed');

  const findRowByIp = (ipVal) => {
    if (!ipVal || cIp < 0) return -1;
    for (let r = 1; r < values.length; r++) {
      if ((values[r][cIp] || '').toString().trim() === ipVal) return r + 1; // 1-based
    }
    return -1;
  };

  if (action === 'touch' && ip) {
    const row = findRowByIp(ip);
    if (row > 0 && cLast >= 0) {
      sheet.getRange(row, cLast + 1).setValue(now);
    }
    return json_({ ok: true, touched: row > 0 });
  }

  const name = (payload.name || '').toString();
  const role = (payload.role || '').toString();

  // upsert by IP
  const existingRow = findRowByIp(ip);
  if (existingRow > 0) {
    if (cLast >= 0) sheet.getRange(existingRow, cLast + 1).setValue(now);
    return json_({ ok: true, updated: true });
  }

  // append new row
  const row = [];
  // Ensure columns in correct order by headers; fallback if missing
  const cols = headers.map(h => h.toString().toLowerCase());
  for (let i = 0; i < headers.length; i++) {
    const h = cols[i];
    if (h === 'timestamp') row[i] = now;
    else if (h === 'name') row[i] = name;
    else if (h === 'role') row[i] = role;
    else if (h === 'ip') row[i] = ip;
    else if (h === 'datelastaccessed') row[i] = now;
    else row[i] = '';
  }
  sheet.appendRow(row);
  return json_({ ok: true, inserted: true });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## Notes

- The client obtains IP via ipify and also sends it; Apps Script does not reliably expose client IP.
- Deploy the web app as `Anyone` for simplicity. If you restrict, you’ll need OAuth on the client which is more complex.
- The modal also uses `localStorage` as a quick guard to avoid flashing for already submitted users.

