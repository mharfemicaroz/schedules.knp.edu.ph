// Helpers for course-based scheduling rules
export function isPEorNSTP(course) {
  const text = [
    course?.courseTitle,
    course?.course_title,
    course?.title,
    course?.courseName,
    course?.course_name,
    course?.code,
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toUpperCase();
  if (!text) return false;
  if (text.includes('PHYSICAL EDUCATION')) return true;
  if (/\bPE\b/.test(text)) return true;
  if (text.includes('NSTP')) return true;
  return false;
}

export function normalizeSessionKey(value) {
  const txt = String(value || '').trim().toLowerCase();
  if (!txt) return '';
  if (/evening|night|eve/.test(txt)) return 'evening';
  if (/afternoon|pm\b|p\.m/.test(txt)) return 'afternoon';
  if (/morning|am\b|a\.m/.test(txt)) return 'morning';
  if (txt === 'am') return 'morning';
  if (txt === 'pm') return 'afternoon';
  return '';
}

import { parseF2FDays } from './conflicts';

export function allowedSessionsForCourse(course, blockSessionKey, day) {
  const base = normalizeSessionKey(blockSessionKey);
  const parsedDays = (() => {
    if (Array.isArray(day)) return parseF2FDays(day);
    const days = parseF2FDays(day);
    return days.length ? days : [];
  })();
  const hasWeekend = parsedDays.some((d) => d === 'Sat' || d === 'Sun');
  if (!isPEorNSTP(course)) {
    return base ? [base] : ['morning', 'afternoon', 'evening'];
  }
  if (hasWeekend) return ['morning', 'afternoon'];
  if (base === 'morning') return ['afternoon'];
  if (base === 'afternoon') return ['morning'];
  if (base === 'evening') return ['morning', 'afternoon'];
  // Fallback for unknown session: allow day sessions only
  return ['morning', 'afternoon'];
}
