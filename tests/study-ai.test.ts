import test from "node:test";
import assert from "node:assert/strict";
import {
  AiParseError,
  COMBINED_PROMPT,
  QUIZ_PROMPT,
  parseCombined,
  parseOutline,
  parseQuiz,
  readStoredQuiz,
} from "../src/lib/study-ai.ts";

test("poin materi: JSON polos, dibungkus code fence, dan halaman opsional", () => {
  const raw = JSON.stringify({
    points: [
      { heading: "Apa itu Computer Vision", summary: "Cabang AI yang memahami gambar.", page: 3 },
      { heading: "Piksel", summary: "Unit terkecil citra." },
    ],
  });
  const a = parseOutline(raw);
  assert.equal(a.length, 2);
  assert.deepEqual(a[0], {
    heading: "Apa itu Computer Vision",
    summary: "Cabang AI yang memahami gambar.",
    page: 3,
  });
  assert.equal(a[1]!.page, null);

  const b = parseOutline("```json\n" + raw + "\n```");
  assert.equal(b.length, 2);
  const c = parseOutline("Tentu, ini hasilnya:\n" + raw + "\nSemoga membantu!");
  assert.equal(c.length, 2);
});

test("poin materi: jawaban rusak memberi pesan yang jelas", () => {
  assert.throws(() => parseOutline("maaf saya tidak bisa"), AiParseError);
  assert.throws(() => parseOutline(JSON.stringify({ points: [] })), AiParseError);
  assert.throws(
    () => parseOutline(JSON.stringify({ points: [{ heading: "", summary: "x" }] })),
    AiParseError,
  );
});

test("soal latihan: soal rusak dilewati, yang benar tetap dipakai", () => {
  const raw = JSON.stringify({
    questions: [
      {
        question: "Apa itu piksel?",
        options: ["A", "B", "C", "D"],
        answerIndex: 1,
        explanation: "Unit terkecil.",
      },
      { question: "Jawaban di luar opsi", options: ["A", "B"], answerIndex: 5, explanation: "" },
      { question: "", options: ["A", "B"], answerIndex: 0 },
      { question: "Tanpa penjelasan", options: ["Ya", "Tidak"], answerIndex: 0 },
    ],
  });
  const q = parseQuiz(raw);
  assert.equal(q.length, 2);
  assert.equal(q[0]!.answerIndex, 1);
  assert.equal(q[1]!.explanation, "");
  assert.throws(
    () =>
      parseQuiz(JSON.stringify({ questions: [{ question: "x", options: ["a"], answerIndex: 0 }] })),
    AiParseError,
  );
});

test("soal dari database dibaca dengan aman", () => {
  assert.deepEqual(readStoredQuiz(null), []);
  assert.deepEqual(readStoredQuiz("bukan array"), []);
  assert.equal(
    readStoredQuiz([
      { question: "Q", options: ["a", "b"], answerIndex: 1, explanation: "e" },
      { salah: true },
    ]).length,
    1,
  );
});

test("permintaan gabungan: poin dan soal dalam satu jawaban", () => {
  const raw = JSON.stringify({
    points: [{ heading: "Histogram", summary: "Grafik sebaran intensitas.", page: 2 }],
    questions: Array.from({ length: 20 }, (_, i) => ({
      question: `Soal ${i + 1}`,
      options: ["A", "B", "C", "D"],
      answerIndex: i % 4,
      explanation: "e",
    })),
  });
  const r = parseCombined(raw);
  assert.equal(r.points.length, 1);
  assert.equal(r.questions?.length, 20); // 20 soal tidak lagi dipotong jadi 12
});

test("permintaan gabungan: soal rusak tidak menggagalkan poin, poin rusak menggagalkan semuanya", () => {
  const onlyPoints = JSON.stringify({
    points: [{ heading: "H", summary: "S" }],
    questions: "rusak",
  });
  const r = parseCombined(onlyPoints);
  assert.equal(r.points.length, 1);
  assert.equal(r.questions, null);
  assert.throws(
    () =>
      parseCombined(
        JSON.stringify({ questions: [{ question: "Q", options: ["a", "b"], answerIndex: 0 }] }),
      ),
    AiParseError,
  );
});

test("prompt meminta soal banyak (15 sampai 30), bukan 6 sampai 8", () => {
  for (const p of [QUIZ_PROMPT, COMBINED_PROMPT]) {
    assert.match(p, /minimal 15 dan maksimal 30 soal/);
    assert.doesNotMatch(p, /6 sampai 8 soal/);
  }
});
