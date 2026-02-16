import { createSlice } from '@reduxjs/toolkit';
import { loadSettingsThunk, updateSettingsThunk } from './settingsThunks';

const initialState = {
  data: {
    schedulesView: { school_year: '', semester: '' },
    schedulesLoad: { school_year: '', semester: '' },
    gradesSubmission: { school_year: '', semester: '' },
    attendance: { school_year: '', semester: '' },
    evaluations: { school_year: '', semester: '' },
    evaluationsEnabled: true,
    bellSystem: {
      enabled: false,
      intervalMinutes: 60,
      delayBeforeSeconds: 0,
      delayAfterSeconds: 0,
      loopCount: 1,
      loopGapSeconds: 2,
      volumePercent: 80,
      sounds: {
        before: null,
        on: null,
        after: null,
      },
      sessions: {
        am: { label: 'AM Session', enabled: true, start: '08:00', end: '12:00' },
        pm: { label: 'PM Session', enabled: true, start: '13:00', end: '17:00' },
        eve: { label: 'EVE Session', enabled: true, start: '17:00', end: '21:00' },
      },
    },
    updatedAt: null,
  },
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
