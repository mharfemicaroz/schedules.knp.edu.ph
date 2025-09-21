// Minimal client for Sheets API server (configurable path)

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '');
const VISITOR_PATH = import.meta.env.VITE_VISITOR_PATH || '/visitor';

function joinUrl(path) {
  if (!API_BASE) return path; // relative
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

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
  const url = `${joinUrl(VISITOR_PATH)}?ip=${encodeURIComponent(ip || '')}`;
  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) throw new Error(`check failed: ${res.status}`);
    const data = await res.json();
    return { exists: !!data.exists };
  } catch (e) {
    console.warn('checkIpExists error:', e);
    return { exists: false, error: true };
  }
}

export async function upsertVisitor({ name, role, ip }) {
  const url = joinUrl(VISITOR_PATH);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, ip })
    });
    if (!res.ok) throw new Error(`submit failed: ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('upsertVisitor error:', e);
    throw e;
  }
}

export async function touchLastAccess(ip) {
  const url = joinUrl(VISITOR_PATH);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, action: 'touch' })
    });
  } catch (e) {
    console.warn('touchLastAccess error:', e);
  }
}

