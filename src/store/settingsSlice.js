import { createSlice } from '@reduxjs/toolkit';
import { loadSettingsThunk, updateSettingsThunk } from './settingsThunks';

const initialState = {
  data: { schedulesView: { school_year: '', semester: '' }, schedulesLoad: { school_year: '', semester: '' }, updatedAt: null },
  loading: false,
  error: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setSettings(state, action) { state.data = { ...state.data, ...(action.payload || {}) }; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadSettingsThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loadSettingsThunk.fulfilled, (state, action) => { state.loading = false; state.data = { ...state.data, ...(action.payload || {}) }; })
      .addCase(loadSettingsThunk.rejected, (state, action) => { state.loading = false; state.error = action.error?.message || 'Failed to load settings'; })
      .addCase(updateSettingsThunk.fulfilled, (state, action) => { state.data = { ...state.data, ...(action.payload || {}) }; });
  }
});

export const { setSettings } = settingsSlice.actions;
export const selectSettings = (s) => s.settings?.data || initialState.data;
export default settingsSlice.reducer;

