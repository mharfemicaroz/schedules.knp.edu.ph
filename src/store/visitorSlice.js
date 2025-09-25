import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { checkIpExists, getClientIP, touchLastAccess } from '../utils/visitorLogger';

const initialState = {
  role: null,
  loading: false,
};

export const fetchVisitorRoleThunk = createAsyncThunk('visitor/fetchRole', async () => {
  const clientIp = await getClientIP().catch(() => null);
  if (!clientIp) return { role: null };
  const res = await checkIpExists(clientIp).catch(() => ({ exists: false }));
  if (res?.exists) {
    await touchLastAccess(clientIp).catch(() => {});
    const storedRole = localStorage.getItem('visitor_role');
    return { role: storedRole || null };
  }
  return { role: null };
});

const visitorSlice = createSlice({
  name: 'visitor',
  initialState,
  reducers: {
    setVisitorRole(state, action) { state.role = action.payload || null; },
    setVisitorLoading(state, action) { state.loading = !!action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVisitorRoleThunk.pending, (state) => { state.loading = true; })
      .addCase(fetchVisitorRoleThunk.fulfilled, (state, action) => { state.loading = false; state.role = action.payload?.role || null; })
      .addCase(fetchVisitorRoleThunk.rejected, (state) => { state.loading = false; });
  }
});

export const { setVisitorRole, setVisitorLoading } = visitorSlice.actions;
export default visitorSlice.reducer;

