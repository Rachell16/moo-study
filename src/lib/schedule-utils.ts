import type { Database } from "@/integrations/supabase/types";

export type Schedule = Database["public"]["Tables"]["schedules"]["Row"];
export type Course = Database["public"]["Tables"]["courses"]["Row"];
export type Material = Database["public"]["Tables"]["materials"]["Row"];

export const ACTIVITY_TYPES = [
  { value: "kuliah", label: "Kuliah" },
  { value: "praktikum", label: "Praktikum" },
  { value: "belajar", label: "Belajar mandiri" },
  { value: "tugas", label: "Tugas (deadline)" },
  { value: "ujian", label: "Ujian" },
] as const;

export const EXAM_KINDS = [
  { value: "uts", label: "UTS" },
  { value: "uas", label: "UAS" },
] as const;

export const COURSE_COLORS = [
  { value: "sage", label: "Hijau" },
  { value: "pink", label: "Merah muda" },
  { value: "red", label: "Merah" },
  { value: "mustard", label: "Kuning" },
] as const;

const TONE_BY_ACTIVITY: Record<string, string> = {
  kuliah: "sage",
  praktikum: "red",
  belajar: "pink",
  tugas: "mustard",
};

// Warna kartu: ikut warna mata kuliah, kalau tidak ada ikut jenis kegiatan.
export function toneFor(s: Schedule, courses: Course[]): string {
  if (s.activity_type === "tugas" || s.activity_type === "ujian")
    return TONE_BY_ACTIVITY[s.activity_type]!;
  const c = courses.find((x) => x.id === s.course_id);
  if (c && COURSE_COLORS.some((k) => k.value === c.color)) return c.color;
  return TONE_BY_ACTIVITY[s.activity_type] ?? "sage";
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7)); // Senin
export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fmtTime = (d: Date) => `${pad(d.getHours())}.${pad(d.getMinutes())}`;
export const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function fmtRange(from: Date, toInclusive: Date) {
  const sameMonth =
    from.getMonth() === toInclusive.getMonth() && from.getFullYear() === toInclusive.getFullYear();
  const month = (d: Date) => d.toLocaleDateString("id-ID", { month: "long" });
  return sameMonth
    ? `${from.getDate()}–${toInclusive.getDate()} ${month(toInclusive)} ${toInclusive.getFullYear()}`
    : `${from.getDate()} ${month(from)} – ${toInclusive.getDate()} ${month(toInclusive)} ${toInclusive.getFullYear()}`;
}

export function fmtDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} menit`;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
}

const DAY_MS = 864e5;

// Selisih hari kalender (bukan selisih 24 jam): besok = 1, hari ini = 0, kemarin = -1.
export const daysUntil = (target: Date, now = new Date()) =>
  Math.round((startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY_MS);

export function fmtDayDate(d: Date) {
  return d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// "3 hari lagi", "hari ini, 5 jam lagi", "terlambat 2 jam"
export function countdownLabel(
  target: Date,
  now = new Date(),
): { text: string; late: boolean; soon: boolean } {
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
  if (diffMin < 0) {
    const ago = -diffMin;
    const text =
      ago < 60
        ? `terlambat ${ago} menit`
        : ago < 1440
          ? `terlambat ${Math.floor(ago / 60)} jam`
          : `terlambat ${Math.floor(ago / 1440)} hari`;
    return { text, late: true, soon: false };
  }
  const days = daysUntil(target, now);
  if (days === 0)
    return {
      text:
        diffMin < 60 ? `${diffMin} menit lagi` : `hari ini, ${Math.floor(diffMin / 60)} jam lagi`,
      late: false,
      soon: true,
    };
  if (days === 1) return { text: "besok", late: false, soon: true };
  return { text: `${days} hari lagi`, late: false, soon: days <= 3 };
}
