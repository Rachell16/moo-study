import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlanCard } from "@/components/plan-card";
import { AiQuotaLine } from "@/components/room-panels";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { useCourses, useMaterials } from "@/hooks/use-schedules";
import { useQuizSummaries } from "@/hooks/use-quiz-history";
import { useDueCount } from "@/hooks/use-spaced";
import { useAiStatus, usePointProgress } from "@/hooks/use-study";
import { useSession } from "@/hooks/use-session";
import { cleanMaterialName } from "@/lib/study-plan";
import type { Material } from "@/lib/schedule-utils";

export const Route = createFileRoute("/belajar/")({
  head: () => ({
    meta: [
      { title: "Ruang belajar — Moo Study" },
      { name: "description", content: "Rencana belajar harian, poin materi, dan soal latihan." },
      { property: "og:title", content: "Ruang belajar — Moo Study" },
      {
        property: "og:description",
        content: "Rencana belajar harian, poin materi, dan soal latihan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BelajarPage,
});

function BelajarPage() {
  const { loading, userId } = useSession();
  const courses = useCourses(userId);
  const materials = useMaterials(userId);
  const progress = usePointProgress(userId);
  const summaries = useQuizSummaries(userId);
  const dueCount = useDueCount(userId);
  const ai = useAiStatus(userId);

  const all = materials.data ?? [];
  const prog = progress.data;
  const started = (m: Material) => {
    const p = prog?.get(m.id);
    return !!p && p.done > 0 && p.done < p.total;
  };
  const inProgress = all.filter((m) => m.reviewed_at === null && started(m));
  const notStarted = all.filter((m) => m.reviewed_at === null && !started(m));
  const reviewed = all.filter((m) => m.reviewed_at !== null);
  const courseOf = (m: Material) => courses.data?.find((c) => c.id === m.course_id);

  const card = (m: Material) => {
    const c = courseOf(m);
    const p = prog?.get(m.id);
    return (
      <li key={m.id} className="min-w-0">
        <Link
          to="/belajar/$id"
          params={{ id: m.id }}
          className="block h-full rounded-md border border-border bg-background p-3 transition-colors hover:bg-secondary"
        >
          <p className="truncate font-semibold" title={m.name}>
            {cleanMaterialName(m.name)}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {c && <span className={`tag tone-${c.color}`}>{c.code}</span>}
            <span>
              {m.material_type === "praktikum" ? "Praktikum" : "Kuliah"},{" "}
              {m.exam_scope.toUpperCase()}
            </span>
          </p>
          {p ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${(p.done / p.total) * 100}%` }}
                />
              </div>
              <span className="text-xs font-semibold">
                {p.done}/{p.total}
              </span>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Belum dipecah jadi poin</p>
          )}
          {summaries.data?.get(m.id) && (
            <p className="mt-1 text-xs text-muted-foreground">
              Latihan:{" "}
              {summaries.data.get(m.id)!.last !== null
                ? `terakhir ${summaries.data.get(m.id)!.last}%`
                : `${summaries.data.get(m.id)!.count} kali`}
            </p>
          )}
        </Link>
      </li>
    );
  };

  const section = (title: string, list: Material[]) =>
    list.length === 0 ? null : (
      <section className="mt-6">
        <h3 className="mb-3 text-sm font-bold">
          {title} <span className="font-normal text-muted-foreground">({list.length})</span>
        </h3>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map(card)}
        </ul>
      </section>
    );

  return (
    <StudyShell title="Ruang belajar" kicker="Hari ini belajar apa?">
      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">
            Masuk dulu untuk membuka ruang belajar
          </h2>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : (
        <>
          <PlanCard userId={userId} />

          <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PaperCard>
              <p className="section-kicker">Fokus nilai</p>
              <h2 className="font-display text-xl font-bold">Rencana nilai</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Kalkulator nilai per mata kuliah, dan yang paling menentukan buat dipelajari duluan.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/belajar/nilai">Buka kalkulator</Link>
              </Button>
            </PaperCard>
            <PaperCard>
              <p className="section-kicker">Ujian</p>
              <h2 className="font-display text-xl font-bold">Rencana menuju ujian</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Materi dibagi ke hari-hari sebelum UTS atau UAS.
              </p>
              <Button asChild size="sm" className="mt-3">
                <Link to="/belajar/rencana">Lihat rencana</Link>
              </Button>
            </PaperCard>
            <PaperCard>
              <p className="section-kicker">Biar nggak lupa</p>
              <h2 className="font-display text-xl font-bold">Ulang berjarak</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {dueCount.data
                  ? `${dueCount.data} kartu jatuh tempo hari ini.`
                  : "Tidak ada kartu jatuh tempo. Soal yang salah waktu latihan jadi kartu."}
              </p>
              <Button
                asChild
                size="sm"
                className="mt-3"
                variant={dueCount.data ? "default" : "outline"}
              >
                <Link to="/belajar/ulang">{dueCount.data ? "Mulai ulang" : "Buka"}</Link>
              </Button>
            </PaperCard>
            <PaperCard>
              <p className="section-kicker">Siap ujian</p>
              <h2 className="font-display text-xl font-bold">Rangkuman</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Poin, catatan, dan soal yang sering salah. Bisa dicetak.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(courses.data ?? [])
                  .filter((c) => all.some((m) => m.course_id === c.id))
                  .map((c) => (
                    <Button key={c.id} asChild size="sm" variant="outline">
                      <Link to="/belajar/rangkuman/$courseId" params={{ courseId: c.id }}>
                        {c.code}
                      </Link>
                    </Button>
                  ))}
              </div>
            </PaperCard>
          </div>

          {ai.isSuccess && !ai.data.configured && (
            <PaperCard className="mt-5 border-dashed">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-bold">Aktifkan fitur AI (gratis)</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Rencana belajar di atas sudah jalan tanpa AI. Untuk memecah materi jadi poin dan
                    membuat soal latihan, dibutuhkan kunci Gemini gratis:
                  </p>
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                    <li>
                      Buka <span className="font-semibold">aistudio.google.com</span>, login, lalu
                      klik <span className="font-semibold">Get API key</span> dan{" "}
                      <span className="font-semibold">Create API key</span>. Tidak perlu kartu
                      kredit.
                    </li>
                    <li>
                      Di Vercel:{" "}
                      <span className="font-semibold">Settings, Environment Variables</span>,
                      tambahkan <code>GEMINI_API_KEY</code> berisi kunci itu, lalu{" "}
                      <span className="font-semibold">Redeploy</span>.
                    </li>
                  </ol>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Isi materi yang diproses AI dikirim ke Google. Di paket gratis, Google boleh
                    memakainya untuk meningkatkan produknya.
                  </p>
                </div>
              </div>
            </PaperCard>
          )}

          <PaperCard className="mt-5">
            <p className="section-kicker">Ruang belajar</p>
            <h2 className="font-display text-2xl font-bold">Pilih materi untuk dipelajari</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buka materi untuk membacanya berdampingan dengan poin-poinnya, berlatih soal, dan
              mencatat.
            </p>
            <div className="mt-2">
              <AiQuotaLine ai={ai.data} />
            </div>
            {all.length === 0 && materials.isSuccess && (
              <p className="mt-4 text-sm text-muted-foreground">
                Belum ada materi.{" "}
                <Link to="/materi" className="font-semibold text-primary underline">
                  Unggah dulu di Materi
                </Link>
                .
              </p>
            )}
            {section("Sedang dipelajari", inProgress)}
            {section("Belum dimulai", notStarted)}
            {section("Sudah di-review", reviewed)}
          </PaperCard>
        </>
      )}
    </StudyShell>
  );
}
