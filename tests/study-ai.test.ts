import test from "node:test";
import assert from "node:assert/strict";
import { AiParseError, parseOutline, parseQuiz, readStoredQuiz } from "../src/lib/study-ai.ts";

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
