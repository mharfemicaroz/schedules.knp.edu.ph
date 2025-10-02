import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import apiService from '../services/apiService';

const local = {
  get name() { try { return localStorage.getItem('guest:name') || ''; } catch { return ''; } },
  get role() { try { return localStorage.getItem('guest:role') || ''; } catch { return ''; } },
  set(name, role){ try { localStorage.setItem('guest:name', name||''); localStorage.setItem('guest:role', role||''); } catch {} },
};

export const touchGuestThunk = createAsyncThunk('guest/touch', async ({ name, role, route }) => {
  const res = await apiService.postGuestAccess({ name, role, route });
  return res;
});

const guestSlice = createSlice({
  name: 'guest',
  initialState: { name: local.name, role: local.role, lastTouchedAt: null, modalOpen: false },
  reducers: {
    setGuest(state, action){ const { name, role } = action.payload || {}; state.name = name || ''; state.role = role || ''; },
    openModal(state){ state.modalOpen = true; },
    closeModal(state){ state.modalOpen = false; },
  },
  extraReducers: (b) => {
    b.addCase(touchGuestThunk.fulfilled, (state, action) => { state.lastTouchedAt = new Date().toISOString(); });
  }
});

export const { setGuest, openModal, closeModal } = guestSlice.actions;
export default guestSlice.reducer;
