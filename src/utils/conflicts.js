// Shared conflict detection utilities used by Conflicts page and Edit modal

const DAY_ORDER = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

export function parseF2FDays(val){
  if (Array.isArray(val)) return val.filter(Boolean);
  const s = String(val || '')
    .split(/[ ,/;&]+/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => {
      const u = x.toUpperCase();
      if (u.startsWith('MON')) return 'Mon';
      if (u.startsWith('TUE')) return 'Tue';
      if (u.startsWith('WED')) return 'Wed';
      if (u.startsWith('THU')) return 'Thu';
      if (u.startsWith('FRI')) return 'Fri';
      if (u.startsWith('SAT')) return 'Sat';
      if (u.startsWith('SUN')) return 'Sun';
      return '';
    })
    .filter(Boolean);
  return DAY_ORDER.filter(d => s.includes(d));
}

export function overlap(aStart, aEnd, bStart, bEnd) {
  if (!Number.isFinite(aStart) || !Number.isFinite(aEnd) || !Number.isFinite(bStart) || !Number.isFinite(bEnd)) return false;
  return Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
}

export function expandedByF2FDay(rows){
  const out = [];
  rows.forEach(r => {
    const facRaw = String(r.facultyName || r.faculty || r.instructor || '').trim();
    const fac = facRaw;
    const invalidFac = !fac || /^(unknown|unassigned|n\/?a|none|no\s*faculty|not\s*assigned|tba|\-)$/i.test(fac);
    const term = r.semester || r.term || '';
    const tkey = r.scheduleKey || r.schedule || r.time || '';
    if (invalidFac || !term || !tkey) return;
    let days = (Array.isArray(r.f2fDays) ? r.f2fDays : parseF2FDays(r.f2fSched || r.f2fsched));
    if (!days || days.length === 0) {
      // Fallback to class day when F2F schedule is missing
      days = parseF2FDays(r.day);
    }
    if (!days || days.length === 0) return;
    days.forEach(day => out.push({ ...r, _day: day }));
  });
  return out;
}

export function buildConflicts(rows) {
  const out = [];
  const byOn = (list, fn) => {
    const m = new Map();
    list.forEach(r => { const k = fn(r); const a = m.get(k) || []; a.push(r); m.set(k, a); });
    return m;
  };
  const key = (...parts) => parts.map(v => String(v ?? '')).join('|');

  const termOf = (r) => r.semester || r.term || '';
  const timeKey = (r) => r.scheduleKey || r.schedule || r.time || '';
  const codeOf = (r) => r.code || r.courseName || '';
  const secOf = (r) => r.section || '';
  const facOf = (r) => r.facultyName || r.faculty || r.instructor || '';
  const dayOf = (r) => r._day || '';

  const arrByDay = expandedByF2FDay(rows);

  byOn(arrByDay, r => key(facOf(r), termOf(r), dayOf(r), timeKey(r), codeOf(r))).forEach((arr, k) => {
    const secs = new Set(arr.map(secOf).filter(Boolean));
    if (arr.length > 1 && secs.size > 1) out.push({ reason: 'Double-booked: same time, different sections of same course', key: 'A:'+k, items: arr });
  });

  byOn(arrByDay, r => key(facOf(r), termOf(r), dayOf(r), timeKey(r))).forEach((arr, k) => {
    const codes = new Set(arr.map(codeOf).filter(Boolean));
    if (arr.length > 1 && codes.size > 1) out.push({ reason: 'Double-booked: same time, different courses', key: 'B:'+k, items: arr });
  });

  byOn(arrByDay, r => key(facOf(r), termOf(r), dayOf(r), timeKey(r), codeOf(r), secOf(r))).forEach((arr, k) => {
    if (arr.length > 1) out.push({ reason: 'Exact duplicate entry', key: 'C:'+k, items: arr });
  });

  byOn(arrByDay, r => key(facOf(r), termOf(r), dayOf(r), codeOf(r), secOf(r))).forEach((arr, k) => {
    if (arr.length < 2) return;
    const anyOverlap = arr.some((a, i) => arr.slice(i+1).some(b => {
      if (timeKey(a) && timeKey(a) === timeKey(b)) return true;
      return overlap(a.timeStartMinutes, a.timeEndMinutes, b.timeStartMinutes, b.timeEndMinutes);
    }));
    if (anyOverlap) out.push({ reason: 'Self-clash: same section overlapping times', key: 'D:'+k, items: arr });
  });

  byOn(arrByDay, r => key(facOf(r), termOf(r), dayOf(r), timeKey(r))).forEach((arr, k) => {
    if (arr.length >= 3) out.push({ reason: 'Triple-booked: >2 classes at the same time', key: 'E:'+k, items: arr });
  });

  byOn(arrByDay, r => key(facOf(r), termOf(r), dayOf(r), timeKey(r), codeOf(r))).forEach((arr, k) => {
    const s = new Set(arr.map(secOf).filter(Boolean));
    if (arr.length > 1 && s.size > 1) out.push({ reason: 'Cross-listing collision: same course, multiple sections at same time', key: 'F:'+k, items: arr });
  });

  byOn(arrByDay, r => key(facOf(r), termOf(r), dayOf(r), timeKey(r), secOf(r))).forEach((arr, k) => {
    const codes = new Set(arr.map(codeOf).filter(Boolean));
    if (arr.length > 1 && codes.size > 1) out.push({ reason: 'Data-quality: same section, same time, different course codes', key: 'G:'+k, items: arr });
  });

  const mapFTCS = new Map();
  arrByDay.forEach(r => {
    const k = key(facOf(r), dayOf(r), timeKey(r), codeOf(r), secOf(r));
    const set = mapFTCS.get(k) || new Set();
    set.add(termOf(r));
    mapFTCS.set(k, set);
  });
  mapFTCS.forEach((terms, k) => {
    if (terms.size > 1) {
      const items = arrByDay.filter(r => key(r.facultyName || r.faculty || r.instructor || '', r._day || '', r.scheduleKey || r.schedule || r.time || '', r.code || r.courseName || '', r.section || '') === k);
      out.push({ reason: 'Term-mismatch duplicate across terms', key: 'H:'+k, items });
    }
  });

  return out;
}

export function parseTimeBlockToMinutes(block){
  const s = String(block || '').trim().toUpperCase();
  if (!s || s === 'TBA') return { start: NaN, end: NaN };
  const m = s.match(/^(\d{1,2})(?::(\d{2}))?-(\d{1,2})(?::(\d{2}))?(AM|PM|NN)$/);
  const toMinutes = (h, mm, ampm) => {
    let hh = Number(h) || 0;
    const m = Number(mm) || 0;
    if (ampm === 'AM') { if (hh === 12) hh = 0; }
    else if (ampm === 'PM') { if (hh !== 12) hh += 12; }
    return hh * 60 + m;
  };
  if (!m) return { start: NaN, end: NaN };
  const [, h1, m1, h2, m2, suf] = m;
  if (suf === 'NN') {
    const start = toMinutes(h1, m1 || 0, 'AM');
    const end = toMinutes(12, 0, 'PM');
    return { start, end };
  }
  const start = toMinutes(h1, m1 || 0, suf);
  const end = toMinutes(h2, m2 || 0, suf);
  return { start, end };
}

// Cross-faculty overlaps: same term, same F2F day, same section, overlapping time
export function buildCrossFacultyOverlaps(rows) {
  const out = [];
  const arrByDay = expandedByF2FDay(rows);
  const key = (...parts) => parts.map(v => String(v ?? '')).join('|');
  const byTermDaySec = new Map();
  arrByDay.forEach(r => {
    const k = key((r.semester || r.term || '').toLowerCase(), r._day || '', (r.section || '').toLowerCase());
    const a = byTermDaySec.get(k) || []; a.push(r); byTermDaySec.set(k, a);
  });
  byTermDaySec.forEach((arr, k) => {
    if (arr.length < 2) return;
    const n = arr.length;
    const intervals = arr.map(r => {
      const tStr = String(r.scheduleKey || r.schedule || r.time || '').trim();
      if (Number.isFinite(r.timeStartMinutes) && Number.isFinite(r.timeEndMinutes)) return [r.timeStartMinutes, r.timeEndMinutes];
      const tr = parseTimeBlockToMinutes(tStr);
      return [tr.start, tr.end];
    });
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const iStr = String(arr[i].scheduleKey || arr[i].schedule || arr[i].time || '').trim();
        const jStr = String(arr[j].scheduleKey || arr[j].schedule || arr[j].time || '').trim();
        const sameKey = iStr && jStr && iStr === jStr;
        const ov = sameKey || overlap(intervals[i][0], intervals[i][1], intervals[j][0], intervals[j][1]);
        if (ov) { adj[i].push(j); adj[j].push(i); }
      }
    }
    const seen = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      const comp = [];
      const stack = [i];
      seen[i] = true;
      while (stack.length) {
        const v = stack.pop();
        comp.push(v);
        for (const w of adj[v]) {
          if (!seen[w]) { seen[w] = true; stack.push(w); }
        }
      }
      if (comp.length >= 2) {
        const items = comp.map(idx => arr[idx]);
        out.push({ reason: 'Time overlap (any faculty)', key: 'X:' + k + ':' + comp.join(','), items });
      }
    }
  });
  return out;
}
