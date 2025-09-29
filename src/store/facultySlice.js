import { createSlice, createSelector } from '@reduxjs/toolkit';
import { loadFacultiesThunk, createFacultyThunk, updateFacultyThunk, deleteFacultyThunk } from './facultyThunks';

const initialState = {
  items: [],
  loading: false,
  error: null,
  filters: {
    q: '',
    department: '',
    designation: '',
    employment: '',
    rank: '',
    email: '',
    load_release_units: '',
  },
};

const facultySlice = createSlice({
  name: 'faculty',
  initialState,
  reducers: {
    setFacultyFilters(state, action) {
      state.filters = { ...state.filters, ...(action.payload || {}) };
    },
    clearFacultyFilters(state) {
      state.filters = { ...initialState.filters };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadFacultiesThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadFacultiesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = Array.isArray(action.payload?.items) ? action.payload.items : [];
        state.filters = { ...state.filters, ...(action.payload?.filters || {}) };
      })
      .addCase(loadFacultiesThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload || action.error?.message; })
      .addCase(createFacultyThunk.fulfilled, (state, action) => {
        const item = action.payload;
        if (item) state.items.unshift(item);
      })
      .addCase(updateFacultyThunk.fulfilled, (state, action) => {
        const { id, item } = action.payload || {};
        const idx = state.items.findIndex(x => String(x.id) === String(id));
        if (idx !== -1) state.items[idx] = { ...state.items[idx], ...item };
      })
      .addCase(deleteFacultyThunk.fulfilled, (state, action) => {
        const { id } = action.payload || {};
        const idx = state.items.findIndex(x => String(x.id) === String(id));
        if (idx !== -1) state.items.splice(idx, 1);
      });
  }
});

export const { setFacultyFilters, clearFacultyFilters } = facultySlice.actions;
export default facultySlice.reducer;

// Selectors
const selectFacultyState = (s) => s.faculty;

export const selectFacultyFilters = createSelector(selectFacultyState, (s) => s.filters);
export const selectAllFaculty = createSelector(selectFacultyState, (s) => s.items);

export const selectFilteredFaculty = createSelector([selectAllFaculty, selectFacultyFilters], (items, f) => {
  const q = String(f.q || '').toLowerCase().trim();
  const matches = (v, needle) => !needle || String(v || '').toLowerCase().includes(String(needle).toLowerCase());
  const val = (x, ...keys) => keys.map(k => x?.[k]).find(v => v != null && v !== '');
  return items.filter(x => {
    const name = val(x, 'name', 'faculty', 'instructorName', 'instructor', 'full_name');
    const dept = val(x, 'department', 'dept', 'department_name', 'departmentName');
    const email = val(x, 'email');
    return (
      (!q || [name, email, dept].some(v => matches(v, q))) &&
      matches(dept, f.department) &&
      matches(x.designation, f.designation) &&
      matches(x.employment, f.employment) &&
      matches(x.rank, f.rank) &&
      matches(email, f.email) &&
      (!f.load_release_units || String(x.load_release_units ?? x.loadReleaseUnits ?? '').includes(String(f.load_release_units)))
    );
  });
});

export const selectFacultyFilterOptions = createSelector(selectAllFaculty, (items) => {
  const pick = (...ks) => {
    const set = new Set();
    items.forEach(i => {
      for (const k of ks) {
        const v = i?.[k];
        if (v != null && String(v).trim() !== '') { set.add(String(v)); break; }
      }
    });
    return Array.from(set).sort();
  };
  return {
    departments: pick('department', 'dept', 'department_name', 'departmentName'),
    designations: pick('designation'),
    employments: pick('employment'),
    ranks: pick('rank'),
  };
});
