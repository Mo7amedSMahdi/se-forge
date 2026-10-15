// Dates and times on the dashboard: days as "09 Oct", times on the 12-hour clock ("2:05 PM"), in this Mac's
// time zone. Written out by hand so every Node version prints the same.
const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const day = (t) => { const d = new Date(t); return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`; };
export const weekday = (t) => `${DAYS[new Date(t).getDay()]} ${day(t)}`;
// An hour of the day, 0 to 24: "12 AM", "8 AM", "12 PM", "3 PM".
export const hour = (h) => `${h % 12 || 12} ${h % 24 < 12 ? 'AM' : 'PM'}`;
export const clock = (t) => { const d = new Date(t); const h = d.getHours(); return `${h % 12 || 12}:${pad(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`; };
export const when = (t) => `${day(t)}, ${clock(t)}`;
