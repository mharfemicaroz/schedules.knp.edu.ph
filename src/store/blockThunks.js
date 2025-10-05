import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/apiService';

export const loadBlocksThunk = createAsyncThunk('blocks/loadAll', async (filters = {}, { rejectWithValue }) => {
  try {
    const res = await api.getBlocks(filters);
    return { items: Array.isArray(res) ? res : (res?.items || []) };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to load blocks');
  }
});

export const createBlockThunk = createAsyncThunk('blocks/create', async (payload, { rejectWithValue }) => {
  try {
    const res = await api.createBlock(payload);
    return res?.data || res;
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to create block');
  }
});

export const updateBlockThunk = createAsyncThunk('blocks/update', async ({ id, changes }, { rejectWithValue }) => {
  try {
    const res = await api.updateBlock(id, changes);
    const item = res?.data || res;
    return { id: id ?? item?.id, item };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to update block');
  }
});

export const deleteBlockThunk = createAsyncThunk('blocks/delete', async (id, { rejectWithValue }) => {
  try {
    await api.deleteBlock(id);
    return { id };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to delete block');
  }
});

export const loadBlockSchedulesThunk = createAsyncThunk('blocks/schedules', async (id, { rejectWithValue }) => {
  try {
    const items = await api.getBlockSchedules(id);
    return { id, items };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to load block schedules');
  }
});

