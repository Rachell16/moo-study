import { ChevronDown, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { QuizAttempt } from "@/hooks/use-quiz-history";
import { MODE_LABEL, fmtSeconds, pct, readWrong, summarize, trendOf } from "@/lib/quiz-history";
import { fmtTime } from "@/lib/schedule-utils";

const dateText = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}, ${fmtTime(d)}`;
};

// Riwayat latihan soal satu materi: ringkasan, grafik kecil, dan daftar percobaan beserta soal yang salah.
export function QuizHistory({ attempts }: { attempts: QuizAttempt[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const summary = useMemo(() => summarize(attempts), [attempts]);

  if (!summary) {
    return (
      <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
        Belum ada riwayat. Selesaikan satu latihan, hasilnya tersimpan di sini.
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
            `Turun ${summary.previous - summary.last}% dari latihan sebelumnya. Ulas poin yang ragu, lalu coba lagi.`}
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
          const wrong = readWrong(a.wrong);
          const isOpen = open === a.id;
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
                {wrong.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : a.id)}
                  >
                    {wrong.length} salah <ChevronDown className={isOpen ? "rotate-180" : ""} />
                  </Button>
                )}
              </div>
              {isOpen && (
                <ol className="mt-3 grid gap-3 border-t border-border pt-3">
                  {wrong.map((w, i) => (
                    <li key={i} className="text-sm">
                      <p className="font-semibold">{w.question}</p>
                      {w.picked && <p className="text-destructive">Jawabanmu: {w.picked}</p>}
                      <p className="text-primary">Yang benar: {w.answer}</p>
                      {w.explanation && (
                        <p className="mt-0.5 text-muted-foreground">{w.explanation}</p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
