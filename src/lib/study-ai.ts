// Perintah (prompt) dan pembaca jawaban AI untuk ruang belajar. Tanpa akses jaringan, jadi bisa dites langsung di Node.
import { z } from "zod";

export const SYSTEM_PROMPT =
  "Kamu asisten belajar untuk mahasiswa Indonesia. Jelaskan dengan bahasa Indonesia yang jelas dan ringkas. " +
  "Hanya gunakan isi materi yang diberikan; jangan mengarang fakta yang tidak ada di dalamnya.";

export const OUTLINE_PROMPT =
  "Baca materi kuliah (PDF) ini, lalu pecah menjadi 6 sampai 15 poin belajar yang berurutan sesuai alur materi. " +
  "Untuk tiap poin isi: heading (judul singkat, maksimal 80 karakter), summary (penjelasan 2 sampai 4 kalimat yang mudah dipahami; " +
  "sebutkan istilah kunci, dan rumus atau contoh singkat kalau ada), page (nomor halaman atau slide tempat poin itu dibahas, atau null kalau tidak jelas). " +
  'Balas hanya dengan JSON persis seperti ini: {"points":[{"heading":"...","summary":"...","page":3}]}';

const QUIZ_RULES =
  "Soal pilihan ganda: buat sebanyak yang wajar untuk materi ini, minimal 15 dan maksimal 30 soal (makin panjang dan padat materinya, makin banyak soalnya). " +
  "Sebar soal merata ke seluruh bagian materi, campur tingkat kesulitan (mudah, sedang, sulit), dan hindari soal yang kembar atau hafalan sepele. " +
  "Setiap soal punya tepat 4 opsi dengan satu jawaban benar, dan penjelasan singkat kenapa jawaban itu benar.";

export const QUIZ_PROMPT =
  "Baca materi kuliah (PDF) ini. " +
  QUIZ_RULES +
  ' Balas hanya dengan JSON persis seperti ini: {"questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}]}';

// Poin materi dan soal latihan dalam satu permintaan, supaya hemat jatah harian.
export const COMBINED_PROMPT =
  "Baca materi kuliah (PDF) ini, lalu kerjakan dua hal sekaligus. " +
  "(1) Pecah materi menjadi 6 sampai 15 poin belajar yang berurutan sesuai alur materi. Tiap poin: heading (judul singkat, maksimal 80 karakter), " +
  "summary (penjelasan 2 sampai 4 kalimat yang mudah dipahami; sebutkan istilah kunci, dan rumus atau contoh singkat kalau ada), " +
  "page (nomor halaman atau slide tempat poin itu dibahas, atau null kalau tidak jelas). " +
  "(2) " +
  QUIZ_RULES +
  ' Balas hanya dengan JSON persis seperti ini: {"points":[{"heading":"...","summary":"...","page":3}],"questions":[{"question":"...","options":["A","B","C","D"],"answerIndex":0,"explanation":"..."}]}';

export type OutlinePoint = { heading: string; summary: string; page: number | null };
export type QuizQuestion = {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
};

export class AiParseError extends Error {}

// Jawaban kadang dibungkus ```json ... ```; ambil bagian JSON-nya saja.
export function extractJson(text: string): unknown {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(stripped);
  } catch {
    const a = stripped.indexOf("{");
    const b = stripped.lastIndexOf("}");
    if (a >= 0 && b > a) {
      try {
        return JSON.parse(stripped.slice(a, b + 1));
      } catch {
        /* jatuh ke error di bawah */
      }
    }
    throw new AiParseError("Jawaban AI tidak bisa dibaca. Coba lagi.");
  }
}

const point = z.object({
  heading: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  page: z.number().int().positive().nullable().optional(),
});

export function parseOutline(text: string): OutlinePoint[] {
  const parsed = z.object({ points: z.array(point).min(1) }).safeParse(extractJson(text));
  if (!parsed.success)
    throw new AiParseError("AI tidak menghasilkan poin yang bisa dipakai. Coba lagi.");
  return parsed.data.points.slice(0, 30).map((p) => ({
    heading: p.heading.slice(0, 120),
    summary: p.summary.slice(0, 1500),
    page: p.page ?? null,
  }));
}

const question = z
  .object({
    question: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(2).max(5),
    answerIndex: z.number().int().min(0),
    explanation: z.string().trim().default(""),
  })
  .refine((q) => q.answerIndex < q.options.length, "jawaban di luar opsi");

export function parseQuiz(text: string): QuizQuestion[] {
  const parsed = z.object({ questions: z.array(z.unknown()).min(1) }).safeParse(extractJson(text));
  if (!parsed.success)
    throw new AiParseError("AI tidak menghasilkan soal yang bisa dipakai. Coba lagi.");
  // soal yang rusak dilewati, yang baik tetap dipakai
  const good = parsed.data.questions.flatMap((q) => {
    const r = question.safeParse(q);
    return r.success
      ? [
          {
            ...r.data,
            question: r.data.question.slice(0, 600),
            explanation: r.data.explanation.slice(0, 800),
          },
        ]
      : [];
  });
  if (!good.length)
    throw new AiParseError("AI tidak menghasilkan soal yang bisa dipakai. Coba lagi.");
  return good.slice(0, 40);
}

// Soal tersimpan sebagai JSON di database; periksa bentuknya sebelum dipakai di layar.
export function readStoredQuiz(value: unknown): QuizQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((q) => {
    const r = question.safeParse(q);
    return r.success ? [r.data] : [];
  });
}

// Hasil permintaan gabungan: poin wajib ada; soal yang rusak tidak menggagalkan poin (soal bisa dibuat terpisah).
export function parseCombined(text: string): {
  points: OutlinePoint[];
  questions: QuizQuestion[] | null;
} {
  const json = extractJson(text);
  const points = parseOutline(JSON.stringify(json));
  let questions: QuizQuestion[] | null = null;
  try {
    questions = parseQuiz(JSON.stringify(json));
  } catch {
    questions = null;
  }
  return { points, questions };
}
