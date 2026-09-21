// Peta jalan menuju UTS/UAS: membagi materi yang belum di-review ke hari-hari sebelum ujian.
// Dihitung ulang tiap hari dari keadaan terbaru, jadi materi yang terlewat otomatis bergeser ke hari-hari berikutnya.
import {
  addDays,
  daysUntil,
  startOfDay,
  type Course,
  type Material,
  type Schedule,
} from "./schedule-utils.ts";

export type RoadmapItem = {
  key: string;
  kind: "review" | "latihan";
  title: string;
  minutes: number;
  materialId: string | null;
  courseId: string | null;
};

export type RoadmapDay = { date: Date; items: RoadmapItem[]; minutes: number; isToday: boolean };

export type Roadmap = {
  exam: Schedule;
  kindLabel: string; // UTS atau UAS
  courseName: string;
  daysLeft: number;
  pending: number; // materi yang belum di-review
  totalMinutes: number;
  days: RoadmapDay[];
  warning: string | null;
};

export type RoadmapInput = {
  now: Date;
  exams: Schedule[];
  materials: Material[];
  courses: Course[];
  progress: Map<string, { done: number; total: number }>;
  quizBest: Map<string, number>; // skor terbaik (persen) per materi
  perDayMinutes?: number; // di atas ini sebuah hari dianggap terlalu padat
  horizonDays?: number; // ujian yang lebih jauh dari ini belum dibuatkan peta
};

const natural = (a: Material, b: Material) => a.name.localeCompare(b.name, "id", { numeric: true });
const REVIEW_MINUTES = 45;
const PRACTICE_MINUTES = 40;

// "Kuliah_03_supervised.pdf" jadi "Kuliah 03 supervised"
export function cleanName(name: string) {
  return name
    .replace(/\.(pdf|pptx?)$/i, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
}

function reviewMinutes(m: Material, progress: RoadmapInput["progress"]) {
  const p = progress.get(m.id);
  if (!p || p.total === 0) return REVIEW_MINUTES;
  return Math.max(15, Math.round((REVIEW_MINUTES * (1 - p.done / p.total)) / 5) * 5); // poin yang sudah dipahami mengurangi waktu
}

export function buildRoadmaps(input: RoadmapInput): Roadmap[] {
  const { now, courses, progress, quizBest } = input;
  const perDay = input.perDayMinutes ?? 180;
  const horizon = input.horizonDays ?? 45;
  const today = startOfDay(now);
  const out: Roadmap[] = [];

  for (const exam of input.exams) {
    const start = new Date(exam.starts_at);
    if (!exam.exam_kind || start.getTime() <= now.getTime()) continue;
    const daysLeft = daysUntil(start, now);
    if (daysLeft > horizon) continue;

    const courseName = courses.find((c) => c.id === exam.course_id)?.name ?? "ujian";
    const kindLabel = exam.exam_kind.toUpperCase();
    const inScope = input.materials.filter(
      (m) => m.course_id === exam.course_id && m.exam_scope === exam.exam_kind,
    );
    const pendingMats = inScope.filter((m) => m.reviewed_at === null).sort(natural);

    // hari belajar: hari ini sampai sehari sebelum ujian; hari-hari terakhir dipakai latihan soal
    const D = daysLeft; // jumlah hari sebelum ujian, termasuk hari ini
    const reserve = D >= 7 ? 2 : D >= 3 ? 1 : 0;
    const studyDays = Math.max(D - reserve, D >= 1 ? 1 : 0);
    const days: RoadmapDay[] = Array.from({ length: D }, (_, i) => ({
      date: addDays(today, i),
      items: [],
      minutes: 0,
      isToday: i === 0,
    }));

    pendingMats.forEach((m, i) => {
      const dayIndex = Math.min(studyDays - 1, Math.floor((i * studyDays) / pendingMats.length));
      days[dayIndex]?.items.push({
        key: `${exam.id}:review:${m.id}`,
        kind: "review",
        title: `Review ${cleanName(m.name)}`,
        minutes: reviewMinutes(m, progress),
        materialId: m.id,
        courseId: exam.course_id,
      });
    });

    // latihan soal di hari-hari terakhir: materi dengan skor terendah (atau belum pernah dilatih) dulu
    const practiceOrder = [...inScope].sort(
      (a, b) => (quizBest.get(a.id) ?? -1) - (quizBest.get(b.id) ?? -1) || natural(a, b),
    );
    for (let r = 0; r < reserve; r++) {
      const m = practiceOrder.length ? practiceOrder[r % practiceOrder.length]! : null;
      const last = r === reserve - 1;
      days[studyDays + r]?.items.push({
        key: `${exam.id}:latihan:${r}`,
        kind: "latihan",
        title: m ? `Latihan soal ${cleanName(m.name)}` : `Latihan soal ${courseName}`,
        minutes: PRACTICE_MINUTES + (last ? 0 : 0),
        materialId: m?.id ?? null,
        courseId: exam.course_id,
      });
    }

    for (const d of days) d.minutes = d.items.reduce((s, i) => s + i.minutes, 0);
    const total = days.reduce((s, d) => s + d.minutes, 0);
    const busiest = days.reduce(
      (a, d) => (d.minutes > a.minutes ? d : a),
      days[0] ?? { minutes: 0, date: today, items: [], isToday: false },
    );

    let warning: string | null = null;
    if (D === 0) warning = "Ujian hari ini. Semoga lancar!";
    else if (busiest.minutes > perDay)
      warning = `Ada hari yang padat (${Math.round(busiest.minutes / 60)} jam lebih). ${pendingMats.length} materi dalam ${studyDays} hari belajar: mulai lebih awal atau kurangi yang tidak perlu.`;
    else if (pendingMats.length === 0)
      warning = "Semua materi sudah di-review. Fokus latihan soal.";

    out.push({
      exam,
      kindLabel,
      courseName,
      daysLeft,
      pending: pendingMats.length,
      totalMinutes: total,
      days,
      warning,
    });
  }
  return out.sort((a, b) => a.exam.starts_at.localeCompare(b.exam.starts_at));
}
