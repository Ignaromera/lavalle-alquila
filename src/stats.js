import { isoDay, parseDay } from "./format.js";

export const STAT_KINDS = ["view", "share", "whatsapp"];

export function claimDailyView(storage, subjectType, subjectId, day) {
  const key = `lavalle-stat:${subjectType}:${subjectId}:${day}`;
  if (storage.getItem(key)) return false;
  storage.setItem(key, "1");
  return true;
}

export function recentDays(count = 7, today = new Date()) {
  const days = [];
  for (let ago = count - 1; ago >= 0; ago -= 1) {
    const date = parseDay(isoDay(today));
    date.setDate(date.getDate() - ago);
    days.push(isoDay(date));
  }
  return days;
}

export function weekdayShort(day) {
  return new Intl.DateTimeFormat("es-AR", { weekday: "short" })
    .format(parseDay(day))
    .replace(".", "");
}

export function totalsFor(rows, subjectType, subjectId) {
  const totals = { view: 0, share: 0, whatsapp: 0 };
  for (const row of rows) {
    if (row.subject_type !== subjectType || row.subject_id !== subjectId) continue;
    if (totals[row.kind] != null) totals[row.kind] += Number(row.count) || 0;
  }
  return totals;
}

export function weekSeries(rows, days) {
  return days.map((day) => {
    const bucket = { day, view: 0, share: 0, whatsapp: 0 };
    for (const row of rows) {
      if (row.day !== day || bucket[row.kind] == null) continue;
      bucket[row.kind] += Number(row.count) || 0;
    }
    return bucket;
  });
}
