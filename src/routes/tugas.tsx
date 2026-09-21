import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, CheckCircle2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { useCourses, useInvalidateData, useTasks } from "@/hooks/use-schedules";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { deleteSchedule } from "@/lib/calendar.functions";
import { matchCourse } from "@/lib/course-aliases";
import { parseTasks } from "@/lib/parse-tasks";
import {
  countdownLabel,
  fmtDayDate,
  fmtTime,
  type Course,
  type Schedule,
} from "@/lib/schedule-utils";

export const Route = createFileRoute("/tugas")({
  head: () => ({
    meta: [
      { title: "Tugas — Moo Study" },
      {
        name: "description",
        content: "Tempel daftar tugas, deadline terbaca otomatis dan langsung masuk jadwal.",
      },
      { property: "og:title", content: "Tugas — Moo Study" },
      {
        property: "og:description",
        content: "Tempel daftar tugas, deadline terbaca otomatis dan langsung masuk jadwal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TugasPage,
});

const PLACEHOLDER = `1. SMA LKP 4, Deadline 20/09/2026, pukul 23:59‼️
2. CV LKP 5, Deadline 22/09/2026, pukul 23:59
3. Quiz ML besok jam 10.00`;

const DEADLINE_BLOCK_MINUTES = 30;

function TugasPage() {
  const { loading, userId } = useSession();
  const invalidate = useInvalidateData();
  const courses = useCourses(userId);
  const tasks = useTasks(userId);
  const google = useGoogleCalendar(userId);
  const removeFn = useServerFn(deleteSchedule);

  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const courseList = useMemo(() => courses.data ?? [], [courses.data]);
  const all = useMemo(() => tasks.data ?? [], [tasks.data]);

  const preview = useMemo(
    () =>
      parseTasks(text).map((t) => {
        const course = matchCourse(t.title, courseList);
        const duplicate =
          !!t.deadline &&
          all.some(
            (x) =>
              x.title.toLowerCase() === t.title.toLowerCase() &&
              new Date(x.ends_at).getTime() === t.deadline!.getTime(),
          );
        return { ...t, course, duplicate };
      }),
    [text, courseList, all],
  );
  const toSave = preview.filter((p) => p.deadline && !p.error && !p.duplicate);

  const save = async () => {
    if (!userId || !toSave.length) return;
    setSaving(true);
    const rows = toSave.map((p) => ({
      user_id: userId,
      course_id: p.course?.id ?? null,
      title: p.title.slice(0, 160),
      activity_type: "tugas",
      starts_at: new Date(p.deadline!.getTime() - DEADLINE_BLOCK_MINUTES * 60000).toISOString(),
      ends_at: p.deadline!.toISOString(),
      urgent: p.urgent,
      sync_status: "lokal",
    }));
    const { error } = await supabase.from("schedules").insert(rows);
    setSaving(false);
    if (error) return void toast.error(error.message);
    toast.success(`${rows.length} tugas dijadwalkan.`);
    setText("");
    await invalidate();
    google.syncSoon();
  };

  const toggleDone = async (t: Schedule) => {
    const { error } = await supabase.from("schedules").update({ done: !t.done }).eq("id", t.id);
    if (error) return void toast.error(error.message);
    await invalidate();
  };

  const remove = async (t: Schedule) => {
    if (confirmId !== t.id) return setConfirmId(t.id);
    try {
      await removeFn({ data: { id: t.id } });
      setConfirmId(null);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus tugas.");
    }
  };

  const open = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done);
  const courseOf = (t: Schedule) => courseList.find((c) => c.id === t.course_id);

  return (
    <StudyShell title="Tugas & deadline" kicker="Jangan sampai kelewat">
      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">Masuk dulu untuk mencatat tugas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tugas yang kamu catat langsung masuk ke jadwal dan Google Calendar.
          </p>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : (
        <>
          <PaperCard className="mb-6">
            <p className="section-kicker">Tambah cepat</p>
            <h2 className="font-display text-2xl font-bold">Tempel daftar tugasmu</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Satu tugas per baris. Nama tugas, tanggal, dan jam terbaca sendiri, tanda ‼️ berarti
              penting, dan singkatan seperti SMA atau CV dihubungkan ke mata kuliahnya. Tanpa jam,
              dipakai 23.59.
            </p>
            <textarea
              className="field mt-4 min-h-28 w-full"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={PLACEHOLDER}
              aria-label="Daftar tugas"
            />

            {preview.length > 0 && (
              <ul className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2">
                {preview.map((p, i) => (
                  <li
                    key={`${i}-${p.raw}`}
                    className={`flex min-w-0 items-start gap-3 rounded-md border px-3 py-2 text-sm ${p.error ? "border-destructive/50 bg-destructive/5" : "border-border bg-background"}`}
                  >
                    {p.error ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    )}
                    <div className="min-w-0 flex-1">
                      {p.error ? (
                        <>
                          <p className="truncate font-semibold">{p.raw}</p>
                          <p className="text-xs text-destructive">{p.error}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold">
                            {p.title}
                            {p.urgent && <span className="ml-2">‼️</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDayDate(p.deadline!)}, {fmtTime(p.deadline!)}
                            {p.timeGuessed ? " (jam tidak ditulis)" : ""}
                            {p.duplicate ? ", sudah ada, dilewati" : ""}
                          </p>
                        </>
                      )}
                    </div>
                    {!p.error && <CourseTag course={p.course} />}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={() => void save()} disabled={saving || toSave.length === 0}>
                {saving
                  ? "Menyimpan…"
                  : toSave.length
                    ? `Jadwalkan ${toSave.length} tugas`
                    : "Jadwalkan tugas"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Tiap tugas jadi blok {DEADLINE_BLOCK_MINUTES} menit di Jadwal yang berakhir tepat di
                deadline. Di Google Calendar ada pengingat H-1 dan 3 jam sebelumnya.
              </p>
            </div>
          </PaperCard>

          <section aria-label="Tugas belum selesai">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <p className="section-kicker">Belum selesai</p>
                <h2 className="font-display text-2xl font-bold">{open.length} tugas</h2>
              </div>
            </div>
            {tasks.isError && (
              <p className="text-sm font-semibold text-destructive">
                Gagal memuat tugas: {tasks.error.message}
              </p>
            )}
            {tasks.isSuccess && open.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Tidak ada tugas yang menunggu. Tempel daftar tugas di atas kalau ada yang baru.
              </p>
            )}
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
              {open.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  course={courseOf(t)}
                  confirming={confirmId === t.id}
                  onToggle={() => void toggleDone(t)}
                  onEdit={() => setEditing(t)}
                  onDelete={() => void remove(t)}
                />
              ))}
            </ul>
          </section>

          {done.length > 0 && (
            <details className="mt-8">
              <summary className="cursor-pointer text-sm font-semibold text-muted-foreground">
                Selesai ({done.length})
              </summary>
              <ul className="mt-3 grid gap-3">
                {done.map((t) => (
                  <TaskRow
                    key={t.id}
                    task={t}
                    course={courseOf(t)}
                    confirming={confirmId === t.id}
                    onToggle={() => void toggleDone(t)}
                    onEdit={() => setEditing(t)}
                    onDelete={() => void remove(t)}
                  />
                ))}
              </ul>
            </details>
          )}

          <ScheduleDialog
            open={!!editing}
            onOpenChange={(o) => !o && setEditing(null)}
            userId={userId}
            schedule={editing}
            defaultStart={new Date()}
            courses={courseList}
            onSaved={(m) => {
              toast.success(m);
              void invalidate();
              google.syncSoon();
            }}
          />
        </>
      )}
    </StudyShell>
  );
}

function CourseTag({ course }: { course: Course | null | undefined }) {
  return course ? (
    <span className={`tag shrink-0 tone-${course.color}`}>{course.code}</span>
  ) : (
    <span className="tag shrink-0 text-muted-foreground">tanpa mata kuliah</span>
  );
}

function TaskRow({
  task,
  course,
  confirming,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Schedule;
  course: Course | undefined;
  confirming: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deadline = new Date(task.ends_at);
  const cd = countdownLabel(deadline);
  return (
    <li className="paper-card flex min-w-0 flex-wrap items-start gap-x-3 gap-y-2 py-4">
      <input
        type="checkbox"
        className="mt-1.5 h-4 w-4 accent-[var(--primary)]"
        checked={task.done}
        onChange={onToggle}
        aria-label={`Tandai ${task.title} selesai`}
      />
      <div className="min-w-0 flex-1 basis-44">
        <button type="button" onClick={onEdit} className="text-left">
          <span
            className={`font-display text-lg font-bold ${task.done ? "text-muted-foreground line-through" : ""}`}
          >
            {task.title}
          </span>
          {task.urgent && !task.done && <span className="ml-2">‼️</span>}
        </button>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {fmtDayDate(deadline)}, {fmtTime(deadline)}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {course && <span className={`tag tone-${course.color}`}>{course.code}</span>}
          {!task.done && (
            <span
              className={`tag ${cd.late ? "border-destructive bg-destructive text-destructive-foreground" : cd.soon ? "border-transparent bg-accent text-accent-foreground" : ""}`}
            >
              {cd.text}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={confirming ? "text-destructive" : "text-muted-foreground"}
          onClick={onDelete}
          aria-label={`Hapus ${task.title}`}
        >
          <Trash2 /> {confirming ? "Yakin hapus?" : ""}
        </Button>
      </div>
    </li>
  );
}
