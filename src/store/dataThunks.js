import { createAsyncThunk } from "@reduxjs/toolkit";
import apiService from "../services/apiService";

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
  const parseTimeRange = (timeStr) => {
    const s = String(timeStr || "")
      .replace(/\s+/g, "")
      .toUpperCase();
    const m = s.match(
      /^(\d{1,2})(?::(\d{2}))?(AM|PM)?-(\d{1,2})(?::(\d{2}))?(AM|PM)?$/i
    );
    if (!m) return { start: Infinity, end: Infinity, key: "NA" };
    let sh = parseInt(m[1] || "0", 10),
      sm = parseInt(m[2] || "0", 10);
    let sMer = (m[3] || "").toUpperCase();
    let eh = parseInt(m[4] || "0", 10),
      em = parseInt(m[5] || "0", 10);
    let eMer = (m[6] || "").toUpperCase();
    if (!sMer && eMer) sMer = eMer;
    if (!eMer && sMer) eMer = sMer;
    const toMinutes = (h, m, mer) => {
      let hh = h;
      if (mer === "AM") {
        if (hh === 12) hh = 0;
      } else if (mer === "PM") {
        if (hh !== 12) hh += 12;
      }
      return hh * 60 + m;
    };
    const start = toMinutes(sh, sm, sMer || "AM");
    const end = toMinutes(eh, em, eMer || "AM");
    const pad = (n) => String(n).padStart(2, "0");
    const key = `${pad(Math.floor(start / 60))}:${pad(start % 60)}-${pad(
      Math.floor(end / 60)
    )}:${pad(end % 60)}`;
    return { start, end, key };
  };
  const termOrder = (t) => {
    const v = String(t || "").toLowerCase();
    if (v.startsWith("1")) return 1;
    if (v.startsWith("2")) return 2;
    if (v.startsWith("3")) return 3;
    if (v.startsWith("s")) return 4;
    return 9;
  };

  schedules.forEach((schedule) => {
    const instructor = schedule.faculty || "Unknown";
    if (!facultyMap.has(instructor)) {
      facultyMap.set(instructor, {
        id: instructor,
        name: instructor,
        email: `${instructor.toLowerCase().replace(/\s+/g, ".")}@knp.edu.ph`,
        department: schedule.dept || "Unknown",
        courses: [],
        stats: { loadHours: 0, courseCount: 0, overloadHours: 0 },
        loadReleaseUnits: schedule.loadReleaseUnits || 0,
      });
    }
    const facultyData = facultyMap.get(instructor);
    const t = parseTimeRange(schedule.time);
    const course = {
      id: schedule.id,
      courseName: schedule.courseName,
      courseTitle: schedule.courseTitle,
      unit: schedule.unit,
      day: schedule.day,
      time: schedule.time,
      term: schedule.term,
      block: schedule.block,
      yearlevel: schedule.yearlevel,
      instructor: schedule.instructor,
      faculty: schedule.faculty,
      blockCode: schedule.blockCode,
      dept: schedule.dept,
      room: schedule.room,
      session: schedule.session,
      programcode: schedule.programcode,
      semester: schedule.term,
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
      timeStartMinutes: t.start,
      timeEndMinutes: t.end,
      scheduleKey: t.key,
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
