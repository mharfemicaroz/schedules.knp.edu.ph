import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkIpExists, upsertVisitor, touchByIp } from './googleSheets.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const spreadsheetId = process.env.SHEETS_SPREADSHEET_ID;
const sheetName = process.env.SHEETS_WORKSHEET_NAME || 'Sheet1';

if (!spreadsheetId) {
  console.warn('WARN: SHEETS_SPREADSHEET_ID not set. API will 500 on calls.');
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, spreadsheetId: !!spreadsheetId, sheetName });
});

app.get('/api/visitor', async (req, res) => {
  try {
    const ip = (req.query.ip || '').toString();
    if (!spreadsheetId) return res.status(500).json({ ok: false, error: 'Missing spreadsheetId' });
    const { exists } = await checkIpExists({ spreadsheetId, sheetName, ip });
    res.json({ exists });
  } catch (e) {
    console.error('GET /api/visitor error', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.post('/api/visitor', async (req, res) => {
  try {
    if (!spreadsheetId) return res.status(500).json({ ok: false, error: 'Missing spreadsheetId' });
    const { name = '', role = '', ip = '', action = '' } = req.body || {};
    if (action === 'touch') {
      const out = await touchByIp({ spreadsheetId, sheetName, ip });
      return res.json({ ok: true, ...out });
    }
    const out = await upsertVisitor({ spreadsheetId, sheetName, name, role, ip });
    res.json({ ok: true, ...out });
  } catch (e) {
    console.error('POST /api/visitor error', e);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`[sheets-api] listening on :${port}`));
