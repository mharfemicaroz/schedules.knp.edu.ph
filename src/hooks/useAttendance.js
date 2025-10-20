import React from 'react';
import apiService from '../services/apiService';

// Simple client-side cache per key
const cache = new Map();
const TTL_MS = 2 * 60 * 1000;

function keyFor(params) {
  try { return JSON.stringify(params || {}); } catch { return 'k'; }
}

export default function useAttendance(params = {}) {
  const [data, setData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const fetchList = React.useCallback(async (p) => {
    let list = [];
    if (p && p.scheduleId) {
      list = await apiService.getAttendanceBySchedule(p.scheduleId, p);
    } else {
      list = await apiService.listAttendance(p);
    }
    return Array.isArray(list) ? list : (list?.data || []);
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
