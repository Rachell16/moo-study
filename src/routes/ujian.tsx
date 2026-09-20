import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarPlus, ExternalLink, FileText, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ExamDialog } from "@/components/exam-dialog";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { useCourses, useExams, useInvalidateData, useMaterials } from "@/hooks/use-schedules";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { useSession } from "@/hooks/use-session";
import { isReviewed, openMaterial, setReviewed } from "@/lib/materials";
import {
  EXAM_KINDS,
  countdownLabel,
  daysUntil,
  fmtDayDate,
  fmtTime,
  type Course,
  type Material,
  type Schedule,
} from "@/lib/schedule-utils";

export const Route = createFileRoute("/ujian")({
  head: () => ({
    meta: [
      { title: "Ujian — Moo Study" },
      {
        name: "description",
        content: "Hitung mundur UTS dan UAS, plus materi yang sudah dan belum di-review.",
      },
      { property: "og:title", content: "Ujian — Moo Study" },
      {
        property: "og:description",
        content: "Hitung mundur UTS dan UAS, plus materi yang sudah dan belum di-review.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UjianPage,
});

function UjianPage() {
  const { loading, userId } = useSession();
  const invalidate = useInvalidateData();
  const courses = useCourses(userId);
  const exams = useExams(userId);
  const materials = useMaterials(userId);
  const google = useGoogleCalendar(userId);

  const [dialog, setDialog] = useState<{
    exam: Schedule | null;
    courseId?: string;
    kind?: string;
  } | null>(null);

  const courseList = useMemo(() => courses.data ?? [], [courses.data]);
  const examList = useMemo(() => exams.data ?? [], [exams.data]);
  const materialList = materials.data ?? [];
  const now = new Date();

  const upcoming = useMemo(
    () => examList.filter((e) => new Date(e.ends_at) >= new Date()),
    [examList],
  );
  const next = upcoming[0];
  const nextCourse = next ? courseList.find((c) => c.id === next.course_id) : undefined;

  // Mata kuliah yang ujiannya paling dekat tampil paling atas.
  const ordered = useMemo(() => {
    const soonest = (c: Course) => upcoming.find((e) => e.course_id === c.id)?.starts_at ?? "9";
    return [...courseList].sort(
      (a, b) => soonest(a).localeCompare(soonest(b)) || a.name.localeCompare(b.name),
    );
  }, [courseList, upcoming]);

  const onSaved = (message: string) => {
    toast.success(message);
    void invalidate();
    google.syncSoon();
  };

  return (
    <StudyShell title="UTS & UAS" kicker="Hitung mundur">
      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">Masuk dulu untuk melihat jadwal ujian</h2>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : (
        <>
          <div className="mb-6 grid gap-5 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_auto]">
            <PaperCard className="bg-study-pink">
              {next ? (
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <div>
                    <p className="font-display text-7xl font-bold leading-none">
                      {daysUntil(new Date(next.starts_at)) <= 0
                        ? "0"
                        : daysUntil(new Date(next.starts_at))}
                    </p>
                    <p className="mt-1 text-sm font-semibold">
                      {daysUntil(new Date(next.starts_at)) <= 0 ? "hari ini" : "hari lagi"}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="section-kicker">Ujian berikutnya</p>
                    <h2 className="font-display text-2xl font-bold leading-tight">
                      {next.exam_kind?.toUpperCase()} {nextCourse?.name ?? next.title}
                    </h2>
                    <p className="mt-1 text-sm">
                      {fmtDayDate(new Date(next.starts_at))}, {fmtTime(new Date(next.starts_at))}
                      {next.location ? `, ${next.location}` : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="section-kicker">Ujian berikutnya</p>
                  <h2 className="font-display text-2xl font-bold">Belum ada jadwal ujian</h2>
                  <p className="mt-1 text-sm">
                    Tambahkan tanggal UTS atau UAS, nanti muncul hitung mundurnya di sini.
                  </p>
                </div>
              )}
            </PaperCard>
            <div className="flex items-start">
              <Button onClick={() => setDialog({ exam: null })}>
                <CalendarPlus /> Atur jadwal ujian
              </Button>
            </div>
          </div>

          {courses.isSuccess && courseList.length === 0 && (
            <PaperCard>
              <p className="text-sm text-muted-foreground">
                Belum ada mata kuliah.{" "}
                <Link to="/jadwal" className="font-semibold text-primary underline">
                  Impor jadwal kuliah
                </Link>{" "}
                dulu, nanti mata kuliahnya muncul di sini.
              </p>
            </PaperCard>
          )}

          <div className="grid gap-5 grid-cols-[minmax(0,1fr)] xl:grid-cols-2">
            {ordered.map((course) => (
              <PaperCard key={course.id} className="min-w-0">
                <div className="mb-4">
                  <p className="section-kicker">{course.code}</p>
                  <h2 className="font-display text-xl font-bold">{course.name}</h2>
                </div>
                <div className="grid gap-6 grid-cols-[minmax(0,1fr)]">
                  {EXAM_KINDS.map((k) => (
                    <ExamBlock
                      key={k.value}
                      kind={k.value}
                      label={k.label}
                      course={course}
                      exam={pickExam(examList, course.id, k.value)}
                      materials={materialList.filter(
                        (m) => m.course_id === course.id && m.exam_scope === k.value,
                      )}
                      now={now}
                      onSchedule={(exam) => setDialog({ exam, courseId: course.id, kind: k.value })}
                      onChanged={() => void invalidate()}
                    />
                  ))}
                </div>
              </PaperCard>
            ))}
          </div>

          {dialog && (
            <ExamDialog
              open
              onOpenChange={(o) => !o && setDialog(null)}
              userId={userId}
              courses={courseList}
              exam={dialog.exam}
              presetCourseId={dialog.courseId}
              presetKind={dialog.kind}
              onSaved={onSaved}
            />
          )}
        </>
      )}
    </StudyShell>
  );
}

// Ujian yang paling relevan untuk satu mata kuliah dan jenis: yang akan datang dulu, kalau tidak ada yang terakhir.
function pickExam(exams: Schedule[], courseId: string, kind: string) {
  const list = exams.filter((e) => e.course_id === courseId && e.exam_kind === kind);
  return list.find((e) => new Date(e.ends_at) >= new Date()) ?? list[list.length - 1] ?? null;
}

function ExamBlock({
  kind,
  label,
  course,
  exam,
  materials,
  now,
  onSchedule,
  onChanged,
}: {
  kind: string;
  label: string;
  course: Course;
  exam: Schedule | null;
  materials: Material[];
  now: Date;
  onSchedule: (exam: Schedule | null) => void;
  onChanged: () => void;
}) {
  const reviewed = materials.filter(isReviewed);
  const pending = materials.filter((m) => !isReviewed(m));
  const pct = materials.length ? Math.round((reviewed.length / materials.length) * 100) : 0;
  const cd = exam ? countdownLabel(new Date(exam.starts_at), now) : null;
  const over = exam ? new Date(exam.ends_at) < now : false;

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal.");
    }
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-lg font-bold">{label}</h3>
        {exam ? (
          <>
            <span className="text-sm text-muted-foreground">
              {fmtDayDate(new Date(exam.starts_at))}, {fmtTime(new Date(exam.starts_at))}
            </span>
            {over ? (
              <span className="tag">selesai</span>
            ) : (
              cd && (
                <span
                  className={`tag ${cd.soon ? "border-transparent bg-accent text-accent-foreground" : ""}`}
                >
                  {cd.text}
                </span>
              )
            )}
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => onSchedule(exam)}>
              Ubah
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onSchedule(null)}>
            Atur tanggal {label}
          </Button>
        )}
      </div>

      {materials.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Belum ada materi untuk {label} {course.name}.{" "}
          <Link to="/materi" className="font-semibold text-primary underline">
            Unggah di Materi
          </Link>
        </p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progres review ${label} ${course.name}`}
            >
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <p className="shrink-0 text-xs font-semibold">
              {reviewed.length} dari {materials.length} sudah di-review
            </p>
          </div>

          {pending.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-destructive">
                Perlu di-review ({pending.length})
              </p>
              <ul className="mt-1.5 grid grid-cols-[minmax(0,1fr)] gap-1.5">
                {pending.map((m) => (
                  <MaterialLine
                    key={m.id}
                    m={m}
                    action="Sudah"
                    onAction={() => void act(() => setReviewed(m.id, true))}
                    onOpen={() => void act(() => openMaterial(m))}
                  />
                ))}
              </ul>
            </div>
          )}

          {reviewed.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-bold text-muted-foreground">
                Sudah di-review ({reviewed.length})
              </summary>
              <ul className="mt-1.5 grid grid-cols-[minmax(0,1fr)] gap-1.5">
                {reviewed.map((m) => (
                  <MaterialLine
                    key={m.id}
                    m={m}
                    action="Batalkan"
                    undo
                    onAction={() => void act(() => setReviewed(m.id, false))}
                    onOpen={() => void act(() => openMaterial(m))}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function MaterialLine({
  m,
  action,
  undo,
  onAction,
  onOpen,
}: {
  m: Material;
  action: string;
  undo?: boolean;
  onAction: () => void;
  onOpen: () => void;
}) {
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm">
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 basis-32 truncate" title={m.name}>
        {m.name}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <span className="tag shrink-0">
          {m.material_type === "praktikum" ? "Praktikum" : "Kuliah"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onOpen}
          aria-label={`Buka ${m.name}`}
        >
          <ExternalLink />
        </Button>
        <Button variant={undo ? "ghost" : "outline"} size="sm" className="h-7" onClick={onAction}>
          {undo && <Undo2 />} {action}
        </Button>
      </div>
    </li>
  );
}
