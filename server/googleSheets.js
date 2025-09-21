let AUTH_SOURCE = 'unknown';
import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
  try {
    const b64 = process.env.GOOGLE_CREDENTIALS_B64;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (b64 || raw) {
      const jsonStr = b64 ? Buffer.from(b64, "base64").toString("utf8") : raw;
      const credentials = JSON.parse(jsonStr);
      AUTH_SOURCE = b64 ? "B64" : "JSON";
      return new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
    }
  } catch (e) {
    console.error(
      "Failed to parse GOOGLE_CREDENTIALS_JSON/GOOGLE_CREDENTIALS_B64",
      e
    );
  }
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile)
    throw new Error(
      "Set GOOGLE_APPLICATION_CREDENTIALS (path) or GOOGLE_CREDENTIALS_JSON/GOOGLE_CREDENTIALS_B64"
    );
  AUTH_SOURCE = "FILE";
  return new google.auth.GoogleAuth({ keyFile, scopes: SCOPES });
}
export async function getSheets() {
  const auth = await getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

export async function getHeaders({ spreadsheetId, sheetName }) {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });
  const headers = (res.data.values && res.data.values[0]) || [];
  return headers.map((h) => (h || "").toString());
}

export function colIndex(headers, name) {
  const idx = headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  return idx; // 0-based
}

export async function findRowByIp({ spreadsheetId, sheetName }) {
  const headers = await getHeaders({ spreadsheetId, sheetName });
  const ipIdx = colIndex(headers, "ip");
  if (ipIdx < 0) return { headers, ipIdx, row: -1 };

  const sheets = await getSheets();
  const colLetter = String.fromCharCode("A".charCodeAt(0) + ipIdx);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${colLetter}:${colLetter}`,
  });
  const col = res.data.values || [];
  // col[0] is header; start from row 2
  return { headers, ipIdx, col };
}

export async function checkIpExists({ spreadsheetId, sheetName, ip }) {
  const { headers, ipIdx, col } = await findRowByIp({
    spreadsheetId,
    sheetName,
  });
  if (ipIdx < 0) return { exists: false, headers };
  const exists = (col || [])
    .slice(1)
    .some((r) => (r[0] || "").toString().trim() === ip);
  return { exists, headers };
}

export async function upsertVisitor({
  spreadsheetId,
  sheetName,
  name,
  role,
  ip,
}) {
  const sheets = await getSheets();
  const headers = await getHeaders({ spreadsheetId, sheetName });
  const idx = (n) => colIndex(headers, n);
  const cTs = idx("timestamp");
  const cName = idx("name");
  const cRole = idx("role");
  const cIp = idx("ip");
  const cLast = idx("dateLastAccessed");

  // read all rows to find existing by IP
  const resAll = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  const rows = resAll.data.values || [];
  let foundRow = -1; // 1-based row number
  for (let r = 1; r < rows.length; r++) {
    if (cIp >= 0 && (rows[r][cIp] || "").toString().trim() === (ip || "")) {
      foundRow = r + 1;
      break;
    }
  }
  const now = new Date();

  if (foundRow > 0) {
    // update dateLastAccessed (and optionally name/role if provided)
    const updates = [];
    if (cLast >= 0)
      updates.push({
        range: `${sheetName}!${colA1(cLast)}${foundRow}`,
        values: [[now.toISOString()]],
      });
    if (cName >= 0 && name)
      updates.push({
        range: `${sheetName}!${colA1(cName)}${foundRow}`,
        values: [[name]],
      });
    if (cRole >= 0 && role)
      updates.push({
        range: `${sheetName}!${colA1(cRole)}${foundRow}`,
        values: [[role]],
      });

    if (updates.length) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          data: updates.map((u) => ({ range: u.range, values: u.values })),
          valueInputOption: "USER_ENTERED",
        },
      });
    }
    return { updated: true };
  }

  // Append new row with values aligned to headers
  const row = Array(headers.length).fill("");
  if (cTs >= 0) row[cTs] = now.toISOString();
  if (cName >= 0) row[cName] = name || "";
  if (cRole >= 0) row[cRole] = role || "";
  if (cIp >= 0) row[cIp] = ip || "";
  if (cLast >= 0) row[cLast] = now.toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
  return { inserted: true };
}

export async function touchByIp({ spreadsheetId, sheetName, ip }) {
  const sheets = await getSheets();
  const headers = await getHeaders({ spreadsheetId, sheetName });
  const cLast = colIndex(headers, "dateLastAccessed");
  const cIp = colIndex(headers, "ip");
  if (cLast < 0 || cIp < 0) return { ok: false };

  const resAll = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:Z`,
  });
  const rows = resAll.data.values || [];
  let foundRow = -1;
  for (let r = 1; r < rows.length; r++) {
    if ((rows[r][cIp] || "").toString().trim() === (ip || "")) {
      foundRow = r + 1;
      break;
    }
  }
  if (foundRow < 0) return { ok: false };

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!${colA1(cLast)}${foundRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[new Date().toISOString()]] },
  });
  return { ok: true, touched: true };
}

function colA1(idx) {
  // 0-based index to A1 column (A, B, ... AA)
  let n = idx;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
export async function authInfo() {
  try {
    const auth = await getAuth();
    const client = await auth.getClient();
    const email =
      client && client.email
        ? client.email
        : (client && client._serviceAccountEmail) || null;
    return { source: AUTH_SOURCE, clientEmail: email };
  } catch (e) {
    return {
      source: AUTH_SOURCE,
      error: e && e.message ? e.message : "auth_error",
    };
  }
}

