// Inti timer yang bebas dari React: fase, teks jam, giliran istirahat, dan pemulihan setelah halaman dimuat ulang.

export type Phase = "focus" | "short" | "long";

export const PHASE_LABEL: Record<Phase, string> = {
  focus: "Fokus",
  short: "Istirahat",
  long: "Istirahat panjang",
};

export type TimerLengths = { focus: number; short: number; long: number; cycle: number };

export const minutesOf = (p: Phase, s: TimerLengths) =>
  p === "focus" ? s.focus : p === "short" ? s.short : s.long;

export function clockText(remainingMs: number) {
  const seconds = Math.max(Math.ceil(remainingMs / 1000), 0);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// Setelah satu sesi fokus selesai: istirahat pendek, atau panjang kalau putaran sudah penuh.
export function afterFocus(cycle: number, s: TimerLengths): { next: Phase; cycle: number } {
  const done = cycle + 1;
  return done >= s.cycle ? { next: "long", cycle: 0 } : { next: "short", cycle: done };
}

export type SavedTimer = {
  phase: Phase;
  running: boolean;
  endAt: number; // ms, hanya berarti kalau running
  remaining: number; // ms, dipakai kalau tidak running
  cycle: number;
  courseId: string;
  startedAt: number | null;
};

const PHASES: Phase[] = ["focus", "short", "long"];
const STALE_MS = 30 * 60 * 1000; // timer yang sudah lewat lebih dari ini tidak dianggap selesai (mis. laptop ditutup semalaman)

export function parseSaved(value: unknown): SavedTimer | null {
  if (!value || typeof value !== "object") return null;
  const o = value as Record<string, unknown>;
  if (!PHASES.includes(o["phase"] as Phase)) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const endAt = num(o["endAt"]);
  const remaining = num(o["remaining"]);
  const cycle = num(o["cycle"]);
  if (endAt === null || remaining === null || cycle === null) return null;
  return {
    phase: o["phase"] as Phase,
    running: o["running"] === true,
    endAt,
    remaining,
    cycle: Math.max(Math.floor(cycle), 0),
    courseId: typeof o["courseId"] === "string" ? o["courseId"] : "",
    startedAt: num(o["startedAt"]),
  };
}

export type Restored = {
  phase: Phase;
  running: boolean;
  remaining: number;
  endAt: number;
  cycle: number;
  courseId: string;
  startedAt: number | null;
};

// Pulihkan timer setelah halaman dimuat ulang atau tab dibuka kembali.
export function restore(saved: SavedTimer | null, now: number, s: TimerLengths): Restored | null {
  if (!saved) return null;
  const total = minutesOf(saved.phase, s) * 60000;
  const base = {
    phase: saved.phase,
    cycle: saved.cycle,
    courseId: saved.courseId,
    startedAt: saved.startedAt,
    endAt: saved.endAt,
  };
  if (!saved.running) {
    if (saved.remaining >= total) return null; // tidak ada yang perlu dipulihkan
    return { ...base, running: false, remaining: Math.min(Math.max(saved.remaining, 0), total) };
  }
  const left = saved.endAt - now;
  if (left > 0) return { ...base, running: true, remaining: Math.min(left, total) };
  if (now - saved.endAt <= STALE_MS) return { ...base, running: true, remaining: 0 }; // baru saja habis: selesaikan sekarang
  return {
    phase: "focus",
    running: false,
    remaining: s.focus * 60000,
    endAt: 0,
    cycle: saved.cycle,
    courseId: saved.courseId,
    startedAt: null,
  }; // basi: mulai bersih
}
