import test from "node:test";
import assert from "node:assert/strict";
import { buildPlan, cleanMaterialName } from "../src/lib/study-plan.ts";

const t = (day: number, h: number, m = 0) => new Date(2026, 8, day, h, m).toISOString();
const hm = (d: Date | undefined) =>
  d ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` : null;

const sched = (
  id: string,
  title: string,
  type: string,
  start: string,
  end: string,
  extra: object = {},
) =>
  ({
    id,
    user_id: "u",
    title,
    activity_type: type,
    starts_at: start,
    ends_at: end,
    course_id: null,
    done: false,
    urgent: false,
    exam_kind: null,
    location: null,
    notes: null,
    sync_status: "tersinkron",
    google_event_id: null,
    created_at: "",
    updated_at: "",
    ...extra,
  }) as never;
const course = (id: string, name: string) =>
  ({
    id,
    name,
    code: id.toUpperCase(),
    color: "sage",
    alias: "",
    lecturer: null,
    semester: 5,
    user_id: "u",
    created_at: "",
    updated_at: "",
  }) as never;
const material = (id: string, courseId: string, name: string, extra: object = {}) =>
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
    created_at: "2026-09-18T00:00:00Z",
    updated_at: "",
    quiz: null,
    study_notes: "",
    outline_generated_at: null,
    quiz_generated_at: null,
    ...extra,
  }) as never;

const now = new Date(2026, 8, 21, 9, 0); // Senin 21 Sep 2026, 09.00
const courses = [
  course("sma", "Sistem Multi-Agen"),
  course("hai", "Human-AI Interaction"),
  course("pm", "Pembelajaran Mesin"),
  course("vk", "Visi Komputer"),
];
const today = [
  sched("k1", "Sistem Multi-Agen (K/1)", "kuliah", t(21, 10), t(21, 11, 40), { course_id: "sma" }),
  sched("k2", "Human-AI Interaction (K/1)", "kuliah", t(21, 13), t(21, 14, 40), {
    course_id: "hai",
  }),
  sched("p1", "Sistem Multi-Agen (P/1)", "praktikum", t(21, 15), t(21, 17), { course_id: "sma" }),
  sched("k3", "Pembelajaran Mesin (K/1)", "kuliah", t(22, 8), t(22, 9, 40), { course_id: "pm" }),
];
const tasks = [
  sched("t1", "SMA LKP 4", "tugas", t(20, 23, 29), t(20, 23, 59), {
    urgent: true,
    course_id: "sma",
  }),
  sched("t2", "CV LKP 5", "tugas", t(22, 23, 29), t(22, 23, 59), { course_id: "vk" }),
];
const exams = [
  sched(
    "e1",
    "UTS Visi Komputer",
    "ujian",
    new Date(2026, 9, 12, 8).toISOString(),
    new Date(2026, 9, 12, 10).toISOString(),
    {
      exam_kind: "uts",
      course_id: "vk",
    },
  ),
];
const materials = [
  material("v1", "vk", "Kuliah 01-pendahuluan.pdf"),
  material("v2", "vk", "Kuliah 02 - Visi_Komputer-2.pdf"),
  material("v10", "vk", "Kuliah 10 - Akhir.pdf"),
  material("m1", "pm", "slide_kuliah_03_supervised_learning.pdf"),
];

test("nama materi dibersihkan", () => {
  assert.equal(
    cleanMaterialName("Kuliah_03_supervised_learning.pdf"),
    "Kuliah 03 supervised learning",
  );
  assert.equal(cleanMaterialName("Chap 1 - The_AI_Playbook.pptx"), "Chap 1 - The AI Playbook");
});

test("rencana Senin pagi: tugas mendesak dulu, ditempatkan di waktu kosong di antara kuliah", () => {
  const { items } = buildPlan({
    now,
    schedules: today,
    tasks,
    exams,
    materials,
    courses,
    progress: new Map(),
  });
  const by = (key: string) => items.find((i) => i.key === key)!;

  // tugas SMA sudah lewat 9 jam dan penting: skor tertinggi, dapat jendela 60 menit (11.50-12.50) di antara dua kuliah
  const sma = by("tugas:t1");
  assert.equal(sma.reason.startsWith("Deadline sudah lewat"), true);
  assert.equal(`${hm(sma.slot?.start)}-${hm(sma.slot?.end)}`, "11:50-12:50");

  // persiapan kuliah besok (Pembelajaran Mesin) muat di jendela pagi 09.15-09.50 (30 menit)
  const prep = by("persiapan:k3");
  assert.equal(prep.materialId, "m1");
  assert.equal(`${hm(prep.slot?.start)}-${hm(prep.slot?.end)}`, "09:15-09:45");

  // CV LKP 5 (39 jam lagi) dapat slot setelah praktikum selesai (17.00 + jeda 10 menit)
  assert.equal(hm(by("tugas:t2").slot?.start), "17:10");

  // tidak ada dua blok yang bertabrakan dengan kuliah atau satu sama lain
  const blocks = items
    .filter((i) => i.slot)
    .map((i) => i.slot!)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  for (let i = 1; i < blocks.length; i++) assert.ok(blocks[i]!.start >= blocks[i - 1]!.end);
  for (const b of blocks)
    for (const s of today.filter((x: { starts_at: string }) =>
      x.starts_at.startsWith("2026-09-21"),
    )) {
      assert.ok(
        b.end <= new Date((s as { starts_at: string }).starts_at) ||
          b.start >= new Date((s as { ends_at: string }).ends_at),
      );
    }
  // urutan tampil mengikuti jam
  const starts = items.filter((i) => i.slot).map((i) => i.slot!.start.getTime());
  assert.deepEqual(
    starts,
    [...starts].sort((a, b) => a - b),
  );
});

test("ujian jauh (21 hari) dan materi pertama yang belum di-review dipilih lebih dulu, urut angka", () => {
  const { items } = buildPlan({
    now,
    schedules: today,
    tasks: [],
    exams,
    materials,
    courses,
    progress: new Map(),
  });
  const uts = items.find((i) => i.key === "ujian:e1");
  // skor 32 (<55) dan tidak ada slot: tidak masuk daftar. Dengan slot kosong yang luas ia tetap ditempatkan.
  assert.ok(uts);
  assert.equal(uts.materialId, "v1"); // "Kuliah 01" sebelum "Kuliah 02" dan "Kuliah 10"
  assert.match(uts.reason, /UTS Visi Komputer 21 hari lagi, 3 materi belum di-review/);
});

test("blok belajar yang sudah dijadwalkan tidak diusulkan lagi", () => {
  const first = buildPlan({
    now,
    schedules: today,
    tasks,
    exams,
    materials,
    courses,
    progress: new Map(),
  }).items[0]!;
  const withBlock = [
    ...today,
    sched(
      "b1",
      first.title,
      "belajar",
      first.slot!.start.toISOString(),
      first.slot!.end.toISOString(),
    ),
  ];
  const again = buildPlan({
    now,
    schedules: withBlock,
    tasks,
    exams,
    materials,
    courses,
    progress: new Map(),
  }).items;
  const same = again.find((i) => i.title === first.title)!;
  assert.equal(same.slot, null);
  assert.equal(hm(same.scheduled?.start), hm(first.slot!.start));
});

test("materi setengah jalan diusulkan lanjut, dan reviewed tidak diusulkan", () => {
  const mats = [
    material("v1", "vk", "Kuliah 01.pdf", { reviewed_at: "2026-09-19T00:00:00Z" }),
    material("v2", "vk", "Kuliah 02.pdf"),
  ];
  const progress = new Map([["v2", { done: 3, total: 8 }]]);
  const { items } = buildPlan({
    now,
    schedules: [],
    tasks: [],
    exams: [],
    materials: mats,
    courses,
    progress,
  });
  assert.equal(
    items.some((i) => i.materialId === "v1"),
    false,
  );
  const lanjut = items.find((i) => i.kind === "lanjut")!;
  assert.equal(lanjut.reason, "3 dari 8 poin sudah kamu pahami.");
});

test("larut malam: tidak ada waktu kosong, tugas mendesak tetap tampil dengan catatan", () => {
  const late = new Date(2026, 8, 21, 21, 50);
  const { items, note } = buildPlan({
    now: late,
    schedules: [],
    tasks: [sched("t9", "SMA LKP 4", "tugas", t(21, 23, 29), t(21, 23, 59), { course_id: "sma" })],
    exams: [],
    materials: [],
    courses,
    progress: new Map(),
  });
  assert.equal(items.length, 1);
  assert.equal(items[0]!.slot, null);
  assert.match(note ?? "", /Waktu kosong hari ini sudah habis/);
});

test("tanpa apa-apa: rencana kosong", () => {
  const r = buildPlan({
    now,
    schedules: [],
    tasks: [],
    exams: [],
    materials: [],
    courses,
    progress: new Map(),
  });
  assert.deepEqual(r, { items: [], note: null });
});

test("kartu hafalan yang jatuh tempo jadi satu usulan dengan durasi menyesuaikan jumlah kartu", () => {
  const items = buildPlan({
    now,
    schedules: [],
    tasks: [],
    exams: [],
    materials: [],
    courses,
    progress: new Map(),
    dueCards: 12,
  }).items;
  const ulang = items.find((i) => i.kind === "ulang")!;
  assert.equal(ulang.title, "Ulang 12 kartu hafalan");
  assert.equal(ulang.minutes, 9);
  assert.equal(
    buildPlan({
      now,
      schedules: [],
      tasks: [],
      exams: [],
      materials: [],
      courses,
      progress: new Map(),
      dueCards: 100,
    }).items[0]!.minutes,
    20,
  ); // maksimal 20 menit
  assert.equal(
    buildPlan({
      now,
      schedules: [],
      tasks: [],
      exams: [],
      materials: [],
      courses,
      progress: new Map(),
      dueCards: 0,
    }).items.length,
    0,
  );
});

test("ujian 2 hari lagi: beberapa materi jatuh di hari ini menurut peta jalan, tiap materi jadi usulan sendiri", () => {
  const near = [
    sched(
      "e2",
      "UTS Visi Komputer",
      "ujian",
      new Date(2026, 8, 23, 8).toISOString(),
      new Date(2026, 8, 23, 10).toISOString(),
      { exam_kind: "uts", course_id: "vk" },
    ),
  ];
  const mats = ["v1", "v2", "v3", "v4"].map((id, i) => material(id, "vk", `Kuliah 0${i + 1}.pdf`));
  const { items } = buildPlan({
    now,
    schedules: [],
    tasks: [],
    exams: near,
    materials: mats,
    courses,
    progress: new Map(),
  });
  const uts = items.filter((i) => i.kind === "ujian");
  assert.equal(uts.length, 2); // 4 materi dibagi 2 hari: 2 hari ini
  assert.deepEqual(uts.map((i) => i.materialId).sort(), ["v1", "v2"]);
  assert.match(uts[0]!.reason, /UTS Visi Komputer 2 hari lagi, 4 materi belum di-review/);
});
