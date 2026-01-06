// Lightweight obfuscation for share URLs (not cryptographically secure)
// Encodes a display name (and optional metadata) into a base64url token with a simple pepper.

const PEPPER = 'knp-share-v1';
const FACULTY_PREFIX = `${PEPPER}:F:`;

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

function normalizeSemLabel(val) {
  const v = String(val || '').trim().toLowerCase();
  if (!v) return '';
  if (v.startsWith('1')) return '1st';
  if (v.startsWith('2')) return '2nd';
  if (/summer|mid\s*year|midyear/.test(v) || v.startsWith('3')) return '3rd';
  if (v.startsWith('s')) return 'Sem';
  return val;
}

export function encodeShareFacultyName(name, opts = {}) {
  const plain = String(name || '').trim();
  const sy = String(opts.schoolyear ?? opts.schoolYear ?? opts.sy ?? '').trim();
  const sem = normalizeSemLabel(opts.semester ?? opts.sem ?? '');
  // v2 payload with metadata; falls back gracefully if decoded by older clients
  const payload = { v: 2, name: plain, sy, sem };
  const raw = `${FACULTY_PREFIX}${JSON.stringify(payload)}`;
  return toBase64Url(raw);
}

export function decodeShareFacultyToken(token) {
  const decoded = fromBase64Url(token);
  if (!decoded) return { name: '', sy: '', sem: '' };
  if (decoded.startsWith(FACULTY_PREFIX)) {
    try {
      const payload = JSON.parse(decoded.slice(FACULTY_PREFIX.length));
      return {
        name: String(payload?.name || '').trim(),
        sy: String(payload?.sy ?? payload?.schoolyear ?? payload?.schoolYear ?? '').trim(),
        sem: normalizeSemLabel(payload?.sem ?? payload?.semester ?? payload?.term ?? ''),
      };
    } catch {
      return { name: '', sy: '', sem: '' };
    }
  }
  if (decoded.startsWith(`${PEPPER}:`)) {
    const nameOnly = decoded.slice(PEPPER.length + 1);
    return { name: nameOnly, sy: '', sem: '' };
  }
  return { name: '', sy: '', sem: '' };
}

export function decodeShareFacultyName(token) {
  return decodeShareFacultyToken(token).name;
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
