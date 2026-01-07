// API Service for seamless integration with backend endpoints
import API_CONFIG from "../config/apiConfig";
// Note: avoid importing the Redux store here to prevent circular deps.

class ApiService {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this._baseURLAbsolute = null;
    this.schedulesPath = "/schedules";
    this.blocksPath = "/blocks";
    this.prospectusPath = "/prospectus";
    this.attendancePath = "/attendance";
    this.authPath = "/auth";
    this.usersPath = "/users";
    this.userDeptPath = "/userdepartment";
    this.token = null;
    this._didAutoLogout = false;
    this.onUnauthorized = null; // optional callback set from app bootstrap
    this._refreshing = null; // in-flight refresh promise
    try {
      if (typeof window !== 'undefined') {
        const abs = new URL(this.baseURL, window.location.origin).toString().replace(/\/$/, '');
        this._baseURLAbsolute = abs;
      } else {
        this._baseURLAbsolute = (this.baseURL || '').replace(/\/$/, '');
      }
    } catch {
      this._baseURLAbsolute = (this.baseURL || '').replace(/\/$/, '');
    }

    // One-time global fetch interceptor to auto-logout on invalid/expired tokens
    try {
      if (typeof window !== 'undefined' && !window.__apiFetchPatched) {
        window.__apiFetchPatched = true;
        const origFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
          const res = await origFetch(...args);
          try {
            const rawUrl = String(args && args[0] || '');
            const absoluteUrl = rawUrl.startsWith('http')
              ? rawUrl
              : new URL(rawUrl, window.location.origin).toString();
            const isApiUrl = this._baseURLAbsolute && absoluteUrl.startsWith(this._baseURLAbsolute);
            const isAuthUrl = isApiUrl && absoluteUrl.startsWith(`${this._baseURLAbsolute}${this.authPath}`);
            if ((res.status === 401) && isApiUrl && !isAuthUrl && !this._didAutoLogout) {
              this._didAutoLogout = true;
              this.token = null;
              if (typeof this.onUnauthorized === 'function') {
                try { this.onUnauthorized(); } catch {}
              } else {
                // Fallback: best-effort local clear
                try {
                  localStorage.removeItem('auth:accessToken');
                  localStorage.removeItem('auth:refreshToken');
                  localStorage.removeItem('auth:user');
                } catch {}
              }
            }
          } catch {}
          return res;
        };
      }
    } catch {}
  }

  // Centralized fetch wrapper with 401 auto-logout
  async _fetch(url, options = {}, retry = true) {
    const res = await fetch(url, options);
    try {
      if (res.status === 401) {
        const isAuthUrl = typeof url === 'string' && url.indexOf(this.baseURL + this.authPath) === 0;
        if (!isAuthUrl && retry) {
          const ok = await this._ensureFreshAccessToken();
          if (ok) {
            const nextOpts = { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${this.token}` } };
            return await this._fetch(url, nextOpts, false);
          }
        }
        // fallthrough: unauthorized and cannot refresh
        if (!this._didAutoLogout) {
          this._didAutoLogout = true;
          this.token = null;
          if (typeof this.onUnauthorized === 'function') {
            try { this.onUnauthorized(); } catch {}
          } else {
            try {
              localStorage.removeItem('auth:accessToken');
              localStorage.removeItem('auth:refreshToken');
              localStorage.removeItem('auth:user');
            } catch {}
          }
        }
      }
    } catch {}
    return res;
  }

  async _ensureFreshAccessToken() {
    try {
      const storedRefresh = typeof localStorage !== 'undefined' ? localStorage.getItem('auth:refreshToken') : null;
      if (!storedRefresh) return false;
      // Deduplicate concurrent refresh calls
      if (!this._refreshing) {
        this._refreshing = (async () => {
          try {
            const res = await this.refreshToken(storedRefresh);
            const newAccess = res.accessToken || res.token;
            const newRefresh = res.refreshToken || storedRefresh;
            if (!newAccess) return false;
            this.setAuthToken(newAccess);
            try { localStorage.setItem('auth:accessToken', newAccess); } catch {}
            if (newRefresh) { try { localStorage.setItem('auth:refreshToken', newRefresh); } catch {} }
            return true;
          } catch {
            return false;
          } finally {
            // small delay to avoid immediate reuse
            const p = this._refreshing; this._refreshing = null; void p;
          }
        })();
      }
      return await this._refreshing;
    } catch {
      return false;
    }
  }

  // Helper method for making API requests
  async request(endpoint, options = {}) {
    const fullEndpoint = `${this.schedulesPath}${endpoint}`;
    const url = `${this.baseURL}${fullEndpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await this._fetch(url, config);

      if (!response.ok) {
        let raw = '';
        try { raw = await response.text(); } catch {}
        const err = new Error(`HTTP ${response.status}: ${response.statusText}`);
        err.status = response.status;
        try { err.retryAfter = response.headers.get('Retry-After'); } catch {}
        err.body = raw;
        try { err.headers = response.headers; } catch {}
        throw err;
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${fullEndpoint}`, error);
      throw error;
    }
  }

  // SCHEDULES helpers
  // Optional helper: server-provided course mapping across blocks
  async getCourseMapping(params = {}) {
    const search = new URLSearchParams();
    const { programcode, yearlevel, course } = params || {};
    if (programcode) search.set('programcode', programcode);
    if (yearlevel) search.set('yearlevel', yearlevel);
    if (course) search.set('course', course);
    const qs = search.toString();
    const url = `${this.baseURL}${this.schedulesPath}/by-course${qs ? `?${qs}` : ''}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (res.status === 404) return null; // endpoint not implemented
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // New: server-side vacant block counter for a course (optional; falls back client-side if 404)
  async getVacantBlocksForCourse(params = {}) {
    const search = new URLSearchParams();
    const { course, programcode, yearlevel, schoolyear, semester } = params || {};
    if (course) search.set('course', course);
    if (programcode) search.set('programcode', programcode);
    if (yearlevel) search.set('yearlevel', yearlevel);
    if (schoolyear) search.set('schoolyear', schoolyear);
    if (semester) search.set('semester', semester);
    const qs = search.toString();
    const url = `${this.baseURL}${this.blocksPath}/vacant-count${qs ? `?${qs}` : ''}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (res.status === 404) return null; // not implemented on server
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const body = await res.json();
    const getNum = (v) => (typeof v === 'number' && !Number.isNaN(v)) ? v : null;
    if (body == null) return null;
    if (getNum(body) != null) return getNum(body);
    if (getNum(body.count) != null) return getNum(body.count);
    if (getNum(body.vacant) != null) return getNum(body.vacant);
    if (getNum(body.vacantCount) != null) return getNum(body.vacantCount);
    if (getNum(body.totalVacant) != null) return getNum(body.totalVacant);
    if (Array.isArray(body.items) && body.items.length > 0) {
      const first = body.items[0];
      if (getNum(first?.vacant) != null) return getNum(first.vacant);
      if (getNum(first?.count) != null) return getNum(first.count);
      if (getNum(first?.vacantCount) != null) return getNum(first.vacantCount);
    }
    return null;
  }
  async checkScheduleConflict(id, payload) {
    const url = `${this.baseURL}${this.schedulesPath}/${encodeURIComponent(id)}/check`;
    const res = await this._fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(payload || {}) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getScheduleSuggestions(id, payload, { maxDepth } = {}) {
    const search = new URLSearchParams();
    if (maxDepth != null) search.set('maxDepth', String(maxDepth));
    const qs = search.toString();
    const url = `${this.baseURL}${this.schedulesPath}/${encodeURIComponent(id)}/suggestions${qs ? `?${qs}` : ''}`;
    const res = await this._fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(payload || {}) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getFacultySummary(params = {}) {
    const search = new URLSearchParams();
    const sy = params.sy || params.schoolyear || params.school_year;
    const sem = params.sem || params.semester || params.semester_short;
    if (sy) search.set('schoolyear', sy);
    if (sem) search.set('semester', sem);
    const qs = search.toString();
    const url = `${this.baseURL}${this.schedulesPath}/faculty/summary${qs ? `?${qs}` : ''}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // POST /api/schedules/:id/resolve - Resolve double-book by deleting conflicting row and saving candidate
  async resolveSchedule(id, payload) {
    const url = `${this.baseURL}${this.schedulesPath}/${encodeURIComponent(id)}/resolve`;
    const res = await this._fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(payload || {}) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // BLOCKS API
  async getBlocks(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") qs.append(k, v);
    });
    const url = `${this.baseURL}${this.blocksPath}${qs.toString() ? `/?${qs.toString()}` : '/'}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getBlockStats() {
    const url = `${this.baseURL}${this.blocksPath}/stats`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getBlockById(id) {
    const url = `${this.baseURL}${this.blocksPath}/${id}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getBlockByCode(code) {
    const url = `${this.baseURL}${this.blocksPath}/code/${encodeURIComponent(code)}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getBlockSchedules(id) {
    const url = `${this.baseURL}${this.blocksPath}/${id}/schedules`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async createBlock(payload) {
    const url = `${this.baseURL}${this.blocksPath}/`;
    const res = await this._fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async bulkCreateBlocks(items) {
    const url = `${this.baseURL}${this.blocksPath}/bulk`;
    const body = Array.isArray(items) ? items : { items };
    const res = await this._fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async updateBlock(id, payload) {
    const url = `${this.baseURL}${this.blocksPath}/${id}`;
    const res = await this._fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async deleteBlock(id) {
    const url = `${this.baseURL}${this.blocksPath}/${id}`;
    const res = await this._fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // Helper for absolute paths (e.g., /auth, /users)
  async requestAbs(path, options = {}) {
    const url = `${this.baseURL}${path}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        ...options.headers,
      },
      ...options,
    };
    const res = await this._fetch(url, config);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  setAuthToken(token) {
    this.token = token || null;
    // Allow future unauthorized detection after a fresh login
    if (this.token) this._didAutoLogout = false;
  }

  setUnauthorizedHandler(fn) {
    this.onUnauthorized = typeof fn === 'function' ? fn : null;
  }

  // PROSPECTUS API
  async getProspectus(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== "") qs.append(k, v);
    });
    const url = `${this.baseURL}${this.prospectusPath}${qs.toString() ? `/?${qs.toString()}` : '/'}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getProspectusStats(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') qs.append(k, v);
    });
    const url = `${this.baseURL}${this.prospectusPath}/stats${qs.toString() ? `/?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getProspectusByProgram(programcode) {
    const url = `${this.baseURL}${this.prospectusPath}/program/${encodeURIComponent(programcode)}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async createProspectus(payload) {
    const url = `${this.baseURL}${this.prospectusPath}/`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async bulkCreateProspectus(items) {
    const url = `${this.baseURL}${this.prospectusPath}/bulk`;
    const body = Array.isArray(items) ? items : { items };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async updateProspectus(id, payload) {
    const url = `${this.baseURL}${this.prospectusPath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async deleteProspectus(id) {
    const url = `${this.baseURL}${this.prospectusPath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // USER-DEPARTMENT API
  async getUserDeptOptions() {
    const url = `${this.baseURL}${this.userDeptPath}/options`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }
  async listUserDepartments(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== null && v !== undefined && v !== '') qs.append(k, v); });
    const url = `${this.baseURL}${this.userDeptPath}${qs.toString() ? `/?${qs.toString()}` : '/'}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }
  async getUserDepartmentsByUser(userId) {
    const url = `${this.baseURL}${this.userDeptPath}/${encodeURIComponent(userId)}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }
  async createUserDepartment(payload) {
    const url = `${this.baseURL}${this.userDeptPath}/`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }
  async updateUserDepartment(id, payload) {
    const url = `${this.baseURL}${this.userDeptPath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }
  async deleteUserDepartment(id) {
    const url = `${this.baseURL}${this.userDeptPath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // ATTENDANCE API
  async listAttendance(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") search.set(k, v);
    });
    const qs = search.toString();
    const url = `${this.baseURL}${this.attendancePath}${qs ? `/?${qs}` : '/'}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getAttendanceStats(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") search.set(k, v);
    });
    const qs = search.toString();
    const url = `${this.baseURL}${this.attendancePath}/stats${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getAttendanceStatsByFaculty(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") search.set(k, v);
    });
    const qs = search.toString();
    const url = `${this.baseURL}${this.attendancePath}/stats/by-faculty${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getAttendanceById(id) {
    const url = `${this.baseURL}${this.attendancePath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getAttendanceBySchedule(scheduleId, params = {}) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") search.set(k, v);
    });
    const qs = search.toString();
    const url = `${this.baseURL}${this.attendancePath}/schedule/${encodeURIComponent(scheduleId)}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async createAttendance(payload) {
    const url = `${this.baseURL}${this.attendancePath}/`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async bulkCreateAttendance(items) {
    const url = `${this.baseURL}${this.attendancePath}/bulk`;
    const body = Array.isArray(items) ? items : { items };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async updateAttendance(id, payload) {
    const url = `${this.baseURL}${this.attendancePath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async deleteAttendance(id) {
    const url = `${this.baseURL}${this.attendancePath}/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // GET /api/schedules - Get all schedules with optional filtering and pagination
  async getAllSchedules(params = {}) {
    const queryParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        queryParams.append(key, value);
      }
    });

    const queryString = queryParams.toString();
    const endpoint = queryString ? `/?${queryString}` : "/";

    return this.request(endpoint);
  }

  // GET /api/schedules/stats - Get schedule statistics
  async getScheduleStats() {
    return this.request("/stats");
  }

  // GET /api/schedules/filters - Get schedules with filters
  async getSchedulesWithFilters(filters = {}) {
    return this.getAllSchedules(filters);
  }

  // GET /api/schedules/grouped/program - Get schedules grouped by program
  async getSchedulesGroupedByProgram() {
    return this.request("/grouped/program");
  }

  // GET /api/schedules/grouped/department - Get schedules grouped by department
  async getSchedulesGroupedByDepartment() {
    return this.request("/grouped/department");
  }

  // GET /api/schedules/:id - Get schedule by ID
  async getScheduleById(id) {
    return this.request(`/${id}`);
  }

  // GET /api/schedules/:id/history - Get long-text schedule history
  async getScheduleHistory(id) {
    const url = `${this.baseURL}${this.schedulesPath}/${encodeURIComponent(id)}/history`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // GET /api/schedules/program/:programcode - Get schedules by program code
  async getSchedulesByProgramCode(programcode) {
    return this.request(`/program/${programcode}`);
  }

  // GET /api/schedules/instructor/:instructor - Get schedules by instructor
  async getSchedulesByInstructor(instructor) {
    return this.request(`/instructor/${encodeURIComponent(instructor)}`);
  }

  // GET /api/schedules/instructor/:instructor/load - Get instructor load
  async getInstructorLoad(instructor) {
    return this.request(`/instructor/${encodeURIComponent(instructor)}/load`);
  }

  // GET /api/schedules/instructor/:facultyId/load - Get instructor load by facultyId with SY/Sem
  async getInstructorLoadById(facultyId, { schoolyear, semester } = {}) {
    const qs = new URLSearchParams();
    if (schoolyear) qs.set('schoolyear', schoolyear);
    if (semester) qs.set('semester', semester);
    const query = qs.toString();
    const url = `${this.baseURL}${this.schedulesPath}/instructor/${encodeURIComponent(facultyId)}/load${query ? `?${query}` : ''}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }
  async getInstructorStatsById(facultyId, { schoolyear, semester } = {}) {
    const qs = new URLSearchParams();
    if (schoolyear) qs.set('schoolyear', schoolyear);
    if (semester) qs.set('semester', semester);
    const query = qs.toString();
    const url = `${this.baseURL}${this.schedulesPath}/instructor/${encodeURIComponent(facultyId)}/stats${query ? `?${query}` : ''}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // GET /api/schedules/instructor/stats - Bulk instructor stats (count + units)
  async getInstructorStatsBulk({ schoolyear, semester } = {}) {
    const qs = new URLSearchParams();
    if (schoolyear) qs.set('schoolyear', schoolyear);
    if (semester) qs.set('semester', semester);
    const query = qs.toString();
    const url = `${this.baseURL}${this.schedulesPath}/instructor/stats${query ? `?${query}` : ''}`;
    const res = await this._fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // GET /api/schedules/room/:room - Get schedules by room
  async getSchedulesByRoom(room) {
    return this.request(`/room/${encodeURIComponent(room)}`);
  }

  // GET /api/schedules/room/:room/utilization - Get room utilization
  async getRoomUtilization(room) {
    return this.request(`/room/${encodeURIComponent(room)}/utilization`);
  }

  // GET /api/schedules/department/:dept - Get schedules by department
  async getSchedulesByDepartment(dept) {
    return this.request(`/department/${encodeURIComponent(dept)}`);
  }

  // GET /api/schedules/department/:dept/stats - Get department statistics
  async getDepartmentStats(dept) {
    return this.request(`/department/${encodeURIComponent(dept)}/stats`);
  }

  // POST /api/schedules - Create new schedule
  async createSchedule(scheduleData) {
    const payload = { ...(scheduleData || {}) };
    if (payload.facultyId != null) { delete payload.faculty; }
    // Normalize faculty fields similar to update
    if (Object.prototype.hasOwnProperty.call(payload, 'facultyId')) {
      payload.faculty_id = payload.facultyId;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'faculty')) {
      payload.instructor = payload.faculty;
    }
    // Map semester/schoolyear to backend keys if provided
    if (Object.prototype.hasOwnProperty.call(payload, 'schoolyear') || Object.prototype.hasOwnProperty.call(payload, 'schoolYear')) {
      payload.sy = payload.schoolyear ?? payload.schoolYear;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'semester')) {
      payload.sem = payload.semester;
    }
    const isNonNumericString = (v) => typeof v === 'string' && v.trim() !== '' && !/^[-+]?\d+(?:\.\d+)?$/.test(v.trim());
    if (isNonNumericString(payload.faculty_id)) {
      if (!payload.faculty) payload.faculty = payload.faculty_id;
      payload.instructor = payload.faculty;
      delete payload.faculty_id;
      delete payload.facultyId;
    }
    if (isNonNumericString(payload.facultyId)) {
      if (!payload.faculty) payload.faculty = payload.facultyId;
      payload.instructor = payload.faculty;
      delete payload.faculty_id;
      delete payload.facultyId;
    }
    return this.request("/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // POST /api/schedules/bulk - Bulk create schedules
  async bulkCreateSchedules(schedulesData) {
    return this.request("/bulk", {
      method: "POST",
      body: JSON.stringify(schedulesData),
    });
  }

  // PUT /api/schedules/:id - Update schedule
  async updateSchedule(id, scheduleData) {
    const payload = { ...(scheduleData || {}) };
    // If setting by ID, drop name to avoid conflicts
    if (payload.facultyId != null) { delete payload.faculty; }
    // Mirror possible backend keys for null/clear semantics
    if (Object.prototype.hasOwnProperty.call(payload, 'facultyId')) {
      payload.faculty_id = payload.facultyId;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'faculty')) {
      // Some backends use 'instructor' field
      payload.instructor = payload.faculty;
    }
    // Map semester/schoolyear to backend keys if provided
    if (Object.prototype.hasOwnProperty.call(payload, 'schoolyear') || Object.prototype.hasOwnProperty.call(payload, 'schoolYear')) {
      payload.sy = payload.schoolyear ?? payload.schoolYear;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'semester')) {
      payload.sem = payload.semester;
    }
    // Guard: if facultyId was mistakenly set to a name (non-numeric), treat it as faculty name
    const isNonNumericString = (v) => typeof v === 'string' && v.trim() !== '' && !/^[-+]?\d+(?:\.\d+)?$/.test(v.trim());
    if (isNonNumericString(payload.faculty_id)) {
      // Move to name field and clear ID fields
      if (!payload.faculty) payload.faculty = payload.faculty_id;
      payload.instructor = payload.faculty;
      delete payload.faculty_id;
      delete payload.facultyId;
    }
    if (isNonNumericString(payload.facultyId)) {
      if (!payload.faculty) payload.faculty = payload.facultyId;
      payload.instructor = payload.faculty;
      delete payload.faculty_id;
      delete payload.facultyId;
    }
    return this.request(`/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  async swapSchedules(id, targetId) {
    const url = `${this.baseURL}${this.schedulesPath}/${encodeURIComponent(id)}/swap`;
    const res = await this._fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify({ targetId }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // DELETE /api/schedules/:id - Delete schedule
  async deleteSchedule(id) {
    return this.request(`/${id}`, {
      method: "DELETE",
    });
  }

  // Helper methods for common frontend operations
  async getFacultySchedules(instructor) {
    return this.getSchedulesByInstructor(instructor);
  }

  async getRoomSchedules(room) {
    return this.getSchedulesByRoom(room);
  }

  async getDepartmentSchedules(dept) {
    return this.getSchedulesByDepartment(dept);
  }

  async getProgramSchedules(programcode) {
    return this.getSchedulesByProgramCode(programcode);
  }

  // Faculty endpoints
  async getFaculties(params = {}) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => { if (v != null && v !== '') search.set(k, v); });
    const qs = search.toString();
    const url = `${this.baseURL}/faculty${qs ? `/?${qs}` : '/'}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async getFaculty(id) {
    const url = `${this.baseURL}/faculty/${encodeURIComponent(id)}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // STUDENTS API
  async verifyStudent(studentid, birthDateDMY) {
    // Convert DD/MM/YYYY to YYYY-MM-DD
    const s = String(birthDateDMY || '').trim();
    let iso = s;
    const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2,'0'); const mm = m[2].padStart(2,'0'); const yyyy = m[3];
      iso = `${yyyy}-${mm}-${dd}`;
    }
    const body = JSON.stringify({ studentid, birth_date: iso });
    const url = `${this.baseURL}/students/verify`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (res.status === 404) return { exists: false };
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // EVALUATIONS API
  async checkEvaluationExists(accessCode, studentName) {
    const search = new URLSearchParams();
    if (accessCode) search.set('accessCode', String(accessCode).trim());
    if (studentName) search.set('studentName', String(studentName).trim());
    const qs = search.toString();
    const url = `${this.baseURL}/evaluations/exists${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async createFaculty(payload) {
    const url = `${this.baseURL}/faculty/`;
    const body = JSON.stringify(this.#normalizeFacultyPayload(payload));
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async updateFaculty(id, payload) {
    const url = `${this.baseURL}/faculty/${encodeURIComponent(id)}`;
    const body = JSON.stringify(this.#normalizeFacultyPayload(payload));
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async deleteFaculty(id) {
    const url = `${this.baseURL}/faculty/${encodeURIComponent(id)}`;
    const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // Normalize frontend -> backend keys for faculty
  #normalizeFacultyPayload(obj = {}) {
    const p = { ...obj };
    // Map display keys to backend keys
    if (p.name != null && p.faculty == null) p.faculty = p.name;
    if (p.department != null && p.dept == null) p.dept = p.department;
    if (p.loadReleaseUnits != null && p.load_release_units == null) p.load_release_units = p.loadReleaseUnits;
    if (p.load_release_units != null && p.loadReleaseUnits == null) p.loadReleaseUnits = p.load_release_units;
    return p;
  }

  // Advanced filtering and search
  async searchSchedules(searchParams = {}) {
    return this.getAllSchedules(searchParams);
  }

  // Get all unique values for filter dropdowns
  async getFilterOptions() {
    try {
      const [stats, programs, departments] = await Promise.all([
        this.getScheduleStats(),
        this.getSchedulesGroupedByProgram(),
        this.getSchedulesGroupedByDepartment(),
      ]);

      return {
        stats,
        programs: programs || [],
        departments: departments || [],
      };
    } catch (error) {
      console.error("Failed to fetch filter options:", error);
      return { stats: {}, programs: [], departments: [] };
    }
  }

  // GET /api/acadcalendar - Get academic calendar data
  async getAcademicCalendar(params = {}) {
    const search = new URLSearchParams();
    if (params.school_year) search.set("school_year", params.school_year);
    const qs = search.toString();
    const fullEndpoint = `/acadcalendar${qs ? `?${qs}` : ""}`;
    const url = `${this.baseURL}${fullEndpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed: ${fullEndpoint}`, error);
      throw error;
    }
  }

  // GET /api/holidays - Get holidays data
  async getHolidays(year) {
    const y = year || new Date().getFullYear();
    const fullEndpoint = `/holidays?year=${encodeURIComponent(y)}`;
    const url = `${this.baseURL}${fullEndpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
      },
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      const data = json?.data || json;
      // Normalize to array of { date, name, type }
      const key = `philippines_holidays_${y}`;
      const arr = Array.isArray(data?.[key]) ? data[key] : Array.isArray(data) ? data : [];
      return arr;
    } catch (error) {
      console.error(`API request failed: ${fullEndpoint}`, error);
      throw error;
    }
  }

  // ADMIN: Upsert academic calendar
  async saveAcademicCalendar({ school_year, content }) {
    const url = `${this.baseURL}/acadcalendar`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify({ school_year, content }) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // ADMIN: Replace holidays for a year
  async replaceHolidays(year, items) {
    const url = `${this.baseURL}/holidays/${encodeURIComponent(year)}`;
    const body = Array.isArray(items) ? items : (items?.items || []);
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // ADMIN: Add single holiday
  async addHoliday(item) {
    const url = `${this.baseURL}/holidays`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // ADMIN: Delete all holidays for a year
  async deleteHolidayYear(year) {
    const url = `${this.baseURL}/holidays/${encodeURIComponent(year)}`;
    const res = await fetch(url, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // SETTINGS: Current SY/Sem for schedules view & loading
  async getSettings() {
    const url = `${this.baseURL}/settings/`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  async updateSettings(patch) {
    const url = `${this.baseURL}/settings/`;
    const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) }, body: JSON.stringify(patch || {}) });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // AUTH API
  async login(identifier, password) {
    return this.requestAbs(`${this.authPath}/login`, {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });
  }
  async refreshToken(refreshToken) {
    return this.requestAbs(`${this.authPath}/refresh`, {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  }
  async register(payload) {
    return this.requestAbs(`${this.authPath}/register`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  async forgotPassword(email) {
    return this.requestAbs(`${this.authPath}/forgot-password`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }
  async resetPassword(resetToken, newPassword) {
    return this.requestAbs(`${this.authPath}/reset-password`, {
      method: "POST",
      body: JSON.stringify({ resetToken, newPassword }),
    });
  }
  async verifyEmail(token) {
    return this.requestAbs(`${this.authPath}/verify-email`, {
      method: "POST",
      body: JSON.stringify({ token }),
    });
  }
  async resendVerification(email) {
    return this.requestAbs(`${this.authPath}/resend-verification`, {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }
  async changePassword(old_password, new_password) {
    return this.requestAbs(`${this.authPath}/change-password`, {
      method: "POST",
      body: JSON.stringify({ old_password, new_password }),
    });
  }
  async checkRole() {
    return this.requestAbs(`${this.authPath}/check-role`, { method: "GET" });
  }

  // USERS API (basic)
  async listUsers(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.requestAbs(`${this.usersPath}${qs ? `?${qs}` : ""}`, {
      method: "GET",
    });
  }
  async getUser(id) {
    return this.requestAbs(`${this.usersPath}/${id}`, { method: "GET" });
  }
  async createUser(payload) {
    return this.requestAbs(`${this.usersPath}/`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }
  async updateUser(id, payload) {
    return this.requestAbs(`${this.usersPath}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }
  async deleteUser(id) {
    return this.requestAbs(`${this.usersPath}/${id}`, { method: "DELETE" });
  }

  // GUEST API
  async postGuestAccess({ name, role, route }) {
    const path = `/guests/access`;
    return this.requestAbs(path, { method: 'POST', body: JSON.stringify({ name, role, route }) });
  }
  async getGuestSelf() {
    const path = `/guests/me`;
    const url = `${this.baseURL}${path}`;
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}) } });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }
  async listGuests(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.requestAbs(`/guests${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }
  async getGuestStats() {
    return this.requestAbs('/guests/stats', { method: 'GET' });
  }
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
