// Rangkuman siap ujian: soal yang sering salah dan versi teks (Markdown) untuk disalin ke Notion. Murni, tanpa jaringan.
import { hashQuestion } from "./spaced.ts";
import { isCorrect, readReview, readWrong } from "./quiz-history.ts";

export type Mistake = {
  question: string;
  answer: string;
  explanation: string;
  count: number;
  lastAt: string;
};

type AttemptRow = { wrong: unknown; review: unknown; created_at: string };

// Soal yang paling sering salah di semua latihan (soal yang sama dihitung satu, walau redaksinya sedikit berbeda huruf besar atau tanda baca).
export function frequentMistakes(attempts: AttemptRow[], limit = 15): Mistake[] {
  const map = new Map<string, Mistake>();
  const add = (question: string, answer: string, explanation: string, at: string) => {
    const key = hashQuestion(question);
    const cur = map.get(key);
    if (cur) {
      cur.count++;
      if (at > cur.lastAt) {
        cur.lastAt = at;
        cur.explanation = explanation || cur.explanation;
      }
    } else map.set(key, { question, answer, explanation, count: 1, lastAt: at });
  };
  for (const a of attempts) {
    const review = readReview(a.review);
    if (review.length > 0) {
      for (const r of review)
        if (!isCorrect(r))
          add(r.question, r.options[r.answerIndex] ?? "", r.explanation, a.created_at);
    } else {
      for (const w of readWrong(a.wrong)) add(w.question, w.answer, w.explanation, a.created_at); // riwayat lama: hanya soal yang salah
    }
  }
  return [...map.values()]
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
    .slice(0, limit);
}

export type SummaryMaterial = {
  id: string;
  name: string;
  notes: string;
  points: { heading: string; summary: string; page: number | null }[];
};

export function summaryMarkdown(input: {
  title: string;
  dateText: string;
  materials: SummaryMaterial[];
  mistakes: Mistake[];
}): string {
  const lines: string[] = [`# ${input.title}`, `_Dibuat ${input.dateText} dari Moo Study_`, ""];
  input.materials.forEach((m, i) => {
    lines.push(`## ${i + 1}. ${m.name}`, "");
    if (m.points.length === 0)
      lines.push("_Belum ada poin materi (buat dulu di ruang belajar)._", "");
    m.points.forEach((p, j) =>
      lines.push(
        `${j + 1}. **${p.heading}**${p.page ? ` (hlm ${p.page})` : ""}`,
        `   ${p.summary}`,
      ),
    );
    if (m.points.length) lines.push("");
    if (m.notes.trim()) lines.push("**Catatanku:**", "", m.notes.trim(), "");
  });
  if (input.mistakes.length) {
    lines.push("## Soal yang sering salah", "");
    input.mistakes.forEach((x, i) => {
      lines.push(`${i + 1}. **${x.question}** (salah ${x.count}x)`, `   - Jawaban: ${x.answer}`);
      if (x.explanation) lines.push(`   - Penjelasan: ${x.explanation}`);
    });
    lines.push("");
  }
  return lines.join("\n");
}
