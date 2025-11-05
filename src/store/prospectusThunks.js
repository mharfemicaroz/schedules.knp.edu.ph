import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/apiService';

export const loadProspectusThunk = createAsyncThunk('prospectus/loadAll', async (filters = {}, { rejectWithValue }) => {
  try {
    const res = await api.getProspectus(filters);
    const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : (res?.items || []);
    return { items, filters };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to load prospectus');
  }
});

export const createProspectusThunk = createAsyncThunk('prospectus/create', async (payload, { rejectWithValue }) => {
  try {
    const res = await api.createProspectus(payload);
    return Array.isArray(res?.data) ? res.data[0] : (res?.data || res);
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to create prospectus');
  }
});

export const updateProspectusThunk = createAsyncThunk('prospectus/update', async ({ id, changes }, { rejectWithValue }) => {
  try {
    const res = await api.updateProspectus(id, changes);
    const item = Array.isArray(res?.data) ? res.data[0] : (res?.data || res);
    return { id: id ?? item?.id, item };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to update prospectus');
  }
});

export const deleteProspectusThunk = createAsyncThunk('prospectus/delete', async (id, { rejectWithValue }) => {
  try {
    await api.deleteProspectus(id);
    return { id };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to delete prospectus');
  }
});

