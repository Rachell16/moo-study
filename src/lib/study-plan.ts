// Rencana belajar hari ini: pilih apa yang paling perlu dipelajari lalu tempatkan di waktu kosong.
// Berbasis aturan (tanpa AI dan tanpa koneksi), jadi gratis, cepat, dan hasilnya bisa dijelaskan.
import { buildRoadmaps } from "./study-roadmap.ts";
import { daysUntil, fmtTime, type Course, type Material, type Schedule } from "./schedule-utils.ts";

export type PlanKind = "tugas" | "ujian" | "persiapan" | "ulas" | "lanjut" | "review" | "ulang";

export type PlanItem = {
  key: string;
  kind: PlanKind;
  title: string; // dipakai juga sebagai judul blok belajar di kalender
  reason: string;
  minutes: number;
  score: number;
  courseId: string | null;
  materialId: string | null;
  notBefore: Date | null; // mis. baru bisa setelah kuliah selesai
  slot: { start: Date; end: Date } | null;
  scheduled: { start: Date } | null; // sudah ada blok belajar dengan judul yang sama
};

export type PlanInput = {
  now: Date;
  schedules: Schedule[]; // jadwal hari ini dan besok (kuliah, praktikum, blok belajar, dll)
  tasks: Schedule[]; // deadline tugas
  exams: Schedule[];
  materials: Material[];
  courses: Course[];
  progress: Map<string, { done: number; total: number }>; // poin materi yang sudah dipahami
  quizBest?: Map<string, number>; // skor latihan terbaik (persen) per materi
  dueCards?: number; // kartu hafalan berjarak yang jatuh tempo hari ini
  dayStartHour?: number;
  dayEndHour?: number;
  maxBlocks?: number;
};

export type Plan = { items: PlanItem[]; note: string | null };

const MIN = 60000;
const BUFFER = 10 * MIN; // jeda di sekitar acara lain dan antar blok belajar
const MIN_BLOCK = 25;

const natural = (a: Material, b: Material) => a.name.localeCompare(b.name, "id", { numeric: true });
const sameDay = (a: Date, b: Date) => daysUntil(a, b) === 0;
const isClass = (s: Schedule) => s.activity_type === "kuliah" || s.activity_type === "praktikum";

// "Kuliah_03_supervised-learning.pdf" jadi "Kuliah 03 supervised-learning"
export function cleanMaterialName(name: string) {
  return name
    .replace(/\.(pdf|pptx?)$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}

function deadlineText(deadline: Date, now: Date) {
  const d = daysUntil(deadline, now);
  if (d < 0 || deadline.getTime() < now.getTime()) return "sudah lewat, kerjakan sekarang";
  if (d === 0) return `hari ini ${fmtTime(deadline)}`;
  if (d === 1) return `besok ${fmtTime(deadline)}`;
  return deadline.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
}

type Window = { start: number; end: number };

function freeWindows(
  now: Date,
  schedules: Schedule[],
  startHour: number,
  endHour: number,
): Window[] {
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour).getTime();
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour).getTime();
  const soon = now.getTime() + 5 * MIN;
  const from = Math.max(dayStart, Math.ceil(soon / (15 * MIN)) * 15 * MIN); // pembulatan ke atas per 15 menit

  const busy = schedules
    .map((s) => ({
      start: new Date(s.starts_at).getTime() - BUFFER,
      end: new Date(s.ends_at).getTime() + BUFFER,
    }))
    .filter((b) => b.end > from && b.start < dayEnd)
    .sort((a, b) => a.start - b.start);

  const windows: Window[] = [];
  let cursor = from;
  for (const b of busy) {
    if (b.start - cursor >= MIN_BLOCK * MIN) windows.push({ start: cursor, end: b.start });
    cursor = Math.max(cursor, b.end);
  }
  if (dayEnd - cursor >= MIN_BLOCK * MIN) windows.push({ start: cursor, end: dayEnd });
  return windows;
}

export function buildPlan(input: PlanInput): Plan {
  const { now, courses, progress } = input;
  const startHour = input.dayStartHour ?? 7;
  const endHour = input.dayEndHour ?? 22;
  const maxBlocks = input.maxBlocks ?? 4;
  const courseOf = (id: string | null) => courses.find((c) => c.id === id);
  const items: Omit<PlanItem, "slot" | "scheduled">[] = [];
  const used = new Set<string>(); // satu materi hanya muncul sekali

  const pending = (courseId: string | null, scope?: string) =>
    input.materials
      .filter(
        (m) =>
          m.course_id === courseId &&
          m.reviewed_at === null &&
          !used.has(m.id) &&
          (!scope || m.exam_scope === scope),
      )
      .sort(natural);

  const add = (
    it: Omit<PlanItem, "slot" | "scheduled" | "notBefore"> & { notBefore?: Date | null },
  ) => {
    if (it.materialId) used.add(it.materialId);
    items.push({ ...it, notBefore: it.notBefore ?? null });
  };

  // 1) tugas dengan deadline dekat
  for (const t of input.tasks) {
    if (t.done) continue;
    const deadline = new Date(t.ends_at);
    const hours = (deadline.getTime() - now.getTime()) / 36e5;
    if (hours < -24) continue; // sudah lewat lebih dari sehari: bukan prioritas rencana hari ini
    const base =
      hours < 0
        ? 110
        : hours <= 24
          ? 100
          : hours <= 48
            ? 80
            : hours <= 96
              ? 58
              : hours <= 168
                ? 36
                : 0;
    if (!base) continue;
    add({
      key: `tugas:${t.id}`,
      kind: "tugas",
      title: `Kerjakan ${t.title}`,
      reason: `Deadline ${deadlineText(deadline, now)}.`,
      minutes: 60,
      score: base + (t.urgent ? 15 : 0),
      courseId: t.course_id,
      materialId: null,
    });
  }

  // 2) ujian: ambil bagian hari ini dari peta jalan menuju ujian (materi dibagi merata ke hari-hari sebelum ujian)
  for (const road of buildRoadmaps({
    now,
    exams: input.exams,
    materials: input.materials,
    courses,
    progress,
    quizBest: input.quizBest ?? new Map(),
  })) {
    const d = road.daysLeft;
    const base = d <= 3 ? 96 : d <= 7 ? 78 : d <= 14 ? 56 : d <= 30 ? 32 : 0;
    const today = road.days[0];
    if (!base || !today?.isToday) continue;
    const when = d === 0 ? "hari ini" : d === 1 ? "besok" : `${d} hari lagi`;
    today.items.forEach((it, i) => {
      if (it.materialId && used.has(it.materialId)) return;
      add({
        key: i === 0 ? `ujian:${road.exam.id}` : `ujian:${road.exam.id}:${i + 1}`,
        kind: "ujian",
        title: it.title,
        reason:
          it.kind === "review"
            ? `${road.kindLabel} ${road.courseName} ${when}, ${road.pending} materi belum di-review.`
            : `${road.kindLabel} ${road.courseName} ${when}. Saatnya latihan soal.`,
        minutes: it.minutes,
        score: base,
        courseId: it.courseId,
        materialId: it.materialId,
      });
    });
  }

  // kartu hafalan berjarak yang jatuh tempo
  if ((input.dueCards ?? 0) > 0) {
    const n = input.dueCards!;
    add({
      key: "ulang",
      kind: "ulang",
      title: `Ulang ${n} kartu hafalan`,
      reason: "Soal yang pernah salah, diulang tepat sebelum lupa.",
      minutes: Math.min(Math.max(Math.ceil(n * 0.7), 5), 20),
      score: 74,
      courseId: null,
      materialId: null,
    });
  }

  // 3) lanjutkan materi yang sudah setengah jalan di ruang belajar
  for (const m of input.materials) {
    const p = progress.get(m.id);
    if (!p || p.done === 0 || p.done >= p.total || used.has(m.id)) continue;
    add({
      key: `lanjut:${m.id}`,
      kind: "lanjut",
      title: `Lanjutkan ${cleanMaterialName(m.name)}`,
      reason: `${p.done} dari ${p.total} poin sudah kamu pahami.`,
      minutes: 30,
      score: 70,
      courseId: m.course_id,
      materialId: m.id,
    });
  }

  // 4) siap-siap untuk kuliah besok, dan ulas kuliah hari ini
  for (const s of input.schedules) {
    if (!isClass(s) || !s.course_id) continue;
    const start = new Date(s.starts_at);
    const d = daysUntil(start, now);
    if (d !== 0 && d !== 1) continue;
    const next = pending(s.course_id)[0];
    if (!next) continue;
    if (d === 1) {
      add({
        key: `persiapan:${s.id}`,
        kind: "persiapan",
        title: `Baca ${cleanMaterialName(next.name)}`,
        reason: `Besok ada ${s.title}. Baca dulu supaya nyambung.`,
        minutes: 30,
        score: 62,
        courseId: s.course_id,
        materialId: next.id,
      });
    } else {
      add({
        key: `ulas:${s.id}`,
        kind: "ulas",
        title: `Ulas ${cleanMaterialName(next.name)}`,
        reason: `Hari ini ada ${s.title}. Ulas materinya selagi masih segar.`,
        minutes: 30,
        score: 52,
        courseId: s.course_id,
        materialId: next.id,
        notBefore: new Date(s.ends_at),
      });
    }
  }

  // 5) materi lama yang belum pernah di-review, satu per mata kuliah
  const seenCourse = new Set<string | null>();
  const backlog = input.materials
    .filter((m) => m.reviewed_at === null && !used.has(m.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const m of backlog) {
    if (seenCourse.has(m.course_id) || seenCourse.size >= 2) continue;
    seenCourse.add(m.course_id);
    const age = Math.max(Math.floor((now.getTime() - new Date(m.created_at).getTime()) / 864e5), 0);
    add({
      key: `review:${m.id}`,
      kind: "review",
      title: `Review ${cleanMaterialName(m.name)}`,
      reason: `${courseOf(m.course_id)?.name ?? "Materi"} belum pernah di-review.`,
      minutes: 30,
      score: 20 + Math.min(age, 10),
      courseId: m.course_id,
      materialId: m.id,
    });
  }

  items.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  // ---- tempatkan di waktu kosong hari ini ----
  const today = input.schedules.filter((s) => sameDay(new Date(s.starts_at), now));
  const windows = freeWindows(now, today, startHour, endHour);
  const study = today.filter((s) => s.activity_type === "belajar");
  const out: PlanItem[] = [];
  let blocks = 0;
  let planned = 0;

  for (const it of items) {
    const already = study.find((s) => s.title === it.title);
    if (already) {
      out.push({ ...it, slot: null, scheduled: { start: new Date(already.starts_at) } });
      continue;
    }
    let placed: { start: Date; end: Date } | null = null;
    if (blocks < maxBlocks && planned < 240) {
      const fit = (w: Window, want: number) => {
        const start = Math.max(w.start, it.notBefore?.getTime() ?? 0);
        const room = Math.floor((w.end - start) / (5 * MIN)) * 5;
        return room >= Math.min(want, MIN_BLOCK) ? { start, minutes: Math.min(want, room) } : null;
      };
      // utamakan jendela yang muat penuh; kalau tidak ada, pakai yang terbesar (dipendekkan)
      let choice: { w: Window; start: number; minutes: number } | null = null;
      for (const w of windows) {
        const f = fit(w, it.minutes);
        if (f && f.minutes >= it.minutes) {
          choice = { w, ...f };
          break;
        }
      }
      if (!choice) {
        for (const w of windows) {
          const f = fit(w, it.minutes);
          if (f && f.minutes >= 30 && (!choice || f.minutes > choice.minutes)) choice = { w, ...f };
        }
      }
      if (choice) {
        placed = {
          start: new Date(choice.start),
          end: new Date(choice.start + choice.minutes * MIN),
        };
        choice.w.start = choice.start + choice.minutes * MIN + BUFFER;
        blocks++;
        planned += choice.minutes;
      }
    }
    // tanpa slot: tetap tampil kalau cukup penting, supaya tidak hilang dari pandangan
    if (placed || it.score >= 55) out.push({ ...it, slot: placed, scheduled: null });
  }

  out.sort((a, b) => {
    const ta = (a.slot?.start ?? a.scheduled?.start)?.getTime() ?? Infinity;
    const tb = (b.slot?.start ?? b.scheduled?.start)?.getTime() ?? Infinity;
    return ta - tb || b.score - a.score;
  });

  const shown = out.slice(0, 6);
  const unslotted = shown.some((i) => !i.slot && !i.scheduled);
  const note =
    shown.length === 0
      ? null
      : windows.length === 0 && unslotted
        ? "Waktu kosong hari ini sudah habis. Kerjakan yang paling mendesak dulu, sisanya bisa besok pagi."
        : null;
  return { items: shown, note };
}
