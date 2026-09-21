// Teman belajar (sapi): suasana hati dan kapan mengingatkan. Murni, tanpa React dan tanpa jaringan.
import { PHASE_LABEL, type Phase } from "./timer-core.ts";

export type Mood = "senang" | "semangat" | "fokus" | "istirahat" | "tidur" | "ingat";

export type CompanionSettings = {
  bubble: boolean; // gelembung pengingat di layar
  notify: boolean; // notifikasi browser (butuh izin)
  idleMinutes: number; // ingatkan kalau lama tidak belajar; 0 = mati
};

export const COMPANION_DEFAULTS: CompanionSettings = {
  bubble: true,
  notify: false,
  idleMinutes: 60,
};
export const IDLE_CHOICES = [0, 30, 60, 90] as const;
export const DEFAULT_COW_NAME = "Moo";

export function sanitizeCompanion(input: unknown): CompanionSettings {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const idle = Number(o["idleMinutes"]);
  return {
    bubble: typeof o["bubble"] === "boolean" ? o["bubble"] : COMPANION_DEFAULTS.bubble,
    notify: typeof o["notify"] === "boolean" ? o["notify"] : COMPANION_DEFAULTS.notify,
    idleMinutes: (IDLE_CHOICES as readonly number[]).includes(idle)
      ? idle
      : COMPANION_DEFAULTS.idleMinutes,
  };
}

export const cleanCowName = (value: unknown) => {
  const v = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 20) : "";
  return v || DEFAULT_COW_NAME;
};

export function moodOf(i: {
  running: boolean;
  phase: Phase;
  active: boolean;
  celebrating: boolean;
  nudging: boolean;
  hour: number;
}): Mood {
  if (i.celebrating) return "semangat";
  if (i.running && i.phase === "focus") return "fokus";
  if (i.active && i.phase !== "focus") return "istirahat";
  if (i.nudging) return "ingat";
  if (!i.active && (i.hour >= 22 || i.hour < 5)) return "tidur";
  return "senang";
}

export const MOOD_TEXT: Record<Mood, string> = {
  senang: "Lagi santai, siap nemenin belajar.",
  semangat: "Hore! Kamu hebat!",
  fokus: "Lagi fokus. Jangan diganggu ya.",
  istirahat: "Waktunya istirahat sambil ngunyah rumput.",
  tidur: "Zzz… sudah larut, jangan lupa tidur.",
  ingat: "Ada yang mau kuingatkan.",
};

// Ingatkan belajar kalau timer tidak jalan dan sudah lama tidak ada aktivitas belajar. Hanya di jam wajar dan tidak terlalu sering.
export function shouldIdleNudge(i: {
  now: number;
  settings: CompanionSettings;
  timerActive: boolean;
  lastActivityAt: number;
  lastNudgeAt: number;
  snoozedUntil: number;
  hour: number;
}): boolean {
  const s = i.settings;
  if (s.idleMinutes === 0 || (!s.bubble && !s.notify)) return false;
  if (i.timerActive) return false;
  if (i.hour < 8 || i.hour >= 21) return false;
  if (i.now < i.snoozedUntil) return false;
  const window = s.idleMinutes * 60000;
  return i.now - i.lastNudgeAt >= window && i.now - i.lastActivityAt >= window;
}

type Block = { id: string; title: string; activity_type: string; starts_at: string };

// Blok belajar yang dimulai sekarang (sekitar satu menit sebelum sampai sedikit sesudahnya), yang belum pernah diingatkan.
export function startingBlocks<T extends Block>(
  list: T[],
  now: number,
  notified: ReadonlySet<string>,
): T[] {
  return list.filter((s) => {
    if (s.activity_type !== "belajar" || notified.has(s.id)) return false;
    const t = new Date(s.starts_at).getTime();
    return t - now <= 45_000 && now - t <= 60_000;
  });
}

type Task = { id: string; title: string; ends_at: string; done: boolean };

// Tugas yang deadline-nya tinggal kurang dari 3 jam dan belum selesai, belum pernah diingatkan.
export function dueSoon<T extends Task>(
  list: T[],
  now: number,
  notified: ReadonlySet<string>,
): T[] {
  return list.filter((t) => {
    if (t.done || notified.has(t.id)) return false;
    const left = new Date(t.ends_at).getTime() - now;
    return left > 0 && left <= 3 * 3600_000;
  });
}

export const say = {
  idle: (name: string, focusMin: number) =>
    `${name}: Sudah lumayan lama nih. Yuk fokus ${focusMin} menit?`,
  paused: (name: string, clock: string) =>
    `Timer-mu masih dijeda di ${clock}. ${name} nungguin, lanjut yuk?`,
  block: (name: string, title: string) => `Waktunya belajar: ${title}. ${name} temenin ya!`,
  due: (name: string, title: string, minutes: number) =>
    `${title} tinggal ${minutes >= 60 ? `${Math.round(minutes / 60)} jam` : `${minutes} menit`} lagi. ${name} bantu semangatin!`,
  focusDone: (breakMin: number, long: boolean) =>
    `Mantap, sesi selesai! ${long ? "Istirahat panjang" : "Istirahat"} ${breakMin} menit dulu ya.`,
  breakDone: (name: string) => `Istirahat selesai. Ayo lanjut fokus, ${name} di sini.`,
  phaseLabel: (p: Phase) => PHASE_LABEL[p],
};
