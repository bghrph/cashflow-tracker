export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad = (n) => String(n).padStart(2, '0');

export const dateString = (year, monthIndex, day) =>
  `${year}-${pad(monthIndex + 1)}-${pad(day)}`;

export function monthRange(year, monthIndex) {
  return {
    start: dateString(year, monthIndex, 1),
    end: dateString(year, monthIndex, new Date(year, monthIndex + 1, 0).getDate()),
  };
}

export function formatShortDate(isoDate) {
  const parts = isoDate.split('-');
  return `${MONTH_SHORT[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
}
