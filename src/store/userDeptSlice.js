import { createSlice } from '@reduxjs/toolkit';
import { loadUserDeptOptionsThunk, listUserDepartmentsThunk, getUserDepartmentsByUserThunk, createUserDepartmentThunk, updateUserDepartmentThunk, deleteUserDepartmentThunk } from './userDeptThunks';

const initialState = {
  items: [],
  options: { departments: [], positions: [] },
  loading: false,
  error: null,
  filters: { userId: '' },
};

const userDeptSlice = createSlice({
  name: 'userdept',
  initialState,
  reducers: {
    setUserDeptFilters(state, action) { state.filters = { ...state.filters, ...(action.payload || {}) }; },
    clearUserDeptFilters(state) { state.filters = { userId: '' }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadUserDeptOptionsThunk.fulfilled, (state, action) => { state.options = action.payload || { departments: [], positions: [] }; })
      .addCase(listUserDepartmentsThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(listUserDepartmentsThunk.fulfilled, (state, action) => { state.loading = false; state.items = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(listUserDepartmentsThunk.rejected, (state, action) => { state.loading = false; state.error = action.error?.message || 'Failed to load'; })
      .addCase(getUserDepartmentsByUserThunk.fulfilled, (state, action) => { state.items = Array.isArray(action.payload) ? action.payload : []; })
      .addCase(createUserDepartmentThunk.fulfilled, (state, action) => { const r = action.payload; if (r) state.items.unshift(r); })
      .addCase(updateUserDepartmentThunk.fulfilled, (state, action) => {
        const { id, row } = action.payload || {}; const idx = state.items.findIndex(it => String(it.id) === String(id)); if (idx >= 0) state.items[idx] = row;
      })
      .addCase(deleteUserDepartmentThunk.fulfilled, (state, action) => {
        const { id } = action.payload || {}; state.items = state.items.filter(it => String(it.id) !== String(id));
      });
  }
});

export const { setUserDeptFilters, clearUserDeptFilters } = userDeptSlice.actions;
export const selectUserDeptState = (s) => s.userdept;
export const selectUserDeptItems = (s) => s.userdept.items || [];
export const selectUserDeptOptions = (s) => s.userdept.options || { departments: [], positions: [] };
export const selectUserDeptFilters = (s) => s.userdept.filters || { userId: '' };
export default userDeptSlice.reducer;

