import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { QuizRunner, type RunAnswer } from "@/components/quiz-runner";
import { PaperCard, StudyShell } from "@/components/study-shell";
import {
  applyCardResults,
  cardQuestion,
  useCardTotals,
  useDueCards,
  type ReviewCard,
} from "@/hooks/use-spaced";
import { useSession } from "@/hooks/use-session";
import { INTERVAL_DAYS, SESSION_SIZE, pickSession } from "@/lib/spaced";
import type { QuizQuestion } from "@/lib/study-ai";

export const Route = createFileRoute("/belajar/ulang")({
  head: () => ({
    meta: [
      { title: "Ulang berjarak — Moo Study" },
      { name: "description", content: "Soal yang pernah salah muncul lagi tepat sebelum lupa." },
      { property: "og:title", content: "Ulang berjarak — Moo Study" },
      {
        property: "og:description",
        content: "Soal yang pernah salah muncul lagi tepat sebelum lupa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UlangPage,
});

type Session = {
  cards: ReviewCard[];
  questions: QuizQuestion[];
  byQuestion: Map<QuizQuestion, ReviewCard>;
};
type Done = { correct: number; wrong: number };

function UlangPage() {
  const { loading, userId } = useSession();
  const qc = useQueryClient();
  const due = useDueCards(userId);
  const totals = useCardTotals(userId);
  const [session, setSession] = useState<Session | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  const now = useMemo(() => new Date(), [due.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const batch = useMemo(() => pickSession(due.data ?? [], now), [due.data, now]);

  const start = () => {
    const byQuestion = new Map<QuizQuestion, ReviewCard>();
    const cards: ReviewCard[] = [];
    for (const c of batch) {
      const q = cardQuestion(c);
      if (q) {
        byQuestion.set(q, c);
        cards.push(c);
      }
    }
    if (cards.length === 0) return void toast.error("Kartunya tidak bisa dibaca. Coba lagi nanti.");
    setDone(null);
    setSession({ cards, questions: [...byQuestion.keys()], byQuestion });
  };

  const finish = async (answers: RunAnswer[]) => {
    if (!session) return;
    const results = answers.flatMap((a) => {
      const card = session.byQuestion.get(a.q);
      return card ? [{ card, correct: a.pickedIndex === a.q.answerIndex }] : [];
    });
    setSession(null);
    setDone({
      correct: results.filter((r) => r.correct).length,
      wrong: results.filter((r) => !r.correct).length,
    });
    try {
      await applyCardResults(results);
    } catch (e) {
      toast.error(`Hasilnya belum tersimpan: ${e instanceof Error ? e.message : "gagal"}`);
    }
    await Promise.all(
      ["due-count", "due-cards", "card-totals"].map((k) => qc.invalidateQueries({ queryKey: [k] })),
    );
  };

  const dueCount = due.data?.length ?? 0;
  const next = totals.data?.nextDue
    ? new Date(totals.data.nextDue).toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <StudyShell title="Ulang berjarak" kicker="Biar nggak lupa">
      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">Masuk dulu ya</h2>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : session ? (
        <PaperCard className="mx-auto max-w-2xl">
          <QuizRunner
            key={session.cards[0]?.id}
            questions={session.questions}
            onFinish={(a) => void finish(a)}
            onExit={() => setSession(null)}
            exitHint="Kartu yang belum selesai tidak diubah"
          />
        </PaperCard>
      ) : (
        <div className="mx-auto grid max-w-2xl gap-5">
          {done && (
            <PaperCard className="text-center">
              <p className="font-display text-5xl font-bold">
                {done.correct}/{done.correct + done.wrong}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {done.wrong === 0
                  ? "Semua benar. Kartu-kartunya naik kotak, jaraknya makin jauh."
                  : `${done.correct} kartu naik kotak, ${done.wrong} kembali ke kotak 1 dan muncul lagi besok.`}
              </p>
            </PaperCard>
          )}

          <PaperCard>
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-bold">
                  {due.isLoading
                    ? "Memuat kartu…"
                    : dueCount > 0
                      ? `${dueCount} kartu jatuh tempo`
                      : "Tidak ada kartu hari ini"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {dueCount > 0
                    ? `Dikerjakan ${Math.min(dueCount, SESSION_SIZE)} kartu per sesi, yang kotaknya paling rendah dulu.`
                    : next
                      ? `Kartu berikutnya jatuh tempo ${next}.`
                      : "Soal yang salah waktu latihan otomatis jadi kartu di sini."}
                </p>
              </div>
            </div>
            {dueCount > 0 && (
              <Button className="mt-4" onClick={start}>
                <RotateCcw /> Mulai ({Math.min(dueCount, SESSION_SIZE)} kartu)
              </Button>
            )}
            {due.isError && (
              <p className="mt-3 text-sm text-destructive">
                Gagal memuat kartu: {due.error.message}
              </p>
            )}
          </PaperCard>

          <PaperCard>
            <h3 className="font-display text-xl font-bold">Cara kerjanya</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Soal yang kamu jawab salah waktu latihan jadi kartu. Kalau benar di sesi ulang,
              kartunya naik kotak dan muncul lagi makin jarang ({INTERVAL_DAYS.join(", ")} hari).
              Kalau salah, kembali ke kotak 1 dan muncul besok.
            </p>
            {totals.data && totals.data.total > 0 && (
              <p className="mt-3 text-sm">
                <span className="font-semibold">{totals.data.total}</span> kartu,{" "}
                <span className="font-semibold">{totals.data.mastered}</span> sudah di kotak 4 ke
                atas.
              </p>
            )}
            <Button asChild variant="outline" className="mt-4">
              <Link to="/belajar">Ke ruang belajar</Link>
            </Button>
          </PaperCard>
        </div>
      )}
    </StudyShell>
  );
}
