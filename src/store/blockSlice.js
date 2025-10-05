import { createSlice, createSelector } from '@reduxjs/toolkit';
import { loadBlocksThunk, createBlockThunk, updateBlockThunk, deleteBlockThunk } from './blockThunks';

const initialState = {
  items: [],
  loading: false,
  error: null,
  page: 1,
  pageSize: 20,
  filters: {
    blockCode: '',
    room: '',
    session: '',
    f2fSched: '',
    examDay: '',
    examSession: '',
    examRoom: '',
    active: '',
  },
};

const blockSlice = createSlice({
  name: 'blocks',
  initialState,
  reducers: {
    setBlockFilters(state, action) { state.filters = { ...state.filters, ...(action.payload || {}) }; state.page = 1; },
    setBlockPage(state, action) { state.page = Math.max(1, Number(action.payload) || 1); },
    setBlockPageSize(state, action) { state.pageSize = Math.max(1, Number(action.payload) || 10); state.page = 1; },
    clearBlockFilters(state) { state.filters = { ...initialState.filters }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadBlocksThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadBlocksThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = Array.isArray(action.payload?.items) ? action.payload.items : Array.isArray(action.payload) ? action.payload : [];
        state.filters = { ...state.filters, ...(action.meta?.arg || {}) };
      })
      .addCase(loadBlocksThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload || action.error?.message; })
      .addCase(createBlockThunk.fulfilled, (state, action) => { const item = action.payload; if (item) state.items.unshift(item); })
      .addCase(updateBlockThunk.fulfilled, (state, action) => { const { id, item } = action.payload || {}; const idx = state.items.findIndex(x => String(x.id) === String(id)); if (idx !== -1) state.items[idx] = { ...state.items[idx], ...item }; })
      .addCase(deleteBlockThunk.fulfilled, (state, action) => { const { id } = action.payload || {}; const idx = state.items.findIndex(x => String(x.id) === String(id)); if (idx !== -1) state.items.splice(idx, 1); });
  }
});

export const { setBlockFilters, clearBlockFilters, setBlockPage, setBlockPageSize } = blockSlice.actions;
export default blockSlice.reducer;

// Selectors
const selectBlockState = (s) => s.blocks;
export const selectBlocks = createSelector(selectBlockState, (s) => s.items);
export const selectBlockFilters = createSelector(selectBlockState, (s) => s.filters);
export const selectBlockPage = createSelector(selectBlockState, (s) => s.page);
export const selectBlockPageSize = createSelector(selectBlockState, (s) => s.pageSize);
export const selectPagedBlocks = createSelector([selectBlocks, selectBlockState], (items, s) => {
  const start = (s.page - 1) * s.pageSize;
  const end = start + s.pageSize;
  return items.slice(start, end);
});
export const selectBlockPageCount = createSelector(selectBlockState, (s) => Math.max(1, Math.ceil((s.items.length || 0) / s.pageSize)));
