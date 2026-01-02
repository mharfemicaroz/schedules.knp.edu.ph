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

export function allowedSessionsForCourse(course, blockSessionKey) {
  const base = normalizeSessionKey(blockSessionKey);
  if (!isPEorNSTP(course)) {
    return base ? [base] : ['morning', 'afternoon', 'evening'];
  }
  if (base === 'morning') return ['afternoon'];
  if (base === 'afternoon') return ['morning'];
  if (base === 'evening') return ['morning', 'afternoon'];
  // Fallback for unknown session: allow day sessions only
  return ['morning', 'afternoon'];
}
