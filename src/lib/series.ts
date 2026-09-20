// Perubahan untuk satu kegiatan atau sekelompok kegiatan berjudul sama (seperti "kegiatan ini / berikutnya / semua" di Google Calendar).
// Tanpa import supaya bisa dites langsung di Node.

export type Scope = "one" | "following" | "all";
type Row = { id: string; starts_at: string };

// Kegiatan lain yang ikut berubah, tidak termasuk kegiatan yang sedang diubah.
export function pickSeries<T extends Row>(rows: T[], current: Row, scope: Scope): T[] {
  if (scope === "one") return [];
  const t = new Date(current.starts_at).getTime();
  return rows.filter(
    (r) => r.id !== current.id && (scope === "all" || new Date(r.starts_at).getTime() > t),
  );
}

// Jam mulai atau lamanya berubah? (tanggalnya tidak dihitung)
export function timeOfDayChanged(
  orig: { starts_at: string; ends_at: string },
  next: { start: Date; end: Date },
): boolean {
  const s = new Date(orig.starts_at);
  const e = new Date(orig.ends_at);
  return (
    s.getHours() !== next.start.getHours() ||
    s.getMinutes() !== next.start.getMinutes() ||
    e.getTime() - s.getTime() !== next.end.getTime() - next.start.getTime()
  );
}

// Pakai jam dan lama yang baru, tapi tetap di tanggal kegiatan itu sendiri.
export function shiftToTimeOfDay(rowStartISO: string, next: { start: Date; end: Date }) {
  const r = new Date(rowStartISO);
  const s = new Date(
    r.getFullYear(),
    r.getMonth(),
    r.getDate(),
    next.start.getHours(),
    next.start.getMinutes(),
  );
  return {
    starts_at: s.toISOString(),
    ends_at: new Date(s.getTime() + (next.end.getTime() - next.start.getTime())).toISOString(),
  };
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
