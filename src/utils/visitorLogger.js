// Minimal client for Google Apps Script Sheets logger

const WEBAPP_URL = import.meta.env.VITE_SHEETS_WEBAPP_URL;

export async function getClientIP() {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    if (!res.ok) throw new Error('ipify failed');
    const data = await res.json();
    return data.ip || null;
  } catch (e) {
    console.warn('Failed to determine client IP:', e);
    return null;
  }
}

export async function checkIpExists(ip) {
  if (!WEBAPP_URL) return { exists: false, disabled: true };
  const url = `${WEBAPP_URL}?ip=${encodeURIComponent(ip || '')}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error('check failed');
    const data = await res.json();
    return { exists: !!data.exists };
  } catch (e) {
    console.warn('checkIpExists error:', e);
    return { exists: false, error: true };
  }
}

export async function upsertVisitor({ name, role, ip }) {
  if (!WEBAPP_URL) throw new Error('WEBAPP_URL not configured');
  try {
    const body = new URLSearchParams({ name: name || '', role: role || '', ip: ip || '' });
    const res = await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
    });
    if (!res.ok) {
      let txt = '';
      try { txt = await res.text(); } catch {}
      throw new Error('submit failed: ' + res.status + ' ' + txt);
    }
    let data = {};
    try { data = await res.json(); } catch {}
    return data;
  } catch (e) {
    console.error('upsertVisitor error:', e);
    throw e;
  }
}

export async function touchLastAccess(ip) {
  if (!WEBAPP_URL) return;
  try {
    const body = new URLSearchParams({ ip: ip || '', action: 'touch' });
    await fetch(WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString(),
    });
  } catch (e) {
    // non-fatal
    console.warn('touchLastAccess error:', e);
  }
}
