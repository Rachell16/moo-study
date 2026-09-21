// Kartu hafalan berjarak (sistem kotak Leitner). Murni, tanpa jaringan.
// Soal yang salah masuk kotak 1 dan muncul lagi besok; tiap jawaban benar naik kotak (jarak makin jauh), jawaban salah kembali ke kotak 1.
import type { QuizQuestion } from "./study-ai.ts";

export const INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;
export const MAX_BOX = INTERVAL_DAYS.length;
export const SESSION_SIZE = 15;

export type CardCounts = { box: number; correct_count: number; wrong_count: number };
export type CardState = CardCounts & { due_at: string; last_reviewed_at: string };

// Sidik jari soal (huruf besar-kecil, spasi, dan tanda baca diabaikan), supaya soal yang sama tidak jadi dua kartu.
export function hashQuestion(text: string): string {
  const norm = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `${h.toString(16).padStart(8, "0")}-${norm.length}`;
}

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

export function nextState(prev: CardCounts | null, correct: boolean, now: Date): CardState {
  const box = correct ? Math.min((prev?.box ?? 0) + 1, MAX_BOX) : 1;
  return {
    box: Math.max(box, 1),
    due_at: addDays(now, INTERVAL_DAYS[Math.max(box, 1) - 1]!).toISOString(),
    correct_count: (prev?.correct_count ?? 0) + (correct ? 1 : 0),
    wrong_count: (prev?.wrong_count ?? 0) + (correct ? 0 : 1),
    last_reviewed_at: now.toISOString(),
  };
}

// Batas "jatuh tempo hari ini": akhir hari ini, supaya kartu yang jatuh tempo malam nanti sudah bisa dikerjakan pagi ini.
export const endOfToday = (now: Date) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
export const isDue = (c: { due_at: string }, now: Date) => new Date(c.due_at) < endOfToday(now);

export function pickSession<T extends { box: number; due_at: string }>(
  cards: T[],
  now: Date,
  max = SESSION_SIZE,
): T[] {
  return cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => a.box - b.box || a.due_at.localeCompare(b.due_at))
    .slice(0, max);
}

type Answer = { q: QuizQuestion; pickedIndex: number };

// Hasil satu latihan jadi pembaruan kartu: soal yang salah selalu masuk (atau kembali ke kotak 1);
// soal yang benar hanya memperbarui kartu yang sudah ada (naik kotak), tidak membuat kartu baru.
export function planCardUpdates(
  answers: Answer[],
  existing: ReadonlyMap<string, CardCounts>,
  now: Date,
) {
  const out = new Map<string, { qhash: string; question: QuizQuestion; state: CardState }>();
  for (const { q, pickedIndex } of answers) {
    const qhash = hashQuestion(q.question);
    const prev = existing.get(qhash) ?? null;
    const correct = pickedIndex === q.answerIndex;
    if (!prev && correct) continue;
    out.set(qhash, { qhash, question: q, state: nextState(prev, correct, now) });
  }
  return [...out.values()];
}
