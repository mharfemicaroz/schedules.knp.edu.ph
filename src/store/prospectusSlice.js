import { createSlice, createSelector } from '@reduxjs/toolkit';
import { loadProspectusThunk, createProspectusThunk, updateProspectusThunk, deleteProspectusThunk } from './prospectusThunks';

const initialState = {
  items: [],
  loading: false,
  error: null,
  filters: {
    q: '',
    programcode: '',
    yearlevel: '',
    semester: '',
    curriculum_year: '',
    dept: '',
    active: '',
  },
};

const prospectusSlice = createSlice({
  name: 'prospectus',
  initialState,
  reducers: {
    setProspectusFilters(state, action) {
      state.filters = { ...state.filters, ...(action.payload || {}) };
    },
    clearProspectusFilters(state) {
      state.filters = { ...initialState.filters };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProspectusThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadProspectusThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = Array.isArray(action.payload?.items) ? action.payload.items : [];
        state.filters = { ...state.filters, ...(action.payload?.filters || {}) };
      })
      .addCase(loadProspectusThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload || action.error?.message; })
      .addCase(createProspectusThunk.fulfilled, (state, action) => {
        const item = action.payload; if (item) state.items.unshift(item);
      })
      .addCase(updateProspectusThunk.fulfilled, (state, action) => {
        const { id, item } = action.payload || {};
        const idx = state.items.findIndex(x => String(x.id) === String(id));
        if (idx !== -1) state.items[idx] = { ...state.items[idx], ...item };
      })
      .addCase(deleteProspectusThunk.fulfilled, (state, action) => {
        const { id } = action.payload || {};
        const idx = state.items.findIndex(x => String(x.id) === String(id));
        if (idx !== -1) state.items.splice(idx, 1);
      });
  }
});

export const { setProspectusFilters, clearProspectusFilters } = prospectusSlice.actions;
export default prospectusSlice.reducer;

// Selectors
const selectProspectusState = (s) => s.prospectus;

export const selectProspectusFilters = createSelector(selectProspectusState, (s) => s.filters);
export const selectAllProspectus = createSelector(selectProspectusState, (s) => s.items);

export const selectFilteredProspectus = createSelector([selectAllProspectus, selectProspectusFilters], (items, f) => {
  const q = String(f.q || '').toLowerCase().trim();
  const matches = (v, needle) => !needle || String(v || '').toLowerCase().includes(String(needle).toLowerCase());
  return items.filter(x => {
    const name = x.courseName || x.course_name || x.courseTitle || x.course_title || '';
    const ctype = x.courseType || x.coursetype || '';
    const program = x.programcode || x.program || '';
    const sy = x.curriculumYear || x.curriculum_year || '';
    return (
      (!q || [name, ctype, program, sy].some(v => matches(v, q))) &&
      matches(program, f.programcode) &&
      (!f.yearlevel || String(x.yearlevel || '').includes(String(f.yearlevel))) &&
      (!f.semester || String(x.semester || '').includes(String(f.semester))) &&
      matches(sy, f.curriculum_year) &&
      matches(x.dept, f.dept)
    );
  });
});

export const selectProspectusFilterOptions = createSelector(selectAllProspectus, (items) => {
  const uniq = (arr) => Array.from(new Set(arr.filter(v => v != null && String(v).trim() !== ''))).sort();
  return {
    programs: uniq(items.map(i => i.programcode || i.program || '')),
    years: uniq(items.map(i => i.yearlevel).map(String)),
    semesters: uniq(items.map(i => i.semester).map(String)),
    curriculumYears: uniq(items.map(i => i.curriculumYear || i.curriculum_year || '')),
    departments: uniq(items.map(i => i.dept || '')),
    courseTypes: uniq(items.map(i => i.courseType || i.coursetype || '')),
  };
});
