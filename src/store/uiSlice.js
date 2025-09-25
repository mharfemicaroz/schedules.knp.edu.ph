import { createSlice } from '@reduxjs/toolkit';

const uiSlice = createSlice({
  name: 'ui',
  initialState: { lastError: null, lastToast: null },
  reducers: {
    setError(state, action) { state.lastError = action.payload || null; },
    clearError(state) { state.lastError = null; },
    setToast(state, action) { state.lastToast = action.payload || null; },
    clearToast(state) { state.lastToast = null; },
  }
});

export const { setError, clearError, setToast, clearToast } = uiSlice.actions;
export default uiSlice.reducer;
