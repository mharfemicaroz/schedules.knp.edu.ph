import React from 'react';
import apiService from '../services/apiService';

let cache = null;
let cacheAt = 0;
const TTL_MS = 5 * 60 * 1000;

export default function useFaculties(params = {}) {
  const [data, setData] = React.useState(cache || []);
  const [loading, setLoading] = React.useState(!cache);
  const [error, setError] = React.useState(null);

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await apiService.getFaculties({ limit: 100000, ...(params || {}) });
      const arr = Array.isArray(list) ? list : (list?.data || []);
      const out = (arr || []).map(f => ({
        label: f.faculty || f.name || '',
        value: f.faculty || f.name || '',
        dept: f.dept || f.department || '',
        id: f.id,
      })).filter(o => o.label);
      out.sort((a,b) => a.label.localeCompare(b.label));
      cache = out;
      cacheAt = Date.now();
      setData(out);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [params]);

  React.useEffect(() => {
    const now = Date.now();
    if (!cache || (now - cacheAt) > TTL_MS) {
      refresh();
    } else {
      setData(cache);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Always return full list (no client-side filtering for bulk selections)
  return { data, loading, error, refresh };
}
