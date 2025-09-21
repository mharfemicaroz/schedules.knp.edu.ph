import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { normalizeFacultyDataset } from '../utils/normalize';
import { useToast } from '@chakra-ui/react';

const DataContext = createContext();

export function DataProvider({ children }) {
  const toast = useToast();
  const [raw, setRaw] = useState(null);
  const [data, setData] = useState({ faculties: [], meta: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // UI state
  const [query, setQuery] = useState('');
  const [semester, setSemester] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch('/database.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setRaw(json);
        const normalized = normalizeFacultyDataset(json);
        setData(normalized);
      } catch (e) {
        console.error(e);
        setError(e);
        toast({ status: 'error', title: 'Failed to load data', description: e.message });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  useEffect(() => {
    setPage(1); // reset page when filters/search change
  }, [query, semester]);

  const semesters = useMemo(() => {
    const list = new Set(['All']);
    data.faculties.forEach(f => {
      (f.courses || []).forEach(c => c.semester && list.add(c.semester));
    });
    return Array.from(list);
  }, [data.faculties]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byQuery = (f) => {
      if (!q) return true;
      const values = [f.name, f.email, f.department].map(v => (v == null ? '' : String(v)).toLowerCase());
      return values.some(v => v.includes(q));
    };
    const byDept = () => true; // department filter removed
    const bySem = (f) => {
      if (semester === 'All') return true;
      return (f.courses || []).some(c => c.semester === semester);
    };
    const list = data.faculties.filter(f => byQuery(f) && bySem(f));
    // Sort alphabetically by faculty name
    return list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [data.faculties, query, semester]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filtered.slice(start, end);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    const totalFaculty = filtered.length;
    let totalLoad = 0, totalOverload = 0, totalCourses = 0;
    filtered.forEach(f => {
      totalLoad += f.stats?.loadHours || 0;
      const release = Number.isFinite(f.loadReleaseUnits) ? f.loadReleaseUnits : Number(f.loadReleaseUnits) || 0;
      const baseline = Math.max(0, 24 - release);
      const over = f.stats?.overloadHours != null ? f.stats.overloadHours : Math.max(0, (f.stats?.loadHours || 0) - baseline);
      totalOverload += over;
      totalCourses += f.stats?.courseCount || (f.courses?.length || 0);
    });
    return { totalFaculty, totalLoad, totalOverload, totalCourses };
  }, [filtered]);

  const allCourses = useMemo(() => {
    const rows = [];
    data.faculties.forEach(f => {
      (f.courses || []).forEach(c => rows.push({ ...c, facultyId: f.id, facultyName: f.name, department: f.department }));
    });
    return rows;
  }, [data.faculties]);

  const value = {
    raw,
    data,
    loading,
    error,
    faculties: filtered,
    page,
    pageSize,
    setPage,
    setPageSize,
    pageCount: Math.max(1, Math.ceil(filtered.length / pageSize)),
    paged,
    query,
    setQuery,
    semester,
    setSemester,
    semesters,
    stats,
    allCourses,
  };

  return (
    <DataContext.Provider value={value}>{children}</DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
