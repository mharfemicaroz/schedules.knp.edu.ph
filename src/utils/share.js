// Lightweight obfuscation for share URLs (not cryptographically secure)
// Encodes a display name into a base64url token with a simple pepper.

const PEPPER = 'knp-share-v1';

function toBase64Url(str) {
  try {
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/,'');
  } catch {
    return '';
  }
}

function fromBase64Url(tok) {
  try {
    const s = String(tok || '').replace(/-/g,'+').replace(/_/g,'/');
    const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
    const b64 = s + pad;
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return '';
  }
}

export function encodeShareFacultyName(name) {
  const plain = String(name || '').trim();
  const withPepper = `${PEPPER}:${plain}`;
  return toBase64Url(withPepper);
}

export function decodeShareFacultyName(token) {
  const decoded = fromBase64Url(token);
  const m = decoded.startsWith(`${PEPPER}:`) ? decoded.slice(PEPPER.length + 1) : '';
  return m;
}

export function encodeShareRoom(room) {
  const plain = String(room || '').trim();
  return toBase64Url(`${PEPPER}:ROOM:${plain}`);
}
export function decodeShareRoom(token) {
  const decoded = fromBase64Url(token);
  const key = `${PEPPER}:ROOM:`;
  return decoded.startsWith(key) ? decoded.slice(key.length) : '';
}

export function encodeShareDepartment(dept) {
  const plain = String(dept || '').trim();
  return toBase64Url(`${PEPPER}:DEPT:${plain}`);
}
export function decodeShareDepartment(token) {
  const decoded = fromBase64Url(token);
  const key = `${PEPPER}:DEPT:`;
  return decoded.startsWith(key) ? decoded.slice(key.length) : '';
}

export function encodeShareBlock(block) {
  const plain = String(block || '').trim();
  return toBase64Url(`${PEPPER}:BLOCK:${plain}`);
}
export function decodeShareBlock(token) {
  const decoded = fromBase64Url(token);
  const key = `${PEPPER}:BLOCK:`;
  return decoded.startsWith(key) ? decoded.slice(key.length) : '';
}
