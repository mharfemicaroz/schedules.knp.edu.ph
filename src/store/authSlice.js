import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  busy: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setBusy(state, action) { state.busy = !!action.payload; },
    setTokens(state, action) { state.accessToken = action.payload?.accessToken || null; state.refreshToken = action.payload?.refreshToken || null; },
    setUser(state, action) { state.user = action.payload || null; },
    logout(state) { state.accessToken = null; state.refreshToken = null; state.user = null; state.busy = false; },
  },
});

export const { setBusy, setTokens, setUser, logout } = authSlice.actions;
export default authSlice.reducer;

