// Pengaturan timer: preset Pomodoro atau angka sendiri. Disimpan di browser (localStorage).

export type TimerSettings = {
  focus: number; // menit fokus
  short: number; // istirahat pendek
  long: number; // istirahat panjang
  cycle: number; // jumlah sesi fokus sebelum istirahat panjang
  goal: number; // target sesi fokus per hari
  auto: boolean; // mulai otomatis sesi berikutnya
  sound: boolean; // bunyi saat selesai
};

export const PRESETS = [
  { id: "pomodoro", label: "Pomodoro 25/5", focus: 25, short: 5, long: 15, cycle: 4 },
  { id: "lima-puluh", label: "50/10", focus: 50, short: 10, long: 20, cycle: 3 },
  { id: "deep", label: "Deep work 90/20", focus: 90, short: 20, long: 30, cycle: 2 },
] as const;

export const DEFAULTS: TimerSettings = {
  focus: 25,
  short: 5,
  long: 15,
  cycle: 4,
  goal: 4,
  auto: false,
  sound: true,
};

export const LIMITS = {
  focus: [1, 240],
  short: [1, 60],
  long: [1, 60],
  cycle: [2, 8],
  goal: [1, 12],
} as const;

const clamp = (n: unknown, [lo, hi]: readonly [number, number], fallback: number) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : fallback;
};

export function sanitize(input: Partial<TimerSettings>): TimerSettings {
  return {
    focus: clamp(input.focus, LIMITS.focus, DEFAULTS.focus),
    short: clamp(input.short, LIMITS.short, DEFAULTS.short),
    long: clamp(input.long, LIMITS.long, DEFAULTS.long),
    cycle: clamp(input.cycle, LIMITS.cycle, DEFAULTS.cycle),
    goal: clamp(input.goal, LIMITS.goal, DEFAULTS.goal),
    auto: typeof input.auto === "boolean" ? input.auto : DEFAULTS.auto,
    sound: typeof input.sound === "boolean" ? input.sound : DEFAULTS.sound,
  };
}

export const presetIdOf = (s: TimerSettings): string =>
  PRESETS.find(
    (p) => p.focus === s.focus && p.short === s.short && p.long === s.long && p.cycle === s.cycle,
  )?.id ?? "kustom";

const KEY = "moo-timer-settings";

export function loadSettings(): TimerSettings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return sanitize(raw ? (JSON.parse(raw) as Partial<TimerSettings>) : {});
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: TimerSettings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* penyimpanan penuh atau diblokir: pengaturan hanya berlaku selama halaman terbuka */
  }
}
