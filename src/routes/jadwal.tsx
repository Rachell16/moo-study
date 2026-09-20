import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookMarked,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  MapPin,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { ScheduleDialog } from "@/components/schedule-dialog";
import { CoursesDialog } from "@/components/courses-dialog";
import { ImportTimetableDialog } from "@/components/import-timetable-dialog";
import { useCourses, useInvalidateData, useSchedulesBetween } from "@/hooks/use-schedules";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { useSession } from "@/hooks/use-session";
import {
  addDays,
  fmtDuration,
  fmtRange,
  fmtTime,
  isSameDay,
  startOfWeek,
  toneFor,
  type Schedule,
} from "@/lib/schedule-utils";

export const Route = createFileRoute("/jadwal")({
  head: () => ({
    meta: [
      { title: "Jadwal — Moo Study" },
      { name: "description", content: "Atur jadwal kuliah, tugas, dan sesi belajar pribadi." },
      { property: "og:title", content: "Jadwal — Moo Study" },
      {
        property: "og:description",
        content: "Atur jadwal kuliah, tugas, dan sesi belajar pribadi.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JadwalPage,
});

const DAY_NAMES = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function JadwalPage() {
  const { loading, userId } = useSession();
  const invalidate = useInvalidateData();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const weekEnd = addDays(weekStart, 7);

  const schedules = useSchedulesBetween(userId, weekStart, weekEnd);
  const courses = useCourses(userId);
  const google = useGoogleCalendar(userId, { auto: true });
  const { connected, sync, syncSoon } = google;
  const gstatus = google.status.data;

  const [editing, setEditing] = useState<Schedule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [defaultStart, setDefaultStart] = useState(() => new Date());

  // Hasil redirect dari Google (?google=ok|batal|gagal), lalu sinkron pertama kali
  const handledRedirect = useRef(false);
  useEffect(() => {
    if (!userId || handledRedirect.current) return;
    const result = new URLSearchParams(window.location.search).get("google");
    if (!result) return;
    handledRedirect.current = true;
    window.history.replaceState(null, "", "/jadwal");
    if (result === "ok") {
      toast.success("Google Calendar terhubung.");
      void google.status.refetch().then(() => sync(true));
    } else if (result === "batal") toast("Penghubungan dibatalkan.");
    else toast.error("Gagal menghubungkan Google Calendar. Coba lagi.");
  }, [userId, google.status, sync]);

  const openNew = () => {
    const now = new Date();
    const inWeek = now >= weekStart && now < weekEnd;
    const base = inWeek
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), Math.min(now.getHours() + 1, 22))
      : new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate(), 8);
    setDefaultStart(base);
    setEditing(null);
    setFormOpen(true);
  };

  const onSaved = (message: string) => {
    toast.success(message);
    void invalidate();
    syncSoon();
  };

  const items = schedules.data ?? [];
  const minutes = items
    .filter((s) => s.activity_type !== "tugas")
    .reduce(
      (sum, s) => sum + (new Date(s.ends_at).getTime() - new Date(s.starts_at).getTime()) / 60000,
      0,
    );
  const today = new Date();

  return (
    <StudyShell title="Jadwal kuliah & belajar" kicker="Minggu ini">
      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">Masuk dulu untuk menyimpan jadwal</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Jadwalmu tersimpan privat di akunmu, dan bisa tersambung ke Google Calendar.
          </p>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekStart(addDays(weekStart, -7))}
                  aria-label="Minggu sebelumnya"
                >
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart(startOfWeek(new Date()))}
                >
                  Minggu ini
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setWeekStart(addDays(weekStart, 7))}
                  aria-label="Minggu berikutnya"
                >
                  <ChevronRight />
                </Button>
                <p className="ml-3 text-sm text-muted-foreground">
                  {fmtRange(weekStart, addDays(weekStart, 6))}
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold">
                {items.length} agenda
                {minutes ? ` • ${fmtDuration(Math.round(minutes))} terjadwal` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <CalendarPlus /> Impor jadwal kuliah
              </Button>
              <Button variant="outline" onClick={() => setCoursesOpen(true)}>
                <BookMarked /> Mata kuliah
              </Button>
              <Button onClick={openNew}>
                <Plus /> Tambah agenda
              </Button>
            </div>
          </div>

          <PaperCard className="mb-5 flex flex-wrap items-center gap-3 py-3">
            {google.status.isLoading ? (
              <p className="text-sm text-muted-foreground">Memeriksa Google Calendar…</p>
            ) : connected ? (
              <>
                <Cloud className="h-5 w-5 text-primary" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">Tersambung ke Google Calendar</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {google.progress ?? (
                      <>
                        {gstatus?.email ?? "Akun Google"}
                        {gstatus?.lastSyncedAt
                          ? `, sinkron terakhir ${fmtTime(new Date(gstatus.lastSyncedAt))}`
                          : ""}
                      </>
                    )}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void sync(false)}
                  disabled={google.syncing}
                >
                  <RefreshCw className={google.syncing ? "animate-spin" : ""} />{" "}
                  {google.syncing ? "Menyinkronkan…" : "Sinkronkan"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void google.disconnect()}>
                  Putuskan
                </Button>
              </>
            ) : gstatus?.configured ? (
              <>
                <CloudOff className="h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold">Google Calendar belum tersambung</p>
                  <p className="text-xs text-muted-foreground">
                    Agenda di sini akan muncul di Google Calendar, dan sebaliknya.
                  </p>
                </div>
                <Button size="sm" onClick={() => void google.connect()}>
                  <Cloud /> Hubungkan
                </Button>
              </>
            ) : (
              <>
                <CloudOff className="h-5 w-5 text-muted-foreground" />
                <p className="flex-1 text-sm text-muted-foreground">
                  Google Calendar belum diatur. Tambahkan <code>GOOGLE_CLIENT_ID</code> dan{" "}
                  <code>GOOGLE_CLIENT_SECRET</code> di environment server, langkahnya ada di README.
                </p>
              </>
            )}
          </PaperCard>

          <PaperCard className="overflow-x-auto p-0">
            <div className="min-w-[980px]">
              <div className="grid grid-cols-7 border-b border-border">
                {DAY_NAMES.map((d, i) => {
                  const date = addDays(weekStart, i);
                  const isToday = isSameDay(date, today);
                  return (
                    <div key={d} className="border-r border-border p-4 last:border-r-0">
                      <p
                        className={`text-xs font-bold uppercase ${isToday ? "text-primary" : "text-muted-foreground"}`}
                      >
                        {d}
                      </p>
                      <p
                        className={`font-display text-2xl font-bold ${isToday ? "text-primary" : ""}`}
                      >
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>
              <div className="grid min-h-[430px] grid-cols-7 bg-grid">
                {DAY_NAMES.map((d, i) => {
                  const date = addDays(weekStart, i);
                  const dayItems = items.filter((s) => isSameDay(new Date(s.starts_at), date));
                  return (
                    <div key={d} className="space-y-3 border-r border-border p-3 last:border-r-0">
                      {dayItems.map((s) => (
                        <ScheduleCard
                          key={s.id}
                          schedule={s}
                          tone={toneFor(s, courses.data ?? [])}
                          showSync={connected}
                          onOpen={() => {
                            setEditing(s);
                            setFormOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </PaperCard>

          {schedules.isSuccess && items.length === 0 && (
            <p className="mt-5 text-sm text-muted-foreground">
              Belum ada agenda di minggu ini. Klik “Impor jadwal kuliah” untuk memasukkan jadwal
              semester, atau “Tambah agenda” untuk satu agenda.
            </p>
          )}
          {schedules.isError && (
            <p className="mt-5 text-sm font-semibold text-destructive">
              Gagal memuat jadwal: {schedules.error.message}
            </p>
          )}

          <ScheduleDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            userId={userId}
            schedule={editing}
            defaultStart={defaultStart}
            courses={courses.data ?? []}
            onSaved={onSaved}
          />
          <CoursesDialog
            open={coursesOpen}
            onOpenChange={setCoursesOpen}
            userId={userId}
            courses={courses.data ?? []}
            onChanged={() => void invalidate()}
          />
          <ImportTimetableDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            userId={userId}
            courses={courses.data ?? []}
            weekStart={weekStart}
            onImported={onSaved}
          />
        </>
      )}
    </StudyShell>
  );
}

function ScheduleCard({
  schedule,
  tone,
  showSync,
  onOpen,
}: {
  schedule: Schedule;
  tone: string;
  showSync: boolean;
  onOpen: () => void;
}) {
  const start = new Date(schedule.starts_at);
  const end = new Date(schedule.ends_at);
  const isTask = schedule.activity_type === "tugas";
  const isExam = schedule.activity_type === "ujian";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`schedule-note tone-${tone} block w-full text-left ${schedule.done ? "opacity-60" : ""}`}
    >
      <p className="text-xs font-bold">
        {isTask ? (
          <>
            Deadline {fmtTime(end)}
            {schedule.urgent && " ‼️"}
          </>
        ) : (
          <>
            {isExam && schedule.exam_kind ? `${schedule.exam_kind.toUpperCase()} • ` : ""}
            {fmtTime(start)} — {fmtTime(end)}
          </>
        )}
      </p>
      <h2
        className={`mt-2 font-display text-lg font-bold leading-tight ${schedule.done ? "line-through" : ""}`}
      >
        {schedule.title}
      </h2>
      {schedule.location && (
        <p className="mt-3 flex items-center gap-1 text-xs">
          <MapPin className="h-3 w-3" />
          {schedule.location}
        </p>
      )}
      {showSync && schedule.sync_status !== "tersinkron" && (
        <p
          className={`mt-2 text-xs font-semibold ${schedule.sync_status === "gagal" ? "text-destructive" : "text-muted-foreground"}`}
        >
          {schedule.sync_status === "gagal"
            ? "Gagal dikirim ke Google"
            : "Belum terkirim ke Google"}
        </p>
      )}
    </button>
  );
}
