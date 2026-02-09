import { createAsyncThunk } from "@reduxjs/toolkit";
import apiService from "../services/apiService";
import { normalizeTimeBlock } from "../utils/timeNormalize";
import { setSettings } from "./settingsSlice";

const normalizeSy = (v) => String(v || "").trim().toLowerCase();
const normalizeSem = (v) => {
  const s = String(v || "").trim().toLowerCase();
  if (!s) return "";
  if (/summer|mid\s*year|midyear/.test(s)) return "summer";
  if (s.startsWith("1")) return "1st";
  if (s.startsWith("2")) return "2nd";
  if (s.startsWith("3")) return "3rd";
  return s;
};

function transformSchedulesToFacultyDataset(schedules) {
  if (!Array.isArray(schedules)) return { faculties: [], meta: {} };
  const facultyMap = new Map();
  const toDayCodes = (src) => {
    const s = String(src || "")
      .trim()
      .toUpperCase();
    if (!s) return [];
    const map = {
      MON: "Mon",
      TUE: "Tue",
      WED: "Wed",
      THU: "Thu",
      FRI: "Fri",
      SAT: "Sat",
      SUN: "Sun",
    };
    const expandRange = (a, b) => {
      const order = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
      const ai = order.indexOf(a),
        bi = order.indexOf(b);
      if (ai === -1 || bi === -1) return [];
      const out = [];
      for (let i = ai; i <= bi; i++) out.push(map[order[i]]);
      return out;
    };
    if (s.includes("-") && !s.includes("/")) {
      const [a, b] = s.split("-").map((t) => t.trim());
      return expandRange(a, b);
    }
    const parts = s.split(/[\/\s,]+/).filter(Boolean);
    const out = new Set();
    for (const p of parts) {
      if (p.includes("-")) {
        const [a, b] = p.split("-").map((t) => t.trim());
        expandRange(a, b).forEach((x) => out.add(x));
      } else if (map[p]) out.add(map[p]);
    }
    return Array.from(out);
  };
  // removed local parser; use normalizeTimeBlock
  const termOrder = (t) => {
    const v = String(t || "").toLowerCase();
    if (v.startsWith("1")) return 1;
    if (v.startsWith("2")) return 2;
    if (v.startsWith("3")) return 3;
    if (v.startsWith("s")) return 4;
    return 9;
  };

  schedules.forEach((schedule) => {
    const facProfile = schedule.facultyProfile || {};
    const instructor = schedule.faculty || facProfile.faculty || "Unknown";
    if (!facultyMap.has(instructor)) {
      facultyMap.set(instructor, {
        id: instructor,
        name: instructor,
        email: "",
        department: schedule.dept || facProfile.dept || "Unknown",
        designation: schedule.designation || facProfile.designation || "",
        employment: schedule.employment || facProfile.employment || "",
        courses: [],
        stats: { loadHours: 0, courseCount: 0, overloadHours: 0 },
        loadReleaseUnits:
          (schedule.loadReleaseUnits ??
            schedule.load_release_units ??
            facProfile.load_release_units) ||
          0,
      });
    }
    const facultyData = facultyMap.get(instructor);
    // Backfill profile fields if missing from earlier rows
    if (
      !facultyData.designation &&
      (schedule.designation || facProfile.designation)
    )
      facultyData.designation = schedule.designation || facProfile.designation;
    if (
      !facultyData.employment &&
      (schedule.employment || facProfile.employment)
    )
      facultyData.employment = schedule.employment || facProfile.employment;
    if (
      !facultyData.loadReleaseUnits &&
      (schedule.load_release_units != null ||
        schedule.loadReleaseUnits != null ||
        facProfile.load_release_units != null)
    ) {
      facultyData.loadReleaseUnits =
        schedule.loadReleaseUnits ??
        schedule.load_release_units ??
        facProfile.load_release_units ??
        facultyData.loadReleaseUnits;
    }
    const tn = normalizeTimeBlock(schedule.time);
    const p = schedule.prospectus || {};
    const course = {
      id: schedule.id,
      facultyId: schedule.facultyId || schedule.faculty_id || null,
      accessCode: schedule.accessCode || schedule.accesscode || '',
      courseName: p.courseName || schedule.courseName,
      courseTitle: p.courseTitle || schedule.courseTitle,
      courseType: p.courseType || p.coursetype || null,
      unit: (p.unit != null ? p.unit : schedule.unit),
      day: schedule.day,
      time: schedule.time,
      term: schedule.term,
      // New fields from backend
      schoolyear: schedule.sy || schedule.schoolYear || schedule.school_year || '',
      semester: (p.semester || schedule.sem || schedule.term || ''),
      block: schedule.block,
      yearlevel: p.yearlevel || schedule.yearlevel,
      instructor: schedule.instructor,
      faculty: schedule.faculty || facProfile.faculty,
      blockCode: schedule.blockCode,
      dept: p.dept || schedule.dept,
      room: schedule.room,
      session: schedule.session,
      // grades
      gradesSubmitted: schedule.gradesSubmitted ?? schedule.grades_submitted ?? null,
      gradesStatus: schedule.gradesStatus ?? schedule.grades_status ?? null,
      programcode: schedule.programcode,
      semester: (p.semester || schedule.sem || schedule.term),
      program: schedule.programcode,
      code: p.courseName || schedule.courseName,
      title: p.courseTitle || schedule.courseTitle,
      section: schedule.blockCode,
      f2fSched: schedule.f2fSched,
      schedule: String(schedule.time || "").trim(),
      f2fDays: Array.from(
        new Set([
          ...(toDayCodes(schedule.f2fsched) || []),
          ...(toDayCodes(schedule.f2fSched) || []),
        ])
      ),
      timeStartMinutes: tn?.start ?? Infinity,
      timeEndMinutes: tn?.end ?? Infinity,
      scheduleKey: tn?.key || "",
      roomKey: String(schedule.room || "N/A")
        .trim()
        .replace(/\s+/g, " ")
        .toUpperCase(),
      termOrder: termOrder(schedule.term),
      examDay: schedule.examDay,
      examSession: schedule.examSession,
      examRoom: schedule.examRoom,
      // access control / audit
      lock: schedule.lock ?? schedule.is_locked ?? schedule.locked ?? null,
      user_id_created: schedule.user_id_created ?? schedule.created_by ?? null,
      user_id_lastmodified:
        schedule.user_id_lastmodified ?? schedule.last_modified_by ?? null,
    };
    facultyData.courses.push(course);
    facultyData.stats.loadHours += (course.unit || 0);
    facultyData.stats.courseCount += 1;
  });
  facultyMap.forEach((faculty) => {
    const release = faculty.loadReleaseUnits || 0;
    const baseline = Math.max(0, 24 - release);
    faculty.stats.overloadHours = Math.max(
      0,
      faculty.stats.loadHours - baseline
    );
  });
  return {
    faculties: Array.from(facultyMap.values()),
    meta: {
      totalSchedules: schedules.length,
      lastUpdated: new Date().toISOString(),
    },
  };
}

export const loadAllSchedules = createAsyncThunk("data/loadAll", async (opts = {}, { getState, dispatch }) => {
  // View mode must respect System Settings: Schedules View Defaults (schedulesView)
  let sy, sem;
  const overrideSy = opts?.school_year || opts?.schoolyear || opts?.sy;
  const overrideSem = opts?.semester || opts?.sem;
  if (overrideSy || overrideSem) {
    sy = overrideSy || undefined;
    sem = overrideSem || undefined;
  } else {
    try {
      const st = getState()?.settings?.data?.schedulesView || {};
      sy = st.school_year || undefined;
      sem = st.semester || undefined;
      if (!sy || !sem) {
        // Fallback: fetch settings directly if store not yet populated
        const s = await apiService.getSettings();
        sy = s?.schedulesView?.school_year || sy;
        sem = s?.schedulesView?.semester || sem;
        // Persist fetched settings so shared/public views can reuse the values
        if (s) {
          try { dispatch(setSettings(s)); } catch {}
        }
      }
    } catch {}
  }
  const params = {};
  if (sy) { params.sy = sy; params.schoolyear = sy; }
  if (sem) { params.sem = sem; params.semester = sem; }
  const schedulesResponse = await apiService.getAllSchedules(params);
  const schedules = schedulesResponse.data || schedulesResponse;
  const list = Array.isArray(schedules) ? schedules : [];
  const hasFilters = !!(sy || sem);
  const filtered = hasFilters
    ? list.filter((s) => {
        if (sy && normalizeSy(s.sy || s.schoolyear || s.schoolYear || s.school_year) !== normalizeSy(sy)) return false;
        if (sem && normalizeSem(s.sem || s.semester || s.term) !== normalizeSem(sem)) return false;
        return true;
      })
    : list;
  return {
    raw: hasFilters ? filtered : schedules,
    data: transformSchedulesToFacultyDataset(filtered),
  };
});

export const applyApiFiltersThunk = createAsyncThunk(
  "data/applyFilters",
  async (filters) => {
    const filteredSchedules = await apiService.getSchedulesWithFilters(filters);
    const schedules = filteredSchedules.data || filteredSchedules;
    return { data: transformSchedulesToFacultyDataset(schedules), filters };
  }
);

export const loadAcademicCalendar = createAsyncThunk(
  "data/loadAcad",
  async (params = {}) => {
    const response = await apiService.getAcademicCalendar(params || {});
    return response.data || response;
  }
);

export const loadHolidaysThunk = createAsyncThunk(
  "data/loadHolidays",
  async (year = 2025) => {
    const list = await apiService.getHolidays(year);
    return Array.isArray(list) ? list : [];
  }
);

export const updateScheduleThunk = createAsyncThunk(
  "data/updateSchedule",
  async ({ id, changes }, { getState }) => {
    const state = getState && getState();
    const uid = state?.auth?.user?.id;
    const payload = { ...(changes || {}) };
    if (uid != null && payload.user_id_lastmodified == null) {
      payload.user_id_lastmodified = uid;
    }
    const res = await apiService.updateSchedule(id, payload);
    return { id, changes, data: res?.data || res };
  }
);

export const deleteScheduleThunk = createAsyncThunk(
  "data/deleteSchedule",
  async (id) => {
    await apiService.deleteSchedule(id);
    return { id };
  }
);
