import test from "node:test";
import assert from "node:assert/strict";
import { buildRoadmaps, cleanName } from "../src/lib/study-roadmap.ts";

const now = new Date(2026, 8, 21, 9, 0); // Senin 21 Sep 2026
const exam = (id: string, courseId: string, daysAhead: number, kind = "uts") =>
  ({
    id,
    user_id: "u",
    title: `UTS ${courseId}`,
    activity_type: "ujian",
    starts_at: new Date(2026, 8, 21 + daysAhead, 8).toISOString(),
    ends_at: new Date(2026, 8, 21 + daysAhead, 10).toISOString(),
    course_id: courseId,
    exam_kind: kind,
    done: false,
    urgent: false,
    location: null,
    notes: null,
    sync_status: "x",
    google_event_id: null,
    created_at: "",
    updated_at: "",
  }) as never;
const course = (id: string, name: string) =>
  ({
    id,
    name,
    code: id,
    color: "sage",
    alias: "",
    lecturer: null,
    semester: 5,
    user_id: "u",
    created_at: "",
    updated_at: "",
  }) as never;
const mat = (id: string, courseId: string, name: string, extra: object = {}) =>
  ({
    id,
    user_id: "u",
    course_id: courseId,
    name,
    storage_path: "x",
    file_type: "pdf",
    material_type: "kuliah",
    exam_scope: "uts",
    semester: 5,
    size_bytes: 1,
    reviewed_at: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "",
    quiz: null,
    study_notes: "",
    outline_generated_at: null,
    quiz_generated_at: null,
    ...extra,
  }) as never;
const base = {
  now,
  courses: [course("vk", "Visi Komputer"), course("pm", "Pembelajaran Mesin")],
  progress: new Map(),
  quizBest: new Map(),
};
const titles = (d: { items: { title: string }[] }) => d.items.map((i) => i.title);

test("nama materi dibersihkan", () => {
  assert.equal(cleanName("Kuliah_03_supervised.pdf"), "Kuliah 03 supervised");
});

test("ujian 12 hari lagi, 4 materi: tersebar merata mulai hari ini, urut angka, dan 2 hari terakhir untuk latihan", () => {
  const materials = [
    mat("m10", "vk", "Kuliah 10.pdf"),
    mat("m2", "vk", "Kuliah 02.pdf"),
    mat("m1", "vk", "Kuliah 01.pdf"),
    mat("m3", "vk", "Kuliah 03.pdf"),
  ];
  const [r] = buildRoadmaps({ ...base, exams: [exam("e1", "vk", 12)], materials });
  assert.equal(r!.daysLeft, 12);
  assert.equal(r!.days.length, 12);
  assert.equal(r!.kindLabel, "UTS");
  assert.equal(r!.pending, 4);
  // 10 hari belajar untuk 4 materi: hari ke-0, 2, 5, 7
  const reviewDays = r!.days
    .map((d, i) => [i, d.items.filter((x) => x.kind === "review")] as const)
    .filter(([, it]) => it.length);
  assert.deepEqual(
    reviewDays.map(([i]) => i),
    [0, 2, 5, 7],
  );
  assert.deepEqual(
    reviewDays.map(([, it]) => it[0]!.title),
    ["Review Kuliah 01", "Review Kuliah 02", "Review Kuliah 03", "Review Kuliah 10"],
  );
  assert.equal(r!.days[0]!.isToday, true);
  // dua hari terakhir: latihan soal, tidak ada review
  assert.deepEqual(
    [10, 11].map((i) => r!.days[i]!.items.map((x) => x.kind)),
    [["latihan"], ["latihan"]],
  );
  assert.equal(r!.warning, null);
});

test("ujian dekat (2 hari): semua materi langsung dibagi ke hari ini dan besok, tanpa hari khusus latihan; peringatan kalau padat", () => {
  const materials = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((n) =>
    mat(n, "vk", `Kuliah ${n}.pdf`),
  );
  const [r] = buildRoadmaps({ ...base, exams: [exam("e1", "vk", 2)], materials });
  assert.equal(r!.days.length, 2);
  assert.equal(r!.days[0]!.items.length, 5);
  assert.equal(r!.days[1]!.items.length, 5);
  assert.match(r!.warning ?? "", /Ada hari yang padat/);
});

test("materi yang sudah di-review tidak dijadwalkan lagi; kalau semua selesai, fokus latihan", () => {
  const materials = [
    mat("m1", "vk", "Kuliah 01.pdf", { reviewed_at: "2026-09-19T00:00:00Z" }),
    mat("m2", "vk", "Kuliah 02.pdf", { reviewed_at: "2026-09-19T00:00:00Z" }),
  ];
  const [r] = buildRoadmaps({ ...base, exams: [exam("e1", "vk", 9)], materials });
  assert.equal(r!.pending, 0);
  assert.equal(
    r!.days.flatMap((d) => d.items).some((i) => i.kind === "review"),
    false,
  );
  assert.equal(r!.warning, "Semua materi sudah di-review. Fokus latihan soal.");
});

test("latihan soal memilih materi dengan skor terendah dulu; poin yang sudah paham mengurangi waktu review", () => {
  const materials = [
    mat("m1", "vk", "Kuliah 01.pdf"),
    mat("m2", "vk", "Kuliah 02.pdf"),
    mat("m3", "vk", "Kuliah 03.pdf"),
  ];
  const quizBest = new Map([
    ["m1", 90],
    ["m2", 40],
    ["m3", 70],
  ]);
  const progress = new Map([["m1", { done: 6, total: 8 }]]); // 2 dari 8 tersisa
  const [r] = buildRoadmaps({
    ...base,
    exams: [exam("e1", "vk", 10)],
    materials,
    quizBest,
    progress,
  });
  const practice = r!.days.flatMap((d) => d.items).filter((i) => i.kind === "latihan");
  assert.deepEqual(
    practice.map((p) => p.materialId),
    ["m2", "m3"],
  ); // 40 lalu 70
  const m1 = r!.days
    .flatMap((d) => d.items)
    .find((i) => i.materialId === "m1" && i.kind === "review")!;
  assert.equal(m1.minutes, 15); // 45 * 2/8 = 11, minimal 15
});

test("ujian yang sudah lewat, terlalu jauh, atau tanpa jenis dilewati; beberapa ujian diurutkan", () => {
  const materials = [mat("m1", "vk", "K1.pdf"), mat("p1", "pm", "P1.pdf")];
  const roads = buildRoadmaps({
    ...base,
    exams: [
      exam("lewat", "vk", -3),
      exam("jauh", "vk", 90),
      exam("pm", "pm", 8),
      exam("vk", "vk", 5),
    ],
    materials,
  });
  assert.deepEqual(
    roads.map((r) => r.exam.id),
    ["vk", "pm"],
  );
});

test("ujian besok: satu hari, ada latihan bukan review saja", () => {
  const [r] = buildRoadmaps({
    ...base,
    exams: [exam("e1", "vk", 1)],
    materials: [mat("m1", "vk", "K1.pdf")],
  });
  assert.equal(r!.days.length, 1);
  assert.deepEqual(titles(r!.days[0]!), ["Review K1"]);
});
