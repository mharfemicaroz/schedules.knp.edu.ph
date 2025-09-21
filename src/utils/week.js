export const DAY_CODES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const WEEKDAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function startOfWeekMonday(date = new Date()) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
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
  const monday = startOfWeekMonday(new Date());
  // Map codes to offsets: Mon=0, Tue=1, ..., Fri=4
  return DAY_CODES.map((code, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    return { code, date: d, label: formatDayLabel(d) };
  });
}

