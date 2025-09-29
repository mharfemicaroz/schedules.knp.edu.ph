export const TIME_OPTIONS = [
  '',
  'TBA',
  // Hourly blocks
  '7-8AM','8-9AM','9-10AM','10-11AM','11-12NN','12-1PM','1-2PM','2-3PM','3-4PM','4-5PM','5-6PM','6-7PM','7-8PM','8-9PM',
  // Common two-hour blocks
  '8-10AM','10-12NN','1-3PM','3-5PM','5-7PM','7-9PM',
  // Extended blocks
  '8-12NN','1-5PM','5-9PM',
];

export function getTimeOptions() {
  return TIME_OPTIONS;
}

