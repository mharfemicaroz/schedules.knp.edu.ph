export const DAY_CODES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function startOfWeekMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diffToMonday = (day + 6) % 7; // 0 if Monday
  d.setDate(d.getDate() - diffToMonday);
  return d;
}

export function formatDayLabel(date) {
  const weekday = WEEKDAY_NAMES[date.getDay()];
  const month = MONTH_ABBR[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year} (${weekday})`;
}

export function getCurrentWeekDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If today is Sunday, show next week's Monday to Friday
  // Otherwise, show current week's Monday to Friday
  let monday;
  if (today.getDay() === 0) {
    // Sunday
    // Get next Monday (7 days from current Monday)
    monday = startOfWeekMonday(today);
    monday.setDate(monday.getDate() + 7);
  } else {
    // Get current week's Monday
    monday = startOfWeekMonday(today);
  }

  // Map codes to offsets: Mon=0, Tue=1, ..., Fri=4
  return DAY_CODES.map((code, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    // Normalize to UTC to avoid timezone issues
    const normalized = new Date(
      Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    );
    return { code, date: normalized, label: formatDayLabel(normalized) };
  });
}
