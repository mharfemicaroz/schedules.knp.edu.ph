import { createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../services/apiService';
import { setTokens, setUser, setBusy, logout as logoutAction } from './authSlice';
import { loadSettingsThunk } from './settingsThunks';

export const loginThunk = createAsyncThunk('auth/login', async ({ identifier, password }, { dispatch }) => {
  dispatch(setBusy(true));
  try {
    const res = await apiService.login(identifier, password);
    const accessToken = res.accessToken || res.token || null;
    const refreshToken = res.refreshToken || null;
    const userdata = res.userdata || null;
    dispatch(setTokens({ accessToken, refreshToken }));
    dispatch(setUser(userdata));
    if (accessToken) localStorage.setItem('auth:accessToken', accessToken); else localStorage.removeItem('auth:accessToken');
    if (refreshToken) localStorage.setItem('auth:refreshToken', refreshToken); else localStorage.removeItem('auth:refreshToken');
    if (userdata) localStorage.setItem('auth:user', JSON.stringify(userdata)); else localStorage.removeItem('auth:user');
    apiService.setAuthToken(accessToken);
    // Immediately load system settings now that we are authenticated
    try { await dispatch(loadSettingsThunk()).unwrap(); } catch {}
    // Only check role for admins/managers; skip for non-admin users
    try {
      const role = String(userdata?.role || '').toLowerCase();
      const isAdmin = role === 'admin' || role === 'manager';
      if (isAdmin) {
        await dispatch(checkRoleThunk()).unwrap();
      }
    } catch {}
    return res;
  } finally {
    dispatch(setBusy(false));
  }
});

export const changePasswordThunk = createAsyncThunk('auth/changePassword', async ({ old_password, new_password }) => {
  return await apiService.changePassword(old_password, new_password);
});

export const updateProfileThunk = createAsyncThunk('auth/updateProfile', async (payload, { getState, dispatch }) => {
  const user = getState().auth.user;
  if (!user?.id) throw new Error('No user');
  const res = await apiService.updateUser(user.id, payload);
  const merged = { ...(user || {}), ...((res && res.data) || res) };
  dispatch(setUser(merged));
  localStorage.setItem('auth:user', JSON.stringify(merged));
  return merged;
});

export const checkRoleThunk = createAsyncThunk('auth/checkRole', async (_, { dispatch }) => {
  const res = await apiService.checkRole();
  const u = res.userdata || null;
  if (u) {
    dispatch(setUser(u));
    localStorage.setItem('auth:user', JSON.stringify(u));
  }
  return u;
});

export const logoutThunk = createAsyncThunk('auth/logout', async (_, { dispatch }) => {
  try {
    // Best-effort clear of all local storage for this app
    try { localStorage.clear(); } catch {}
    // Clear in-memory auth
    dispatch(setTokens({ accessToken: null, refreshToken: null }));
    dispatch(setUser(null));
    dispatch(logoutAction());
    apiService.setAuthToken(null);
  } catch {}
  return true;
});
