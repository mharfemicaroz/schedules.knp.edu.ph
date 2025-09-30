// Normalize human time blocks to minute-precise ranges and canonical keys
// Supports:
//  - "h[-mm]-h[-mm]AM|PM|NN" (single suffix applies to both ends; NN=end at 12:00 PM, start assumed AM)
//  - "HH:MM-HH:MM" 24-hour form
// Returns: { start, end, key, display }

export function normalizeTimeBlock(input) {
  const raw = String(input || '').trim();
  if (!raw || /^tba|na|n\/a$/i.test(raw)) return null;

  const pad = (n) => String(n).padStart(2, '0');
  const toKey = (start, end) => `${pad(Math.floor(start / 60))}:${pad(start % 60)}-${pad(Math.floor(end / 60))}:${pad(end % 60)}`;

  // Helper convert to minutes given hour, minute, suffix
  const toMinutes = (h, m, suf) => {
    let hh = Number(h) || 0;
    const mm = Number(m) || 0;
    if (suf === 'AM') {
      if (hh === 12) hh = 0;
    } else if (suf === 'PM') {
      if (hh !== 12) hh += 12;
    }
    return hh * 60 + mm;
  };

  // Pattern: h[:mm]-h[:mm](AM|PM|NN)
  const m1 = raw.toUpperCase().match(/^(\d{1,2})(?::(\d{2}))?-(\d{1,2})(?::(\d{2}))?(AM|PM|NN)$/);
  if (m1) {
    const [, h1, m1s, h2, m2s, suf] = m1;
    if (suf === 'NN') {
      const start = toMinutes(h1, m1s || 0, 'AM');
      const end = 12 * 60; // 12:00 PM
      return { start, end, key: toKey(start, end), display: raw };
    }
    const start = toMinutes(h1, m1s || 0, suf);
    const end = toMinutes(h2, m2s || 0, suf);
    return { start, end, key: toKey(start, end), display: raw };
  }

  // Pattern: HH:MM-HH:MM (24h)
  const m2 = raw.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
  if (m2) {
    const [, sh, sm, eh, em] = m2;
    const start = Number(sh) * 60 + Number(sm);
    const end = Number(eh) * 60 + Number(em);
    return { start, end, key: toKey(start, end), display: raw };
  }

  return null;
}

