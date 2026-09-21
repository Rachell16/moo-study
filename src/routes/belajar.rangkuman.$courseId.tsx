import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Copy, Printer } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { useCourseAttempts, useCoursePoints } from "@/hooks/use-summary";
import { useCourses, useMaterials } from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import { cleanMaterialName } from "@/lib/study-plan";
import { frequentMistakes, summaryMarkdown, type SummaryMaterial } from "@/lib/summary";

type Scope = "uts" | "uas" | "semua";
const SCOPES: { value: Scope; label: string }[] = [
  { value: "uts", label: "UTS" },
  { value: "uas", label: "UAS" },
  { value: "semua", label: "Semua materi" },
];

export const Route = createFileRoute("/belajar/rangkuman/$courseId")({
  validateSearch: (search: Record<string, unknown>): { scope?: Scope } =>
    search["scope"] === "uts" || search["scope"] === "uas" || search["scope"] === "semua"
      ? { scope: search["scope"] }
      : {},
  head: () => ({
    meta: [
      { title: "Rangkuman ujian — Moo Study" },
      {
        name: "description",
        content: "Poin materi, catatan, dan soal yang sering salah dalam satu halaman.",
      },
      { property: "og:title", content: "Rangkuman ujian — Moo Study" },
      {
        property: "og:description",
        content: "Poin materi, catatan, dan soal yang sering salah dalam satu halaman.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RangkumanPage,
});

function RangkumanPage() {
  const { courseId } = Route.useParams();
  const { scope = "uts" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { loading, userId } = useSession();
  const courses = useCourses(userId);
  const materials = useMaterials(userId);

  const course = courses.data?.find((c) => c.id === courseId);
  const mats = useMemo(
    () =>
      (materials.data ?? [])
        .filter((m) => m.course_id === courseId && (scope === "semua" || m.exam_scope === scope))
        .sort((a, b) => a.name.localeCompare(b.name, "id", { numeric: true })),
    [materials.data, courseId, scope],
  );
  const ids = useMemo(() => mats.map((m) => m.id), [mats]);
  const points = useCoursePoints(ids);
  const attempts = useCourseAttempts(ids);

  const data: SummaryMaterial[] = useMemo(
    () =>
      mats.map((m) => ({
        id: m.id,
        name: cleanMaterialName(m.name),
        notes: m.study_notes,
        points: (points.data ?? [])
          .filter((p) => p.material_id === m.id)
          .map((p) => ({ heading: p.heading, summary: p.summary, page: p.page })),
      })),
    [mats, points.data],
  );
  const mistakes = useMemo(() => frequentMistakes(attempts.data ?? []), [attempts.data]);

  const title = `Rangkuman ${scope === "semua" ? "semua materi" : scope.toUpperCase()}: ${course?.name ?? "Mata kuliah"}`;
  const dateText = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const missing = data.filter((m) => m.points.length === 0).length;
  const loadingData =
    (ids.length > 0 && (points.isLoading || attempts.isLoading)) ||
    courses.isLoading ||
    materials.isLoading;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        summaryMarkdown({ title, dateText, materials: data, mistakes }),
      );
      toast.success("Rangkuman tersalin. Tempel di Notion atau catatan lain.");
    } catch {
      toast.error("Browser menolak menyalin. Coba pakai tombol Cetak.");
    }
  };

  return (
    <StudyShell
      title="Rangkuman ujian"
      kicker={course ? `${course.code} ${course.name}` : "Siap ujian"}
    >
      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">Masuk dulu ya</h2>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : !course && courses.isSuccess ? (
        <PaperCard>
          <p className="font-semibold">Mata kuliah ini tidak ditemukan.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/belajar">
              <ArrowLeft /> Kembali ke ruang belajar
            </Link>
          </Button>
        </PaperCard>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Button asChild variant="ghost" size="sm" className="-ml-3">
              <Link to="/belajar">
                <ArrowLeft /> Ruang belajar
              </Link>
            </Button>
            <div className="flex gap-1 rounded-md bg-muted p-1" role="group" aria-label="Cakupan">
              {SCOPES.map((s) => (
                <Button
                  key={s.value}
                  size="sm"
                  variant={scope === s.value ? "default" : "ghost"}
                  aria-pressed={scope === s.value}
                  onClick={() => void navigate({ search: { scope: s.value } })}
                >
                  {s.label}
                </Button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void copy()} disabled={mats.length === 0}>
                <Copy /> Salin (Notion)
              </Button>
              <Button onClick={() => window.print()} disabled={mats.length === 0}>
                <Printer /> Cetak / simpan PDF
              </Button>
            </div>
          </div>
          {missing > 0 && (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground print:hidden">
              {missing} materi belum punya poin. Buat dulu di ruang belajar dengan tombol Siapkan
              materi dengan AI, lalu rangkumannya terisi otomatis.
            </p>
          )}

          <article className="mx-auto w-full max-w-3xl rounded-md border border-border bg-card p-5 shadow-sm md:p-8 print:max-w-none print:border-0 print:bg-white print:p-0 print:shadow-none">
            <h1 className="font-display text-3xl font-bold leading-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">Dibuat {dateText} dari Moo Study</p>

            {loadingData ? (
              <p className="mt-6 text-sm text-muted-foreground">Menyusun rangkuman…</p>
            ) : mats.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">
                Belum ada materi untuk cakupan ini. Unggah di halaman Materi atau ganti cakupan di
                atas.
              </p>
            ) : (
              <>
                {data.map((m, i) => (
                  <section key={m.id} className="mt-7 break-inside-avoid-page">
                    <h2 className="font-display text-2xl font-bold">
                      {i + 1}. {m.name}
                    </h2>
                    {m.points.length === 0 ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Belum ada poin materi.{" "}
                        <Link
                          to="/belajar/$id"
                          params={{ id: m.id }}
                          className="font-semibold text-primary underline print:hidden"
                        >
                          Buat di ruang belajar
                        </Link>
                      </p>
                    ) : (
                      <ol className="mt-3 grid gap-2.5">
                        {m.points.map((p, j) => (
                          <li key={j} className="break-inside-avoid text-sm leading-relaxed">
                            <p>
                              <span className="font-bold">
                                {j + 1}. {p.heading}
                              </span>
                              {p.page && (
                                <span className="text-muted-foreground"> (hlm {p.page})</span>
                              )}
                            </p>
                            <p className="pl-5">{p.summary}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                    {m.notes.trim() && (
                      <div className="mt-3 break-inside-avoid rounded-md border border-dashed border-border p-3 text-sm">
                        <p className="font-bold">Catatanku</p>
                        <p className="mt-1 whitespace-pre-wrap">{m.notes.trim()}</p>
                      </div>
                    )}
                  </section>
                ))}

                <section className="mt-8">
                  <h2 className="font-display text-2xl font-bold">Soal yang sering salah</h2>
                  {mistakes.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Belum ada soal yang salah. Kerjakan latihan soal di ruang belajar, nanti yang
                      keliru muncul di sini.
                    </p>
                  ) : (
                    <ol className="mt-3 grid gap-3">
                      {mistakes.map((x, i) => (
                        <li key={i} className="break-inside-avoid text-sm leading-relaxed">
                          <p className="font-semibold">
                            {i + 1}. {x.question}{" "}
                            <span className="font-normal text-muted-foreground">
                              (salah {x.count}x)
                            </span>
                          </p>
                          <p className="pl-5 text-primary">Jawaban: {x.answer}</p>
                          {x.explanation && (
                            <p className="pl-5 text-muted-foreground">{x.explanation}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </>
            )}
          </article>
        </div>
      )}
    </StudyShell>
  );
}
