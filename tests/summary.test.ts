import test from "node:test";
import assert from "node:assert/strict";
import { frequentMistakes, summaryMarkdown } from "../src/lib/summary.ts";

const rv = (question: string, answerIndex: number, pickedIndex: number, explanation = "e") => ({
  question,
  options: ["a", "b", "c"],
  answerIndex,
  pickedIndex,
  explanation,
});
const at = (day: number) => `2026-09-${String(day).padStart(2, "0")}T10:00:00Z`;

test("soal yang paling sering salah diurutkan, soal sama dengan redaksi beda dihitung satu", () => {
  const m = frequentMistakes([
    {
      review: [rv("Apa itu piksel?", 0, 1), rv("Soal benar", 0, 0), rv("Apa itu histogram?", 2, 0)],
      wrong: [],
      created_at: at(19),
    },
    {
      review: [rv("apa itu PIKSEL", 0, 2, "penjelasan baru"), rv("Apa itu histogram?", 2, 2)],
      wrong: [],
      created_at: at(20),
    },
    {
      review: [],
      wrong: [{ question: "Soal lama", answer: "Jawab lama", picked: "x", explanation: "" }],
      created_at: at(18),
    },
  ]);
  assert.deepEqual(
    m.map((x) => [x.question, x.count]),
    [
      ["Apa itu piksel?", 2],
      ["Apa itu histogram?", 1],
      ["Soal lama", 1],
    ],
  );
  assert.equal(m[0]!.answer, "a");
  assert.equal(m[0]!.explanation, "penjelasan baru"); // penjelasan dari percobaan terbaru
  assert.equal(
    m.some((x) => x.question === "Soal benar"),
    false,
  );
  assert.equal(frequentMistakes([], 5).length, 0);
  assert.equal(
    frequentMistakes(
      [{ review: [rv("A", 0, 1), rv("B", 0, 1), rv("C", 0, 1)], wrong: [], created_at: at(1) }],
      2,
    ).length,
    2,
  ); // batas jumlah
});

test("Markdown rangkuman: poin, catatan, dan soal yang sering salah", () => {
  const md = summaryMarkdown({
    title: "Rangkuman UTS: Visi Komputer",
    dateText: "21 September 2026",
    materials: [
      {
        id: "1",
        name: "Kuliah 01",
        notes: "  Ingat rumus  ",
        points: [
          { heading: "Piksel", summary: "Unit terkecil citra.", page: 3 },
          { heading: "Kanal", summary: "R, G, B.", page: null },
        ],
      },
      { id: "2", name: "Kuliah 02", notes: "", points: [] },
    ],
    mistakes: [
      {
        question: "Apa itu piksel?",
        answer: "Unit terkecil",
        explanation: "Dasar citra.",
        count: 2,
        lastAt: at(20),
      },
    ],
  });
  assert.match(md, /^# Rangkuman UTS: Visi Komputer\n_Dibuat 21 September 2026 dari Moo Study_/);
  assert.match(
    md,
    /## 1\. Kuliah 01\n\n1\. \*\*Piksel\*\* \(hlm 3\)\n   Unit terkecil citra\.\n2\. \*\*Kanal\*\*\n   R, G, B\./,
  );
  assert.match(md, /\*\*Catatanku:\*\*\n\nIngat rumus\n/);
  assert.match(md, /## 2\. Kuliah 02\n\n_Belum ada poin materi/);
  assert.match(
    md,
    /## Soal yang sering salah\n\n1\. \*\*Apa itu piksel\?\*\* \(salah 2x\)\n   - Jawaban: Unit terkecil\n   - Penjelasan: Dasar citra\./,
  );
});
