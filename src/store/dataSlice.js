import { createSlice, createSelector } from '@reduxjs/toolkit';
import { loadAllSchedules, applyApiFiltersThunk, loadAcademicCalendar, loadHolidaysThunk, updateScheduleThunk, deleteScheduleThunk } from './dataThunks';

const initialState = {
  raw: null,
  faculties: [],
  acadData: null,
  holidays: [],
  loading: false,
  error: null,
  // UI state
  query: '',
  semester: 'All',
  facultyFilter: '',
  departmentFilter: '',
  employmentFilter: '',
  page: 1,
  pageSize: 10,
  useApiFiltering: true,
  apiFilters: {},
};

const dataSlice = createSlice({
  name: 'data',
  initialState,
  reducers: {
    setLoading(state, action) { state.loading = !!action.payload; },
    setError(state, action) { state.error = action.payload || null; },
    setRaw(state, action) { state.raw = action.payload || null; },
    setFaculties(state, action) { state.faculties = Array.isArray(action.payload) ? action.payload : []; },
    setAcadData(state, action) { state.acadData = action.payload || null; },
    setHolidays(state, action) { state.holidays = Array.isArray(action.payload) ? action.payload : []; },
    setQuery(state, action) { state.query = action.payload || ''; state.page = 1; },
    setSemester(state, action) { state.semester = action.payload || 'All'; state.page = 1; },
    setFacultyFilter(state, action) { state.facultyFilter = action.payload || ''; state.page = 1; },
    setDepartmentFilter(state, action) { state.departmentFilter = action.payload || ''; state.page = 1; },
    setEmploymentFilter(state, action) { state.employmentFilter = action.payload || ''; state.page = 1; },
    setPage(state, action) { state.page = Number(action.payload) || 1; },
    setPageSize(state, action) { state.pageSize = Number(action.payload) || 10; state.page = 1; },
    setUseApiFiltering(state, action) { state.useApiFiltering = !!action.payload; },
    setApiFilters(state, action) { state.apiFilters = action.payload || {}; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadAllSchedules.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadAllSchedules.fulfilled, (state, action) => {
        state.loading = false;
        state.raw = action.payload.raw;
        state.faculties = action.payload.data.faculties;
      })
      .addCase(loadAllSchedules.rejected, (state, action) => { state.loading = false; state.error = action.error; })
      .addCase(applyApiFiltersThunk.pending, (state) => { state.loading = true; })
      .addCase(applyApiFiltersThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.faculties = action.payload.data.faculties;
        state.apiFilters = action.payload.filters || {};
      })
      .addCase(applyApiFiltersThunk.rejected, (state, action) => { state.loading = false; state.error = action.error; })
      .addCase(loadAcademicCalendar.fulfilled, (state, action) => { state.acadData = action.payload || null; })
      .addCase(loadHolidaysThunk.fulfilled, (state, action) => { state.holidays = action.payload || []; });
    builder
      .addCase(updateScheduleThunk.fulfilled, (state, action) => {
        const { id, changes } = action.payload || {};
        if (!id) return;
        for (const f of state.faculties) {
          const idx = (f.courses || []).findIndex(c => String(c.id) === String(id));
          if (idx !== -1) {
            f.courses[idx] = { ...f.courses[idx], ...changes };
            break;
          }
        }
      })
      .addCase(deleteScheduleThunk.fulfilled, (state, action) => {
        const { id } = action.payload || {};
        if (!id) return;
        for (const f of state.faculties) {
          const idx = (f.courses || []).findIndex(c => String(c.id) === String(id));
          if (idx !== -1) {
            f.courses.splice(idx, 1);
            f.stats = { ...(f.stats || {}) };
            if (typeof f.stats.courseCount === 'number') f.stats.courseCount = Math.max(0, f.stats.courseCount - 1);
            break;
          }
        }
      });
  }
});

export const { setLoading, setError, setRaw, setFaculties, setAcadData, setHolidays, setQuery, setSemester, setFacultyFilter, setDepartmentFilter, setEmploymentFilter, setPage, setPageSize, setUseApiFiltering, setApiFilters } = dataSlice.actions;
export default dataSlice.reducer;

// Memoized selectors
const selectData = (s) => s.data;
export const selectSemesters = createSelector(selectData, (data) => {
  const list = new Set(['All']);
  (data.faculties || []).forEach(f => { (f.courses || []).forEach(c => c.semester && list.add(c.semester)); });
  return Array.from(list);
});

export const selectFilteredFaculties = createSelector(selectData, (data) => {
  const { query, facultyFilter, departmentFilter, employmentFilter } = data;
  const q = String(query || '').trim().toLowerCase();
  const byQuery = (f) => {
    if (!q) return true;
    const values = [f.name, f.email, f.department].map(v => (v == null ? '' : String(v)).toLowerCase());
    return values.some(v => v.includes(q));
  };
  const norm = (s) => String(s || '').toLowerCase().trim();
  const byFaculty = (f) => !facultyFilter || norm(f.name) === norm(facultyFilter) || norm(f.faculty) === norm(facultyFilter);
  const byDept = (f) => !departmentFilter || norm(f.department) === norm(departmentFilter) || norm(f.dept) === norm(departmentFilter);
  const byEmp = (f) => !employmentFilter || norm(f.employment) === norm(employmentFilter);
  const list = data.faculties.filter(f => byQuery(f) && byFaculty(f) && byDept(f) && byEmp(f));
  return list.sort((a, b) => String(a.name).localeCompare(String(b.name)));
});

export const selectPagedFaculties = createSelector(selectFilteredFaculties, selectData, (filtered, data) => {
  const start = (data.page - 1) * data.pageSize; const end = start + data.pageSize; return filtered.slice(start, end);
});
export const selectPageCount = createSelector(selectFilteredFaculties, selectData, (filtered, data) => Math.max(1, Math.ceil(filtered.length / data.pageSize)) );

export const selectStats = createSelector(selectFilteredFaculties, (filtered) => {
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
});

export const selectAllCourses = createSelector(selectData, (data) => {
  const rows = [];
  data.faculties.forEach(f => { (f.courses || []).forEach(c => rows.push({ ...c, facultyId: f.id, facultyName: f.name, department: f.department })); });
  return rows;
});
