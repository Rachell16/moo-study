import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { useQuizSummaries } from "@/hooks/use-quiz-history";
import { useCourses, useExams, useMaterials } from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import { usePointProgress } from "@/hooks/use-study";
import { buildRoadmaps } from "@/lib/study-roadmap";

export const Route = createFileRoute("/belajar/rencana")({
  head: () => ({
    meta: [
      { title: "Rencana menuju ujian — Moo Study" },
      { name: "description", content: "Materi dibagi ke hari-hari sebelum UTS dan UAS." },
      { property: "og:title", content: "Rencana menuju ujian — Moo Study" },
      { property: "og:description", content: "Materi dibagi ke hari-hari sebelum UTS dan UAS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RencanaPage,
});

const dayText = (d: Date) =>
  d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
const shortDay = (d: Date) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
const hours = (minutes: number) =>
  minutes >= 60
    ? `${Math.floor(minutes / 60)} jam${minutes % 60 ? ` ${minutes % 60} mnt` : ""}`
    : `${minutes} mnt`;

function RencanaPage() {
  const { loading, userId } = useSession();
  const exams = useExams(userId);
  const materials = useMaterials(userId);
  const courses = useCourses(userId);
  const progress = usePointProgress(userId);
  const summaries = useQuizSummaries(userId);
  const [now, setNow] = useState<Date | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => setNow(new Date()), []);

  const ready = !!now && [exams, materials, courses, progress, summaries].every((q) => q.isSuccess);
  const roadmaps = useMemo(() => {
    if (!now || !ready) return [];
    const best = new Map<string, number>();
    for (const [id, s] of summaries.data ?? []) if (s.best !== null) best.set(id, s.best);
    return buildRoadmaps({
      now,
      exams: exams.data ?? [],
      materials: materials.data ?? [],
      courses: courses.data ?? [],
      progress: progress.data ?? new Map(),
      quizBest: best,
    });
  }, [now, ready, exams.data, materials.data, courses.data, progress.data, summaries.data]);

  const road = roadmaps.find((r) => r.exam.id === picked) ?? roadmaps[0];

  // hari-hari kosong berurutan digabung jadi satu baris supaya daftarnya tidak panjang
  const rows = useMemo(() => {
    type Row =
      | { type: "day"; d: (typeof roadmaps)[number]["days"][number] }
      | { type: "gap"; from: Date; to: Date; count: number };
    const out: Row[] = [];
    for (const d of road?.days ?? []) {
      const prev = out[out.length - 1];
      if (d.items.length === 0 && !d.isToday) {
        if (prev?.type === "gap") {
          prev.to = d.date;
          prev.count++;
        } else out.push({ type: "gap", from: d.date, to: d.date, count: 1 });
      } else out.push({ type: "day", d });
    }
    return out;
  }, [road]);

  return (
    <StudyShell title="Rencana menuju ujian" kicker="Sampai UTS dan UAS">
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
      ) : !ready ? (
        <p className="text-sm text-muted-foreground">Menyusun rencana…</p>
      ) : !road ? (
        <PaperCard className="mx-auto max-w-xl">
          <h2 className="font-display text-2xl font-bold">
            Belum ada ujian dalam 45 hari ke depan
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Rencananya dibuat dari tanggal UTS dan UAS. Isi jadwal ujiannya di halaman Ujian, lalu
            materi yang belum di-review otomatis dibagi ke hari-hari sebelum ujian.
          </p>
          <Button asChild className="mt-4">
            <Link to="/ujian">Isi jadwal ujian</Link>
          </Button>
        </PaperCard>
      ) : (
        <div className="grid gap-5">
          {roadmaps.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih ujian">
              {roadmaps.map((r) => (
                <Button
                  key={r.exam.id}
                  size="sm"
                  variant={r.exam.id === road.exam.id ? "default" : "outline"}
                  aria-pressed={r.exam.id === road.exam.id}
                  onClick={() => setPicked(r.exam.id)}
                >
                  {r.kindLabel} {r.courseName} ({r.daysLeft} hari)
                </Button>
              ))}
            </div>
          )}

          <PaperCard>
            <p className="section-kicker">{road.kindLabel}</p>
            <h2 className="font-display text-2xl font-bold">{road.courseName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {new Date(road.exam.starts_at).toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              , {road.daysLeft === 0 ? "hari ini" : `${road.daysLeft} hari lagi`}
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ["Belum di-review", `${road.pending} materi`],
                ["Total waktu", hours(road.totalMinutes)],
                ["Hari belajar", `${road.days.length} hari`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md border border-border bg-background p-2">
                  <p className="font-display text-xl font-bold leading-tight">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {road.warning && (
              <p className="mt-3 rounded-md border border-dashed border-border p-3 text-sm">
                {road.warning}
              </p>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Rencana dihitung ulang tiap hari dari keadaan terbaru, jadi materi yang terlewat
              otomatis bergeser ke hari-hari berikutnya.
            </p>
            {road.exam.course_id && (
              <Button asChild variant="outline" className="mt-3" size="sm">
                <Link
                  to="/belajar/rangkuman/$courseId"
                  params={{ courseId: road.exam.course_id }}
                  search={{ scope: road.exam.exam_kind === "uas" ? "uas" : "uts" }}
                >
                  <FileText /> Buat rangkuman {road.kindLabel}
                </Link>
              </Button>
            )}
          </PaperCard>

          <ol className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {rows.map((row) =>
              row.type === "gap" ? (
                <li
                  key={`gap-${row.from.getTime()}`}
                  className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground"
                >
                  {row.count === 1
                    ? shortDay(row.from)
                    : `${shortDay(row.from)} sampai ${shortDay(row.to)} (${row.count} hari)`}
                  : tidak ada jadwal belajar khusus. Bebas, atau ulang kartu hafalan.
                </li>
              ) : (
                <li
                  key={row.d.date.getTime()}
                  className={`min-w-0 rounded-md border p-3 ${row.d.isToday ? "border-primary bg-secondary/50" : "border-border bg-card"}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-lg font-bold">
                      {dayText(row.d.date)}
                      {row.d.isToday && <span className="tag ml-2 align-middle">hari ini</span>}
                    </p>
                    {row.d.minutes > 0 && (
                      <p className="text-xs text-muted-foreground">{hours(row.d.minutes)}</p>
                    )}
                  </div>
                  {row.d.items.length === 0 ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Tidak ada jadwal belajar khusus hari ini.
                    </p>
                  ) : (
                    <ul className="mt-2 grid gap-2">
                      {row.d.items.map((it) => (
                        <li key={it.key} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className={`tag ${it.kind === "latihan" ? "" : "tone-sage"}`}>
                            {it.kind === "latihan" ? "Latihan" : "Review"}
                          </span>
                          <span className="min-w-0 flex-1 basis-40 text-sm font-semibold">
                            {it.title}
                          </span>
                          <span className="text-xs text-muted-foreground">{it.minutes} mnt</span>
                          {it.materialId && (
                            <Button asChild size="sm" variant="outline">
                              <Link to="/belajar/$id" params={{ id: it.materialId }}>
                                Buka <ArrowRight />
                              </Link>
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ),
            )}
          </ol>
        </div>
      )}
    </StudyShell>
  );
}
