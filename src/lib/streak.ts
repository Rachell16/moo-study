// Streak belajar: berapa hari berturut-turut ada minimal satu sesi fokus yang selesai (hari kalender lokal).

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

export type Streak = { current: number; best: number; todayDone: boolean };

export function computeStreak(dates: Date[], now = new Date()): Streak {
  const days = new Set(dates.map(dayKey));
  const todayDone = days.has(dayKey(now));

  // Streak masih hidup kalau hari ini belum ada sesi tapi kemarin ada; putus kalau sudah lewat sehari penuh.
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!todayDone) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (days.has(dayKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }

  let best = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of [...days].sort()) {
    const d = parseKey(key);
    run = prev && Math.round((d.getTime() - prev.getTime()) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best, todayDone };
}

// Tanda centang Senin sampai Minggu untuk minggu yang dimulai di `weekStart`.
export function weekMarks(dates: Date[], weekStart: Date): boolean[] {
  const days = new Set(dates.map(dayKey));
  return Array.from({ length: 7 }, (_, i) =>
    days.has(
      dayKey(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)),
    ),
  );
}
