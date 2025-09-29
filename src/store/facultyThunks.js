import { createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/apiService';

export const loadFacultiesThunk = createAsyncThunk('faculty/loadAll', async (filters = {}, { rejectWithValue }) => {
  try {
    const res = await api.getFaculties(filters);
    // Support either { data: [...] } or direct array
    const items = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : (res?.items || []);
    return { items, filters };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to load faculties');
  }
});

export const createFacultyThunk = createAsyncThunk('faculty/create', async (payload, { rejectWithValue }) => {
  try {
    const res = await api.createFaculty(payload);
    return Array.isArray(res?.data) ? res.data[0] : (res?.data || res);
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to create faculty');
  }
});

export const updateFacultyThunk = createAsyncThunk('faculty/update', async ({ id, changes }, { rejectWithValue }) => {
  try {
    const res = await api.updateFaculty(id, changes);
    const item = Array.isArray(res?.data) ? res.data[0] : (res?.data || res);
    return { id: id ?? item?.id, item };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to update faculty');
  }
});

export const deleteFacultyThunk = createAsyncThunk('faculty/delete', async (id, { rejectWithValue }) => {
  try {
    await api.deleteFaculty(id);
    return { id };
  } catch (e) {
    return rejectWithValue(e.message || 'Failed to delete faculty');
  }
});

