import test from "node:test";
import assert from "node:assert/strict";
import {
  neededOnRemaining,
  rankByImpact,
  summarizeCourse,
  type GradeComponent,
} from "../src/lib/grade-calc.ts";

const c = (
  name: string,
  weightPercent: number,
  score: number | null,
  id = name,
): GradeComponent => ({ id, name, weightPercent, score });

test("belum ada nilai sama sekali: semuanya null, komponen terbesar jadi yang paling menentukan", () => {
  const s = summarizeCourse([c("Tugas", 20, null), c("UTS", 30, null), c("UAS", 50, null)]);
  assert.deepEqual(
    {
      totalWeight: s.totalWeight,
      gradedWeight: s.gradedWeight,
      remainingWeight: s.remainingWeight,
      running: s.runningPercent,
      projected: s.projectedFinal,
    },
    { totalWeight: 100, gradedWeight: 0, remainingWeight: 100, running: null, projected: null },
  );
  assert.equal(s.nextComponent!.name, "UAS");
});

test("sebagian sudah dinilai: nilai berjalan, proyeksi akhir, dan sisa bobot dihitung benar", () => {
  const s = summarizeCourse([c("Tugas", 20, 90), c("UTS", 30, 70), c("UAS", 50, null)]);
  // earned = 90*0.2 + 70*0.3 = 18 + 21 = 39, gradedWeight = 50 -> running = 39/50*100 = 78
  assert.equal(s.earnedPoints, 39);
  assert.equal(s.gradedWeight, 50);
  assert.equal(s.runningPercent, 78);
  // proyeksi: 39 + 78% dari sisa 50 = 39 + 39 = 78
  assert.equal(s.projectedFinal, 78);
  assert.equal(s.remainingWeight, 50);
  assert.equal(s.nextComponent!.name, "UAS");
});

test("semua komponen sudah dinilai: tidak ada yang perlu diprioritaskan lagi", () => {
  const s = summarizeCourse([c("Tugas", 40, 80), c("UAS", 60, 90)]);
  assert.equal(s.nextComponent, null);
  assert.equal(s.remainingWeight, 0);
  assert.equal(s.runningPercent, 86); // (80*0.4+90*0.6)=32+54=86, gradedWeight=100
});

test("bobot belum lengkap (belum semua komponen dimasukkan) tetap dihitung apa adanya", () => {
  const s = summarizeCourse([c("Tugas", 20, 100)]);
  assert.equal(s.totalWeight, 20);
  assert.equal(s.remainingWeight, 0); // tidak ada komponen lain yang terdaftar untuk dikejar
  assert.equal(s.nextComponent, null);
});

test("target nilai akhir: berapa yang dibutuhkan di sisa komponen (bisa mustahil atau sudah aman)", () => {
  const comps = [c("Tugas", 20, 90), c("UTS", 30, 70), c("UAS", 50, null)]; // earned=39, sisa 50
  assert.equal(neededOnRemaining(comps, 80), 82); // (80-39)/50*100 = 82
  assert.equal(neededOnRemaining(comps, 39), 0); // cukup dapat 0 buat sekadar menyamai 39
  assert.ok(neededOnRemaining(comps, 100)! > 100); // target mustahil
  assert.equal(neededOnRemaining([c("Tugas", 100, 90)], 90), null); // tidak ada sisa untuk dikejar
});

test("urutan prioritas belajar: bobot komponen berikutnya paling besar dulu, lalu nilai berjalan paling lemah", () => {
  const courses = [
    { courseId: "a", components: [c("UAS", 40, null)] }, // belum ada nilai berjalan, bobot 40
    { courseId: "b", components: [c("Tugas", 20, 60), c("UAS", 50, null)] }, // bobot 50, running lemah (60)
    { courseId: "c", components: [c("Tugas", 20, 95), c("UAS", 50, null)] }, // bobot 50, running kuat (95)
    { courseId: "d", components: [c("UAS", 30, 80)] }, // sudah dinilai semua, tidak masuk
  ];
  const ranked = rankByImpact(courses);
  assert.deepEqual(
    ranked.map((r) => r.courseId),
    ["b", "c", "a"],
  ); // bobot 50 dulu (b lebih lemah dari c), baru bobot 40
});
