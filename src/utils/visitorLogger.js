// Minimal client for local Sheets API server

const API_BASE = import.meta.env.VITE_API_BASE || '';

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
  const url = `${API_BASE}/api/visitor?ip=${encodeURIComponent(ip || '')}`;
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
  const url = `${API_BASE}/api/visitor`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role, ip })
    });
    if (!res.ok) throw new Error('submit failed');
    return await res.json();
  } catch (e) {
    console.error('upsertVisitor error:', e);
    throw e;
  }
}

export async function touchLastAccess(ip) {
  const url = `${API_BASE}/api/visitor`;
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
