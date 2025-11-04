import React from 'react';
import apiService from '../services/apiService';

// Simple client-side cache per key
const cache = new Map();
const TTL_MS = 2 * 60 * 1000;

function keyFor(params) {
  try {
    const { schedules, ...rest } = params || {};
    return JSON.stringify(rest || {});
  } catch { return 'k'; }
}

export default function useAttendance(params = {}) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const fetchList = React.useCallback(async (p) => {
    // Extract UI paging; we'll page client-side when doing faculty filter
    const originalPage = Number(p?.page) || 1;
    const originalLimit = Number(p?.limit) || 100;
    const hasFacultyFilter = Boolean(p && (p.facultyId || p.faculty || p.faculty_id || p.facultyName || p.instructor));

    // Do not forward local-only params to the API
    const p2 = { ...(p || {}) };
    if ('schedules' in p2) delete p2.schedules;
    // Server now supports faculty filters; keep requested page/limit

    let list = [];
    if (p && p.scheduleId) {
      list = await apiService.getAttendanceBySchedule(p.scheduleId, p2);
    } else {
      list = await apiService.listAttendance(p2);
    }
    const arr = Array.isArray(list) ? list : (list?.data || []);
    // Build schedule lookup from provided schedules (optional)
    const schedArr = Array.isArray(p?.schedules) ? p.schedules : [];
    const schedMap = new Map();
    for (const s of schedArr) { const id = Number(s?.id); if (Number.isFinite(id)) schedMap.set(id, s); }
    // Client-side filtering by faculty when backend doesn't support it
    const normalize = (s) => String(s || '').trim().toLowerCase();
    const facId = p && (p.facultyId || p.faculty_id);
    const facName = p && (p.faculty || p.facultyName || p.instructor);
    let filtered = arr;
    // Optional term filter (1st, 2nd, Sem) by schedule.term when available
    const termFilter = String(p?.term || '').trim();
    if (termFilter) {
      const tf = termFilter.toLowerCase();
      const matchTerm = (t) => {
        const s = String(t || '').toLowerCase();
        if (!s) return false;
        if (tf.startsWith('1')) return /(^|\b)(1|first|1st)(\b|$)/i.test(s);
        if (tf.startsWith('2')) return /(^|\b)(2|second|2nd)(\b|$)/i.test(s);
        if (tf.startsWith('s')) return /(^|\b)(sem|semes|semester|semestral)(\b|$)/i.test(s);
        return s.includes(tf);
      };
      filtered = filtered.filter((r) => {
        const sid = Number(r?.scheduleId || r?.schedule_id || r?.schedule?.id);
        const schFull = schedMap.get(sid) || r?.schedule || r;
        return matchTerm(schFull?.term || schFull?.semester);
      });
    }
    if (facId) {
      const idStr = String(facId);
      filtered = filtered.filter((r) => {
        const sid = Number(r?.scheduleId || r?.schedule_id || r?.schedule?.id);
        const schFull = schedMap.get(sid) || r?.schedule || r;
        const a = schFull && (schFull.facultyId != null ? String(schFull.facultyId) : undefined);
        const b = schFull && (schFull.faculty_id != null ? String(schFull.faculty_id) : undefined);
        if ((a && a === idStr) || (b && b === idStr)) return true;
        // Fallback: if no facultyId on schedule, match by instructor name when possible
        const nm = normalize(schFull && (schFull.instructor || schFull.faculty || ''));
        const wantName = normalize(p && (p.faculty || p.facultyName || p.instructor || ''));
        return !!wantName && !!nm && nm.includes(wantName);
      });
    } else if (facName) {
      const target = normalize(facName);
      filtered = filtered.filter((r) => {
        const sid = Number(r?.scheduleId || r?.schedule_id || r?.schedule?.id);
        const schFull = schedMap.get(sid) || r?.schedule || r;
        const a = normalize(schFull && (schFull.instructor || schFull.faculty || ''));
        return target ? a.includes(target) : true;
      });
    }
    // Attach schedule data for rendering when missing
    const enriched = filtered.map((r) => {
      const sid = Number(r?.scheduleId || r?.schedule_id || r?.schedule?.id);
      const sch = schedMap.get(sid);
      if (sch) return { ...r, schedule: { ...sch, ...(r.schedule || {}) } };
      return r;
    });
    return enriched;
  }, []);

  const refresh = React.useCallback(async (force = false) => {
    const key = keyFor(params);
    const now = Date.now();
    const c = cache.get(key);
    if (!force && c && (now - c.at) < TTL_MS) {
      setData(c.data);
      setLoading(false);
      return c.data;
    }
    try {
      if (!c) setLoading(true);
      setError(null);
      const arr = await fetchList(params);
      cache.set(key, { data: arr, at: Date.now() });
      setData(arr);
      return arr;
    } catch (e) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [params, fetchList]);

  React.useEffect(() => {
    const key = keyFor(params);
    const c = cache.get(key);
    if (c) {
      setData(c.data);
      setLoading(false);
      // SWR: refresh in background
      fetchList(params).then((arr) => {
        cache.set(key, { data: arr, at: Date.now() });
        setData(arr);
      }).catch(() => {});
    } else {
      refresh(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(params)]);

  return { data, loading, error, refresh };
}
