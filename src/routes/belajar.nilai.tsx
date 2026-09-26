import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Calculator, FileText, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GradeEditor } from "@/components/grade-editor";
import { GradeQuickImport } from "@/components/grade-quick-import";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { useCourses } from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import {
  groupByCourse,
  groupRowsByCourse,
  rankByImpact,
  useGradeComponents,
} from "@/hooks/use-grades";

export const Route = createFileRoute("/belajar/nilai")({
  head: () => ({
    meta: [
      { title: "Rencana nilai — Moo Study" },
      {
        name: "description",
        content:
          "Kalkulator nilai per mata kuliah dan prioritas belajar berdasarkan bobot yang paling menentukan.",
      },
      { property: "og:title", content: "Rencana nilai — Moo Study" },
      {
        property: "og:description",
        content:
          "Kalkulator nilai per mata kuliah dan prioritas belajar berdasarkan bobot yang paling menentukan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NilaiPage,
});

function NilaiPage() {
  const { loading, userId } = useSession();
  const courses = useCourses(userId);
  const grades = useGradeComponents(userId);
  const [openCourse, setOpenCourse] = useState<string | null>(null);

  const byCourse = useMemo(() => groupByCourse(grades.data ?? []), [grades.data]);
  const rowsByCourse = useMemo(() => groupRowsByCourse(grades.data ?? []), [grades.data]);
  const ranked = useMemo(
    () =>
      rankByImpact(
        (courses.data ?? []).map((c) => ({ courseId: c.id, components: byCourse.get(c.id) ?? [] })),
      ),
    [courses.data, byCourse],
  );
  const courseName = (id: string) => courses.data?.find((c) => c.id === id);

  return (
    <StudyShell title="Rencana nilai" kicker="Belajar yang paling menentukan">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-3">
        <Link to="/belajar">
          <ArrowLeft /> Ruang belajar
        </Link>
      </Button>

      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">Masuk dulu ya</h2>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : (
        <div className="grid gap-5">
          <PaperCard>
            <div className="flex items-start gap-3">
              <TrendingUp className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0">
                <h2 className="font-display text-2xl font-bold">Belajar apa dulu, demi nilai</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Diurutkan dari komponen belum dinilai dengan bobot paling besar — itu yang paling
                  menentukan nilai akhirmu. Isi dulu bobot dan nilai tiap mata kuliah di bawah.
                </p>
              </div>
            </div>
            {ranked.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Belum ada yang bisa diprioritaskan. Isi komponen nilai mata kuliahmu di bawah dulu.
              </p>
            ) : (
              <ol className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2">
                {ranked.map((r, i) => {
                  const course = courseName(r.courseId);
                  return (
                    <li
                      key={r.courseId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-background p-3"
                    >
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 basis-48">
                        <p className="font-semibold">{course?.name ?? "Mata kuliah"}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.summary.nextComponent!.name} bobot{" "}
                          {r.summary.nextComponent!.weightPercent}%
                          {r.summary.runningPercent !== null &&
                            ` · nilai berjalan ${r.summary.runningPercent}`}
                        </p>
                      </div>
                      {course && (
                        <Button asChild size="sm" variant="outline">
                          <Link to="/belajar/rangkuman/$courseId" params={{ courseId: course.id }}>
                            <FileText /> Rangkuman <ArrowRight />
                          </Link>
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </PaperCard>

          <PaperCard>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" aria-hidden="true" />
                <h2 className="font-display text-xl font-bold">Kalkulator nilai per mata kuliah</h2>
              </div>
              {userId && courses.isSuccess && (courses.data ?? []).length > 0 && (
                <GradeQuickImport
                  userId={userId}
                  courses={courses.data ?? []}
                  existing={rowsByCourse}
                />
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Masukkan bobot tiap komponen sesuai rubrik dosen (harus total 100%), lalu isi nilai
              yang sudah keluar. Punya beberapa mata kuliah sekaligus? Pakai &ldquo;Impor
              cepat&rdquo; di atas.
            </p>

            {courses.isSuccess && (courses.data ?? []).length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Belum ada mata kuliah.{" "}
                <Link to="/jadwal" className="font-semibold text-primary underline">
                  Tambah dulu di Jadwal
                </Link>
                .
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
                {(courses.data ?? []).map((c) => {
                  const open =
                    openCourse === c.id || (openCourse === null && courses.data?.[0]?.id === c.id);
                  const rows = rowsByCourse.get(c.id) ?? [];
                  return (
                    <div key={c.id} className="rounded-md border border-border bg-background">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 p-3 text-left"
                        aria-expanded={open}
                        onClick={() => setOpenCourse(open ? "" : c.id)}
                      >
                        <span className="flex min-w-0 items-center gap-2 font-semibold">
                          <span className={`tag tone-${c.color}`}>{c.code}</span>
                          <span className="truncate">{c.name}</span>
                        </span>
                        {rows.length > 0 && (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {rows.length} komponen
                          </span>
                        )}
                      </button>
                      {open && userId && (
                        <div className="border-t border-border p-3">
                          <GradeEditor userId={userId} courseId={c.id} rows={rows} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </PaperCard>
        </div>
      )}
    </StudyShell>
  );
}
