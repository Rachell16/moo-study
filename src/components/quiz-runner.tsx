import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuizQuestion } from "@/lib/study-ai";

export type RunAnswer = { q: QuizQuestion; pickedIndex: number };
type Item = { q: QuizQuestion; order: number[] }; // order: urutan tampil opsi (diacak)

export const shuffle = <T,>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

const makeItems = (list: QuizQuestion[]): Item[] =>
  shuffle(list).map((q) => ({ q, order: shuffle(q.options.map((_, i) => i)) }));

// Mengerjakan satu rangkaian soal: pilih jawaban (bisa diganti), periksa, lihat penjelasan, lanjut.
// Dipakai latihan soal materi dan sesi kartu berjarak. Hasilnya diserahkan lewat onFinish.
export function QuizRunner({
  questions,
  onFinish,
  onExit,
  exitHint = "Latihan yang belum selesai tidak dicatat",
}: {
  questions: QuizQuestion[];
  onFinish: (answers: RunAnswer[]) => void;
  onExit: () => void;
  exitHint?: string;
}) {
  const [items] = useState(() => makeItems(questions)); // diacak sekali saat mulai
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // opsi yang sedang dipilih (indeks asli), masih bisa diganti
  const [revealed, setRevealed] = useState(false); // jawaban baru terlihat setelah "Periksa jawaban"
  const [answers, setAnswers] = useState<RunAnswer[]>([]);

  const item = items[index]!;
  const correct = item.q.answerIndex;
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-muted-foreground">
          Soal {index + 1} dari {items.length}
        </p>
        <Button size="sm" variant="ghost" onClick={onExit} title={exitHint}>
          Selesai
        </Button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      <p className="font-display text-xl font-bold leading-snug">{item.q.question}</p>
      <div className="grid gap-2" role="group" aria-label="Pilihan jawaban">
        {item.order.map((optIndex, shown) => {
          const right = optIndex === correct;
          const chosen = optIndex === picked;
          const state = !revealed
            ? chosen
              ? "border-primary bg-secondary ring-2 ring-primary/40"
              : "border-border bg-background hover:bg-secondary"
            : right
              ? "border-primary bg-secondary"
              : chosen
                ? "border-destructive bg-destructive/10"
                : "border-border bg-background opacity-70";
          return (
            <button
              key={optIndex}
              type="button"
              disabled={revealed}
              aria-pressed={!revealed && chosen}
              onClick={() => setPicked(optIndex)}
              className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm ${state}`}
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">
                {String.fromCharCode(65 + shown)}
              </span>
              <span className="min-w-0 flex-1">{item.q.options[optIndex]}</span>
            </button>
          );
        })}
      </div>
      {!revealed && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="w-fit"
            disabled={picked === null}
            onClick={() => {
              if (picked === null) return;
              setRevealed(true);
              setAnswers((a) => [...a, { q: item.q, pickedIndex: picked }]);
            }}
          >
            Periksa jawaban
          </Button>
          <p className="text-xs text-muted-foreground">
            {picked === null
              ? "Pilih satu jawaban dulu."
              : "Kamu masih bisa mengganti pilihan sebelum memeriksa."}
          </p>
        </div>
      )}
      {revealed && (
        <div className="rounded-md bg-secondary/70 p-3 text-sm">
          <p className="font-semibold">
            {picked === correct
              ? "Benar!"
              : `Kurang tepat. Jawaban yang benar: ${String.fromCharCode(65 + item.order.indexOf(correct))}.`}
          </p>
          {item.q.explanation && <p className="mt-1 leading-relaxed">{item.q.explanation}</p>}
        </div>
      )}
      {revealed && (
        <Button
          className="w-fit"
          onClick={() => {
            if (index + 1 >= items.length) onFinish(answers);
            else {
              setIndex(index + 1);
              setPicked(null);
              setRevealed(false);
            }
          }}
        >
          {index + 1 >= items.length ? "Lihat hasil" : "Soal berikutnya"}
        </Button>
      )}
    </div>
  );
}
