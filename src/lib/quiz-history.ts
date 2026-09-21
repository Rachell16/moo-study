// Riwayat latihan soal: membaca, meringkas, dan memformat. Tanpa akses jaringan, jadi bisa dites langsung di Node.

export type WrongItem = { question: string; answer: string; picked: string; explanation: string };

export type AttemptLike = {
  id: string;
  score: number;
  total: number;
  mode: string;
  duration_seconds: number | null;
  wrong: unknown;
  created_at: string;
};

export const MODE_LABEL: Record<string, string> = {
  acak10: "10 soal acak",
  acak20: "20 soal acak",
  semua: "Semua soal",
  ulang_salah: "Ulangi yang salah",
  ulang_set: "Kerjakan ulang set yang sama",
};

export const pct = (a: Pick<AttemptLike, "score" | "total">) =>
  Math.round((a.score / a.total) * 100);

// Isi kolom `wrong` dari database dibaca dengan aman; entri yang rusak dilewati.
export function readWrong(value: unknown): WrongItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const o = v as Record<string, unknown>;
    if (typeof o["question"] !== "string" || typeof o["answer"] !== "string") return [];
    return [
      {
        question: o["question"],
        answer: o["answer"],
        picked: typeof o["picked"] === "string" ? o["picked"] : "",
        explanation: typeof o["explanation"] === "string" ? o["explanation"] : "",
      },
    ];
  });
}

export type Summary = {
  count: number; // semua percobaan
  best: number | null; // persen, dari latihan penuh
  average: number | null;
  last: number | null; // persen latihan penuh terakhir
  previous: number | null;
  lastAt: string; // waktu percobaan terakhir (apa pun modenya)
};

// "Ulangi yang salah" hanya berisi soal yang tadi keliru, jadi skornya tidak sebanding dan tidak dihitung untuk terbaik, rata-rata, dan tren.
export function summarize(attempts: AttemptLike[]): Summary | null {
  if (attempts.length === 0) return null;
  const sorted = [...attempts].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const full = sorted.filter((a) => a.mode !== "ulang_salah").map(pct);
  return {
    count: sorted.length,
    best: full.length ? Math.max(...full) : null,
    average: full.length ? Math.round(full.reduce((s, n) => s + n, 0) / full.length) : null,
    last: full.at(-1) ?? null,
    previous: full.length > 1 ? full.at(-2)! : null,
    lastAt: sorted.at(-1)!.created_at,
  };
}

export function trendOf(s: Summary): "naik" | "turun" | "tetap" | null {
  if (s.last === null || s.previous === null) return null;
  return s.last > s.previous ? "naik" : s.last < s.previous ? "turun" : "tetap";
}

export function fmtSeconds(seconds: number | null) {
  if (seconds === null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m === 0 ? `${s} dtk` : s === 0 ? `${m} mnt` : `${m} mnt ${s} dtk`;
}

// ---- tinjau ulang: semua soal dalam satu latihan, lengkap dengan pilihanmu ----
export type ReviewItem = {
  question: string;
  options: string[];
  answerIndex: number; // indeks jawaban benar di `options`
  pickedIndex: number; // indeks pilihanmu di `options`
  explanation: string;
};

export const isCorrect = (r: ReviewItem) => r.pickedIndex === r.answerIndex;

// Isi kolom `review` dari database dibaca dengan aman; entri yang rusak dilewati.
export function readReview(value: unknown): ReviewItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((v) => {
    if (!v || typeof v !== "object") return [];
    const o = v as Record<string, unknown>;
    const options = o["options"];
    const a = o["answerIndex"];
    const p = o["pickedIndex"];
    if (
      typeof o["question"] !== "string" ||
      !Array.isArray(options) ||
      options.length < 2 ||
      !options.every((x) => typeof x === "string")
    )
      return [];
    if (!Number.isInteger(a) || !Number.isInteger(p)) return [];
    const ai = a as number;
    const pi = p as number;
    if (ai < 0 || ai >= options.length || pi < 0 || pi >= options.length) return [];
    return [
      {
        question: o["question"],
        options: options as string[],
        answerIndex: ai,
        pickedIndex: pi,
        explanation: typeof o["explanation"] === "string" ? o["explanation"] : "",
      },
    ];
  });
}

// Bentuk yang disimpan ke database untuk satu latihan.
export function buildAttemptPayload(
  answers: {
    q: { question: string; options: string[]; answerIndex: number; explanation: string };
    pickedIndex: number;
  }[],
) {
  const review: ReviewItem[] = answers.map(({ q, pickedIndex }) => ({
    question: q.question,
    options: q.options,
    answerIndex: q.answerIndex,
    pickedIndex,
    explanation: q.explanation,
  }));
  const wrong: WrongItem[] = review
    .filter((r) => !isCorrect(r))
    .map((r) => ({
      question: r.question,
      answer: r.options[r.answerIndex] ?? "",
      picked: r.options[r.pickedIndex] ?? "",
      explanation: r.explanation,
    }));
  return { score: review.length - wrong.length, total: review.length, review, wrong };
}
