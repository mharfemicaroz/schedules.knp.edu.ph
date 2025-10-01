// API Service for seamless integration with backend endpoints
import API_CONFIG from "../config/apiConfig";

class ApiService {
  constructor() {
    this.baseURL = API_CONFIG.BASE_URL;
    this.schedulesPath = "/schedules";
    this.authPath = "/auth";
    this.usersPath = "/users";
    this.token = null;
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
    const res = await fetch(url, config);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  setAuthToken(token) {
    this.token = token || null;
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
}

// Create singleton instance
const apiService = new ApiService();

export default apiService;
