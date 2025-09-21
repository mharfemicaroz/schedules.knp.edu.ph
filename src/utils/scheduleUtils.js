import React from "react";

/**
 * Parse a date string into a Date object
 * @param {string} dateStr - Date string to parse
 * @returns {Date|null} - Parsed date or null if invalid
 */
function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;

  // Handle various date formats
  const formats = [
    // "January 5, 2026"
    /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/,
    // "Jan 5, 2026"
    /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/,
    // "1/5/2026" or "01/05/2026"
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // "2026-01-05"
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      try {
        if (format === formats[0] || format === formats[1]) {
          // Month name format - parse in local timezone but normalize to UTC
          const [, month, day, year] = match;
          const date = new Date(`${month} ${day}, ${year} UTC`);
          // Normalize to start of day in UTC to avoid timezone issues
          const normalized = new Date(
            Date.UTC(
              date.getUTCFullYear(),
              date.getUTCMonth(),
              date.getUTCDate()
            )
          );
          return normalized;
        } else if (format === formats[2]) {
          // MM/DD/YYYY format
          const [, month, day, year] = match;
          return new Date(
            `${year}-${month.padStart(2, "0")}-${day.padStart(
              2,
              "0"
            )}T00:00:00.000Z`
          );
        } else if (format === formats[3]) {
          // YYYY-MM-DD format
          const [, year, month, day] = match;
          return new Date(
            `${year}-${month.padStart(2, "0")}-${day.padStart(
              2,
              "0"
            )}T00:00:00.000Z`
          );
        }
      } catch (error) {
        console.warn(`Failed to parse date: ${dateStr}`, error);
        return null;
      }
    }
  }

  return null;
}

/**
 * Expand a date range string into individual dates
 * @param {string} dateRangeStr - Date range string like "January 5-9, 2026"
 * @returns {Date[]} - Array of Date objects
 */
function expandDateRange(dateRangeStr) {
  if (!dateRangeStr || typeof dateRangeStr !== "string") return [];

  // Handle ranges like "January 5-9, 2026"
  const rangeMatch = dateRangeStr.match(
    /^([A-Za-z]+)\s+(\d{1,2})-(\d{1,2}),\s+(\d{4})$/
  );
  if (rangeMatch) {
    const [, month, startDay, endDay, year] = rangeMatch;
    const start = parseInt(startDay, 10);
    const end = parseInt(endDay, 10);

    if (start <= end) {
      const dates = [];
      for (let day = start; day <= end; day++) {
        try {
          const date = new Date(`${month} ${day}, ${year} UTC`);
          if (!isNaN(date.getTime())) {
            // Normalize to UTC
            const normalized = new Date(
              Date.UTC(
                date.getUTCFullYear(),
                date.getUTCMonth(),
                date.getUTCDate()
              )
            );
            dates.push(normalized);
          }
        } catch (error) {
          console.warn(
            `Failed to create date for ${month} ${day}, ${year}`,
            error
          );
        }
      }
      return dates;
    }
  }

  // If no range found, try to parse as single date
  const singleDate = parseDate(dateRangeStr);
  return singleDate ? [singleDate] : [];
}

/**
 * Check if any date in the given range falls within exam periods
 * @param {Object} acadData - Academic calendar data
 * @param {Date[]} dateRange - Optional array of dates to check (defaults to today)
 * @returns {boolean} - True if any date in range is within exam period
 */
export function isDateInExamPeriod(acadData, dateRange = null) {
  if (!acadData) return false;

  const cal = Array.isArray(acadData)
    ? acadData[0]?.academic_calendar
    : acadData?.academic_calendar;
  if (!cal) return false;

  const first = cal.first_semester || {};
  const firstTerm = first.first_term || {};
  const secondTerm = first.second_term || {};

  // Check all exam periods
  const examPeriods = [
    // First Term exams
    ...(firstTerm.activities || [])
      .filter((a) => /exam/i.test(a.event))
      .map((exam) => ({
        dates: Array.isArray(exam.date) ? exam.date : [exam.date],
        term: "First Term",
      })),
    // Second Term exams
    ...(secondTerm.activities || [])
      .filter((a) => /exam/i.test(a.event))
      .map((exam) => ({
        dates: Array.isArray(exam.date) ? exam.date : [exam.date],
        term: "Second Term",
      })),
  ];

  // Get dates to check
  let datesToCheck = [];
  if (dateRange && Array.isArray(dateRange)) {
    datesToCheck = dateRange;
  } else {
    // Default to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    datesToCheck = [today];
  }

  // Check if any of the dates fall within exam periods
  for (const checkDate of datesToCheck) {
    if (!checkDate || isNaN(checkDate.getTime())) continue;

    const normalizedCheckDate = new Date(checkDate);
    normalizedCheckDate.setHours(0, 0, 0, 0);

    for (const exam of examPeriods) {
      for (const dateStr of exam.dates) {
        let examDates = [];

        if (typeof dateStr === "string" && dateStr.includes("-")) {
          // Handle date ranges like "January 5-9, 2026"
          examDates = expandDateRange(dateStr);
        } else {
          // Handle single dates or arrays
          const parsed = parseDate(dateStr);
          if (Array.isArray(parsed)) {
            examDates = parsed;
          } else if (parsed) {
            examDates = [parsed];
          }
        }

        for (const examDate of examDates) {
          if (examDate && !isNaN(examDate.getTime())) {
            const normalizedExamDate = new Date(examDate);
            normalizedExamDate.setHours(0, 0, 0, 0);

            if (
              normalizedCheckDate.getTime() === normalizedExamDate.getTime()
            ) {
              return true;
            }
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if current date falls within any exam period (backward compatibility)
 * @param {Object} acadData - Academic calendar data
 * @returns {boolean} - True if current date is within exam period
 */
export function isCurrentDateInExamPeriod(acadData) {
  return isDateInExamPeriod(acadData, null);
}

/**
 * Return a Set of normalized (midnight) timestamps for all exam dates.
 * @param {Object} acadData
 * @returns {Set<number>} set of ms timestamps (Date.getTime())
 */
export function getExamDateSet(acadData) {
  const out = new Set();
  if (!acadData) return out;
  const cal = Array.isArray(acadData)
    ? acadData[0]?.academic_calendar
    : acadData?.academic_calendar;
  if (!cal) return out;
  const first = cal.first_semester || {};
  const firstTerm = first.first_term || {};
  const secondTerm = first.second_term || {};
  const buckets = [firstTerm, secondTerm];
  buckets.forEach((term) => {
    (term.activities || [])
      .filter((a) => /exam/i.test(a.event))
      .forEach((exam) => {
        const arr = Array.isArray(exam.date) ? exam.date : [exam.date];
        arr.forEach((dstr) => {
          if (typeof dstr === 'string' && dstr.includes('-')) {
            expandDateRange(dstr).forEach((d) => {
              if (d && !isNaN(d)) {
                const t = new Date(d);
                t.setHours(0,0,0,0);
                out.add(t.getTime());
              }
            });
          } else {
            const d = parseDate(dstr);
            if (d && !isNaN(d)) {
              const t = new Date(d);
              t.setHours(0,0,0,0);
              out.add(t.getTime());
            }
          }
        });
      });
  });
  return out;
}

/**
 * Custom hook for localStorage with toggle state
 * @param {string} key - localStorage key
 * @param {any} defaultValue - Default value if no stored value
 * @returns {[any, function]} - [value, setValue] tuple
 */
export function useLocalStorage(key, defaultValue) {
  const [value, setValue] = React.useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setStoredValue = React.useCallback(
    (newValue) => {
      try {
        setValue(newValue);
        window.localStorage.setItem(key, JSON.stringify(newValue));
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key]
  );

  return [value, setStoredValue];
}

/**
 * Get initial toggle state based on exam period and localStorage
 * @param {Object} acadData - Academic calendar data
 * @param {string} storageKey - localStorage key for the toggle
 * @param {string} defaultMode - Default mode ('regular' or 'examination')
 * @returns {string} - Initial toggle state
 */
export function getInitialToggleState(
  acadData,
  storageKey,
  defaultMode = "regular"
) {
  // First check localStorage
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      // If user manually set to examination mode, respect that choice
      if (parsed === "examination") {
        return "examination";
      }
    }
  } catch (error) {
    console.warn(`Error reading localStorage key "${storageKey}":`, error);
  }

  // If no stored preference or stored as regular, check if current date is in exam period
  if (isCurrentDateInExamPeriod(acadData)) {
    return "examination";
  }

  return defaultMode;
}

function toYMD(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

function parseDateLoose(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

export function findDayAnnotations(acadData, holidays, jsDate) {
  const result = { holiday: null, events: [], mode: 'default' };
  const dateYMD = toYMD(jsDate);
  if (!dateYMD) return result;
  // Holidays
  const list = Array.isArray(holidays) ? holidays : [];
  const holiday = list.find(h => String(h.date) === dateYMD);
  if (holiday) result.holiday = holiday;

  // Events from academic calendar
  const cal = Array.isArray(acadData)
    ? acadData[0]?.academic_calendar
    : acadData?.academic_calendar;
  const first = cal?.first_semester || {};
  const buckets = [first.first_term || {}, first.second_term || {}];
  const evts = [];
  buckets.forEach(b => {
    (b.activities || []).forEach(a => {
      if (a?.date_range) {
        const arr = expandDateRange(a.date_range);
        arr.forEach(d => { if (toYMD(d) === dateYMD) evts.push(a); });
      } else if (Array.isArray(a?.date)) {
        a.date.forEach(d => { const dt = parseDateLoose(d); if (dt && toYMD(dt) === dateYMD) evts.push(a); });
      } else if (a?.date) {
        const d = parseDateLoose(a.date);
        if (d && toYMD(d) === dateYMD) evts.push(a);
      }
    });
  });
  result.events = evts;
  // Derive mode from event props: prefer a.mode; fallback to a.assynchronous (yes->asynchronous); fallback to a.type keywords
  let mode = 'default';
  for (const a of evts) {
    const raw = String(a.mode || a.assynchronous || a.type || '').toLowerCase();
    if (/no\s*class|noclass/.test(raw)) { mode = 'no_class'; break; }
    if (/async|assync|asynchronous/.test(raw)) { mode = 'asynchronous'; }
  }
  result.mode = mode;
  return result;
}
