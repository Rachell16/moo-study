import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAttemptPayload,
  fmtSeconds,
  isCorrect,
  pct,
  readReview,
  readWrong,
  summarize,
  trendOf,
  type AttemptLike,
} from "../src/lib/quiz-history.ts";

const at = (
  id: string,
  day: number,
  score: number,
  total: number,
  mode = "acak10",
): AttemptLike => ({
  id,
  score,
  total,
  mode,
  duration_seconds: 120,
  wrong: [],
  created_at: `2026-09-${String(day).padStart(2, "0")}T10:00:00Z`,
});

test("ringkasan: terbaik, rata-rata, terakhir, dan sebelumnya (urutan input tidak penting)", () => {
  const s = summarize([at("c", 21, 9, 10), at("a", 19, 5, 10), at("b", 20, 7, 10)])!;
  assert.deepEqual(
    { count: s.count, best: s.best, average: s.average, last: s.last, previous: s.previous },
    { count: 3, best: 90, average: 70, last: 90, previous: 70 },
  );
  assert.equal(trendOf(s), "naik");
});

test("'ulangi yang salah' tidak ikut terbaik, rata-rata, dan tren, tapi tetap dihitung sebagai percobaan", () => {
  const s = summarize([
    at("a", 19, 6, 10),
    at("b", 20, 10, 10, "ulang_salah"),
    at("c", 21, 7, 10),
  ])!;
  assert.equal(s.count, 3);
  assert.equal(s.best, 70);
  assert.equal(s.last, 70);
  assert.equal(s.previous, 60);
  assert.equal(s.lastAt, "2026-09-21T10:00:00Z");
  assert.equal(summarize([at("x", 20, 5, 5, "ulang_salah")])!.best, null);
  assert.equal(trendOf(summarize([at("x", 20, 5, 5, "ulang_salah")])!), null);
});

test("belum ada percobaan, tren turun dan tetap", () => {
  assert.equal(summarize([]), null);
  assert.equal(trendOf(summarize([at("a", 19, 9, 10), at("b", 20, 5, 10)])!), "turun");
  assert.equal(trendOf(summarize([at("a", 19, 5, 10), at("b", 20, 5, 10)])!), "tetap");
  assert.equal(trendOf(summarize([at("a", 19, 5, 10)])!), null); // baru satu
});

test("persen dan durasi", () => {
  assert.equal(pct({ score: 2, total: 3 }), 67);
  assert.equal(fmtSeconds(45), "45 dtk");
  assert.equal(fmtSeconds(120), "2 mnt");
  assert.equal(fmtSeconds(150), "2 mnt 30 dtk");
  assert.equal(fmtSeconds(null), "");
});

test("soal yang salah dibaca dengan aman", () => {
  assert.deepEqual(readWrong(null), []);
  assert.deepEqual(readWrong("x"), []);
  const r = readWrong([
    { question: "Q1", answer: "A", picked: "B", explanation: "e" },
    { question: "Q2", answer: "A" },
    { salah: 1 },
    null,
    5,
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[1], { question: "Q2", answer: "A", picked: "", explanation: "" });
});

const q = (n: number, answerIndex: number) => ({
  question: `Soal ${n}`,
  options: ["A", "B", "C", "D"],
  answerIndex,
  explanation: `Penjelasan ${n}`,
});

test("payload latihan: semua soal disimpan beserta pilihan, dan yang salah diturunkan darinya", () => {
  const p = buildAttemptPayload([
    { q: q(1, 0), pickedIndex: 0 }, // benar
    { q: q(2, 2), pickedIndex: 1 }, // salah
    { q: q(3, 3), pickedIndex: 3 }, // benar
  ]);
  assert.equal(p.total, 3);
  assert.equal(p.score, 2);
  assert.equal(p.review.length, 3);
  assert.equal(p.wrong.length, 1);
  assert.deepEqual(p.wrong[0], {
    question: "Soal 2",
    answer: "C",
    picked: "B",
    explanation: "Penjelasan 2",
  });
  assert.deepEqual(p.review.map(isCorrect), [true, false, true]);
});

test("tinjau ulang: dibaca dari database dengan aman, entri rusak dilewati", () => {
  const good = {
    question: "Q",
    options: ["a", "b", "c"],
    answerIndex: 1,
    pickedIndex: 2,
    explanation: "e",
  };
  const r = readReview([
    good,
    { ...good, answerIndex: 9 },
    { ...good, options: ["a"] },
    { ...good, pickedIndex: "1" },
    { question: "x" },
    null,
    3,
  ]);
  assert.equal(r.length, 1);
  assert.equal(isCorrect(r[0]!), false);
  assert.deepEqual(readReview(null), []);
  assert.deepEqual(readReview("x"), []);
  // hasil buildAttemptPayload selalu terbaca kembali utuh
  const back = readReview(buildAttemptPayload([{ q: q(1, 2), pickedIndex: 0 }]).review);
  assert.equal(back.length, 1);
  assert.equal(back[0]!.pickedIndex, 0);
});
