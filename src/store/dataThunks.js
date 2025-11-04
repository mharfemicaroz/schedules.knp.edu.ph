import { createAsyncThunk } from "@reduxjs/toolkit";
import apiService from "../services/apiService";
import { normalizeTimeBlock } from "../utils/timeNormalize";

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
    const course = {
      id: schedule.id,
      facultyId: schedule.facultyId || schedule.faculty_id || null,
      courseName: schedule.courseName,
      courseTitle: schedule.courseTitle,
      unit: schedule.unit,
      day: schedule.day,
      time: schedule.time,
      term: schedule.term,
      // New fields from backend
      schoolyear: schedule.sy || schedule.schoolYear || schedule.school_year || '',
      semester: schedule.sem || schedule.term || '',
      block: schedule.block,
      yearlevel: schedule.yearlevel,
      instructor: schedule.instructor,
      faculty: schedule.faculty || facProfile.faculty,
      blockCode: schedule.blockCode,
      dept: schedule.dept,
      room: schedule.room,
      session: schedule.session,
      // grades
      gradesSubmitted: schedule.gradesSubmitted ?? schedule.grades_submitted ?? null,
      gradesStatus: schedule.gradesStatus ?? schedule.grades_status ?? null,
      programcode: schedule.programcode,
      semester: schedule.sem || schedule.term,
      program: schedule.programcode,
      code: schedule.courseName,
      title: schedule.courseTitle,
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
    };
    facultyData.courses.push(course);
    facultyData.stats.loadHours += schedule.unit || 0;
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

export const loadAllSchedules = createAsyncThunk("data/loadAll", async () => {
  const schedulesResponse = await apiService.getAllSchedules();
  const schedules = schedulesResponse.data || schedulesResponse;
  return {
    raw: schedules,
    data: transformSchedulesToFacultyDataset(schedules),
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
  async () => {
    const response = await apiService.getAcademicCalendar();
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
  async ({ id, changes }) => {
    const res = await apiService.updateSchedule(id, changes);
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
