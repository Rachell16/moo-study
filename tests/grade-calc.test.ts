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

test("musim ujian: komponen yang dipakai ikut jenis ujian yang lagi berlangsung, bukan bobot terbesar", () => {
  const comps = [c("Tugas", 10, 90), c("UTS", 15, null), c("UAS", 40, null), c("LKP", 30, null)];
  // musim UTS: walau UAS (40%) dan LKP (30%) lebih besar, yang dipakai tetap UTS
  assert.equal(summarizeCourse(comps, "uts").nextComponent!.name, "UTS");
  // musim UAS: giliran UAS yang dipakai
  assert.equal(summarizeCourse(comps, "uas").nextComponent!.name, "UAS");
  // tidak tahu musim apa (mis. belum ada jadwal ujian): jatuh kembali ke bobot terbesar seperti sebelumnya
  assert.equal(summarizeCourse(comps).nextComponent!.name, "UAS");
  assert.equal(summarizeCourse(comps, null).nextComponent!.name, "UAS");
  // "uts" juga cocok ke "UTSP" (UTS praktikum), tapi tidak ke "UAS"
  const withUtsp = [c("UTS", 15, null), c("UTSP", 10, null), c("UAS", 40, null)];
  assert.equal(summarizeCourse(withUtsp, "uts").nextComponent!.name, "UTS"); // UTS (15) > UTSP (10), sama-sama cocok musim uts
  // musim ujian tersebut ada, tapi tidak ada komponen yang namanya cocok: jatuh ke bobot terbesar
  const noMatch = [c("Tugas", 20, null), c("Proyek", 50, null)];
  assert.equal(summarizeCourse(noMatch, "uts").nextComponent!.name, "Proyek");
});

test("ranking prioritas ikut musim ujian per mata kuliah, bukan cuma bobot mentah", () => {
  const courses = [
    {
      courseId: "sma",
      components: [c("UTS", 14, null), c("UAS", 50, null)],
      soonestExamKind: "uts",
    }, // musim UTS
    {
      courseId: "vk",
      components: [c("UTS", 15, null), c("UAS", 40, null)],
      soonestExamKind: "uts",
    }, // musim UTS juga
  ];
  const ranked = rankByImpact(courses);
  // dengan bobot mentah (lama), Visi Komputer akan dibandingkan pakai UAS-nya (40%); sekarang yang dibandingkan
  // bobot UTS-nya (15% dan 14%) karena itu yang lagi musim, jadi urutannya tetap wajar
  assert.deepEqual(
    ranked.map((r) => r.courseId),
    ["vk", "sma"],
  );
  for (const r of ranked) assert.equal(r.summary.nextComponent!.name, "UTS"); // bukan UAS, walau UAS bobotnya jauh lebih besar
  assert.equal(ranked[0]!.summary.nextComponent!.weightPercent, 15);
});
