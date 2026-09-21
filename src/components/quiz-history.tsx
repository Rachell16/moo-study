import { ChevronDown, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuizAttempt } from "@/hooks/use-quiz-history";
import {
  MODE_LABEL,
  fmtSeconds,
  isCorrect,
  pct,
  readReview,
  readWrong,
  summarize,
  trendOf,
  type ReviewItem,
} from "@/lib/quiz-history";
import { fmtTime } from "@/lib/schedule-utils";
import type { QuizQuestion } from "@/lib/study-ai";

export type RetakeHandler = (questions: QuizQuestion[], mode: "ulang_set" | "ulang_salah") => void;

const dateText = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}, ${fmtTime(d)}`;
};

const toQuestion = (r: ReviewItem): QuizQuestion => ({
  question: r.question,
  options: r.options,
  answerIndex: r.answerIndex,
  explanation: r.explanation,
});

// Tinjau ulang satu latihan: semua soal, pilihanmu, jawaban benar, dan penjelasannya.
function AttemptReview({
  attempt,
  onRetake,
}: {
  attempt: QuizAttempt;
  onRetake?: RetakeHandler | undefined;
}) {
  const items = useMemo(() => readReview(attempt.review), [attempt.review]);
  const [filter, setFilter] = useState<"semua" | "salah" | "benar">("semua");

  // Latihan yang dicatat sebelum fitur ini hanya punya soal yang salah.
  if (items.length === 0) {
    const legacy = readWrong(attempt.wrong);
    return (
      <div className="mt-3 grid gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">
          Latihan ini dicatat sebelum fitur tinjau ulang, jadi hanya soal yang salah yang tersimpan.
        </p>
        <ol className="grid gap-3">
          {legacy.map((w, i) => (
            <li key={i} className="text-sm">
              <p className="font-semibold">{w.question}</p>
              {w.picked && <p className="text-destructive">Jawabanmu: {w.picked}</p>}
              <p className="text-primary">Yang benar: {w.answer}</p>
              {w.explanation && <p className="mt-0.5 text-muted-foreground">{w.explanation}</p>}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const wrongCount = items.filter((r) => !isCorrect(r)).length;
  const shown = items
    .map((r, i) => ({ r, n: i + 1 }))
    .filter(({ r }) =>
      filter === "semua" ? true : filter === "salah" ? !isCorrect(r) : isCorrect(r),
    );
  const chips: [typeof filter, string][] = [
    ["semua", `Semua (${items.length})`],
    ["salah", `Salah (${wrongCount})`],
    ["benar", `Benar (${items.length - wrongCount})`],
  ];

  return (
    <div className="mt-3 grid gap-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-md bg-muted p-1" role="group" aria-label="Filter soal">
          {chips.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "ghost"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filter === "salah"
            ? "Tidak ada soal yang salah di latihan ini."
            : "Tidak ada soal di kategori ini."}
        </p>
      ) : (
        <ol className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {shown.map(({ r, n }) => (
            <li key={n} className="min-w-0 rounded-md border border-border p-3">
              <div className="flex items-start gap-2">
                <span
                  className={`tag shrink-0 ${isCorrect(r) ? "" : "border-destructive text-destructive"}`}
                >
                  {isCorrect(r) ? `${n} benar` : `${n} salah`}
                </span>
                <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{r.question}</p>
              </div>
              <ul className="mt-2 grid gap-1.5">
                {r.options.map((o, i) => {
                  const right = i === r.answerIndex;
                  const mine = i === r.pickedIndex;
                  return (
                    <li
                      key={i}
                      className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm ${right ? "border-primary bg-secondary" : mine ? "border-destructive bg-destructive/10" : "border-border"}`}
                    >
                      <span className="font-bold">{String.fromCharCode(65 + i)}</span>
                      <span className="min-w-0 flex-1">{o}</span>
                      {right && (
                        <span className="shrink-0 text-xs font-semibold text-primary">benar</span>
                      )}
                      {mine && (
                        <span
                          className={`shrink-0 text-xs font-semibold ${right ? "text-primary" : "text-destructive"}`}
                        >
                          jawabanmu
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
              {r.explanation && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {r.explanation}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {onRetake && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRetake(items.map(toQuestion), "ulang_set")}
          >
            <RotateCcw /> Kerjakan ulang semua soal ini
          </Button>
          {wrongCount > 0 && (
            <Button
              size="sm"
              onClick={() =>
                onRetake(items.filter((r) => !isCorrect(r)).map(toQuestion), "ulang_salah")
              }
            >
              <RotateCcw /> Kerjakan ulang yang salah ({wrongCount})
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Riwayat latihan satu materi: ringkasan, grafik kecil, dan daftar percobaan yang bisa ditinjau ulang.
export function QuizHistory({
  attempts,
  onRetake,
}: {
  attempts: QuizAttempt[];
  onRetake?: RetakeHandler | undefined;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const summary = useMemo(() => summarize(attempts), [attempts]);

  if (!summary) {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        Belum ada riwayat. Selesaikan satu latihan, hasilnya tersimpan di sini dan bisa kamu tinjau
        lagi.
      </p>
    );
  }

  // grafik: latihan penuh, dari yang lama ke yang baru (maksimal 12)
  const bars = attempts
    .filter((a) => a.mode !== "ulang_salah")
    .slice(0, 12)
    .reverse();
  const trend = trendOf(summary);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["Terbaik", summary.best === null ? "-" : `${summary.best}%`],
          ["Rata-rata", summary.average === null ? "-" : `${summary.average}%`],
          ["Percobaan", String(summary.count)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-border bg-background p-2">
            <p className="font-display text-2xl font-bold leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {trend && summary.last !== null && summary.previous !== null && (
        <p className="flex items-center gap-2 text-sm">
          {trend === "naik" ? (
            <TrendingUp className="h-4 w-4 text-primary" />
          ) : trend === "turun" ? (
            <TrendingDown className="h-4 w-4 text-destructive" />
          ) : null}
          {trend === "naik" && `Naik ${summary.last - summary.previous}% dari latihan sebelumnya.`}
          {trend === "turun" &&
            `Turun ${summary.previous - summary.last}% dari latihan sebelumnya. Tinjau soal yang salah, lalu coba lagi.`}
          {trend === "tetap" && "Sama dengan latihan sebelumnya."}
        </p>
      )}

      {bars.length > 1 && (
        <div>
          <div
            className="flex h-20 items-end gap-1.5 rounded-md border border-border bg-background p-2"
            role="img"
            aria-label={`Skor ${bars.length} latihan terakhir: ${bars.map((a) => `${pct(a)}%`).join(", ")}`}
          >
            {bars.map((a) => (
              <div
                key={a.id}
                className="flex h-full flex-1 items-end"
                title={`${dateText(a.created_at)}: ${a.score}/${a.total} (${pct(a)}%)`}
              >
                <div
                  className={`w-full rounded-sm ${pct(a) >= 80 ? "bg-primary" : pct(a) >= 50 ? "bg-accent" : "bg-destructive/70"}`}
                  style={{ height: `${Math.max(pct(a), 4)}%` }}
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Skor latihan penuh terakhir, dari yang lama ke yang baru.
          </p>
        </div>
      )}

      <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
        {attempts.map((a) => {
          const isOpen = open === a.id;
          const wrongCount = a.total - a.score;
          return (
            <li key={a.id} className="min-w-0 rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="font-display text-xl font-bold">
                  {a.score}/{a.total}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                    {pct(a)}%
                  </span>
                </p>
                <div className="min-w-0 flex-1 basis-40 text-sm">
                  <p>{MODE_LABEL[a.mode] ?? a.mode}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateText(a.created_at)}
                    {a.duration_seconds !== null ? `, ${fmtSeconds(a.duration_seconds)}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={isOpen ? "secondary" : "outline"}
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : a.id)}
                >
                  Tinjau{wrongCount > 0 ? ` (${wrongCount} salah)` : ""}{" "}
                  <ChevronDown className={isOpen ? "rotate-180" : ""} />
                </Button>
              </div>
              {isOpen && <AttemptReview attempt={a} onRetake={onRetake} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
