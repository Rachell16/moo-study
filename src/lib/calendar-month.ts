// Tampilan kalender bulanan: kisi hari (Senin–Minggu), dan memindah agenda ke hari lain lewat geser (drag).
// Murni, tanpa DOM, supaya bisa dites di Node.
import { addDays, isSameDay, startOfWeek, type Schedule } from "./schedule-utils.ts";

export const MONTH_NAMES = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

// Kursor bulan: selalu tanggal 1, supaya "bulan depan/sebelumnya" tidak meleset gara-gara tanggal (mis. 31 Jan + 1 bulan).
export const monthCursor = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const shiftMonth = (cursor: Date, n: number) =>
  new Date(cursor.getFullYear(), cursor.getMonth() + n, 1);
export const isSameMonth = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

// Kisi penuh dari Senin di minggu tanggal 1 sampai Minggu di minggu tanggal terakhir bulan itu (5 atau 6 baris).
export function monthGridDays(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const days: Date[] = [];
  for (let d = start; d.getTime() <= end.getTime(); d = addDays(d, 1)) days.push(d);
  return days;
}

// Pindah satu agenda ke hari lain, jam dan durasinya tetap sama.
export function moveToDay(schedule: Pick<Schedule, "starts_at" | "ends_at">, newDay: Date) {
  const start = new Date(schedule.starts_at);
  const end = new Date(schedule.ends_at);
  const durationMs = end.getTime() - start.getTime();
  const newStart = new Date(
    newDay.getFullYear(),
    newDay.getMonth(),
    newDay.getDate(),
    start.getHours(),
    start.getMinutes(),
    start.getSeconds(),
  );
  return {
    starts_at: newStart.toISOString(),
    ends_at: new Date(newStart.getTime() + durationMs).toISOString(),
  };
}

// Kelompokkan agenda per hari untuk satu kisi bulan, diurutkan berdasarkan jam mulai.
export function groupByDay<T extends { starts_at: string }>(
  items: T[],
  days: Date[],
): Map<number, T[]> {
  const map = new Map<number, T[]>(days.map((d) => [d.getTime(), []]));
  for (const item of items) {
    const day = days.find((d) => isSameDay(d, new Date(item.starts_at)));
    if (day) map.get(day.getTime())!.push(item);
  }
  for (const list of map.values()) list.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return map;
}
