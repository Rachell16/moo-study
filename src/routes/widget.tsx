import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Flame, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CowBuddy } from "@/components/cow-buddy";
import { useCompanion } from "@/hooks/use-companion";
import { useFocusSessions } from "@/hooks/use-focus-sessions";
import { useSchedulesBetween, useTasks } from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import { useTimer } from "@/hooks/use-timer";
import { PHASE_LABEL } from "@/lib/timer-core";
import {
  addDays,
  countdownLabel,
  fmtTime,
  startOfDay,
  ymd,
  type Schedule,
} from "@/lib/schedule-utils";
import { computeStreak, dayKey } from "@/lib/streak";

export const Route = createFileRoute("/widget")({
  head: () => ({
    meta: [
      { title: "Widget — Moo Study" },
      {
        name: "description",
        content: "Tampilan ringkas: jadwal berikutnya, timer, dan streak belajar.",
      },
      { property: "og:title", content: "Widget — Moo Study" },
      {
        property: "og:description",
        content: "Tampilan ringkas: jadwal berikutnya, timer, dan streak belajar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WidgetPage,
});

const DOT: Record<string, string> = {
  kuliah: "bg-primary",
  praktikum: "bg-destructive",
  belajar: "bg-accent",
  ujian: "bg-destructive",
  kegiatan: "bg-study-sage",
};

// Tampilan ringkas ala widget: pasang halaman ini ke layar utama untuk ikon tersendiri.
function WidgetPage() {
  const { loading, userId, name } = useSession();
  const qc = useQueryClient();
  const timer = useTimer();
  const cow = useCompanion();
  const [now, setNow] = useState<Date | null>(null);

  // jam dan data diperbarui tiap menit
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => {
      setNow(new Date());
      for (const key of ["schedules", "tasks", "focus-sessions"])
        void qc.invalidateQueries({ queryKey: [key] });
    }, 60000);
    return () => window.clearInterval(id);
  }, [qc]);

  const dayKeyText = now ? ymd(now) : "";
  const dayStart = useMemo(() => startOfDay(now ?? new Date(0)), [dayKeyText]); // eslint-disable-line react-hooks/exhaustive-deps
  const schedules = useSchedulesBetween(now ? userId : null, dayStart, addDays(dayStart, 1));
  const tasks = useTasks(userId);
  const sessions = useFocusSessions(userId);

  const rows = useMemo(() => {
    if (!now) return [];
    const events = (schedules.data ?? [])
      .filter((s: Schedule) => s.activity_type !== "tugas" && new Date(s.ends_at) > now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .slice(0, 3)
      .map((s) => {
        const start = new Date(s.starts_at);
        return {
          key: s.id,
          when: start <= now ? "Sekarang" : fmtTime(start),
          title: s.title,
          dot: DOT[s.activity_type] ?? "bg-muted",
          sub: s.location ?? "",
        };
      });
    const due = (tasks.data ?? [])
      .filter(
        (t) =>
          !t.done &&
          new Date(t.ends_at).getTime() - now.getTime() < 48 * 3600_000 &&
          new Date(t.ends_at) > new Date(now.getTime() - 3600_000),
      )
      .sort((a, b) => a.ends_at.localeCompare(b.ends_at))
      .slice(0, 1)
      .map((t) => ({
        key: t.id,
        when: "Deadline",
        title: t.title,
        dot: "bg-accent",
        sub: countdownLabel(new Date(t.ends_at), now).text,
      }));
    return [...events, ...due];
  }, [now, schedules.data, tasks.data]);

  const dates = useMemo(
    () => (sessions.data ?? []).map((s) => new Date(s.completed_at ?? s.started_at)),
    [sessions.data],
  );
  const streak = useMemo(() => computeStreak(dates, now ?? new Date()), [dates, now]);
  const today = useMemo(() => {
    const key = dayKey(now ?? new Date());
    return (sessions.data ?? []).filter(
      (s) => dayKey(new Date(s.completed_at ?? s.started_at)) === key,
    ).length;
  }, [sessions.data, now]);

  if (loading) return <div className="pasture min-h-screen" />;

  return (
    <div
      className="pasture min-h-screen p-3 text-foreground"
      style={{
        paddingTop: "max(0.75rem, env(safe-area-inset-top))",
        paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="mx-auto grid max-w-md gap-3">
        {!userId ? (
          <section className="poster p-5 text-center">
            <CowBuddy mood="senang" size={72} className="mx-auto" />
            <p className="mt-2 font-display text-xl font-bold">Masuk dulu ya</p>
            <Button asChild className="mt-3">
              <Link to="/auth">Masuk ke kandang</Link>
            </Button>
          </section>
        ) : (
          <>
            <section className="poster flex items-center gap-3 p-4">
              <CowBuddy mood={cow.mood} size={76} title={`${cow.name}: ${cow.moodText}`} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-bold leading-tight">
                  Halo{name ? `, ${name}` : ""}!
                </p>
                <p className="font-hand text-xl leading-tight text-muted-foreground">
                  {cow.name}: {cow.moodText}
                </p>
              </div>
            </section>

            <section className="poster p-4" aria-label="Timer">
              {timer.active ? (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      {PHASE_LABEL[timer.phase]}
                    </p>
                    <p
                      className="font-display text-5xl font-bold leading-none tabular-nums"
                      role="timer"
                    >
                      {timer.clock}
                    </p>
                  </div>
                  <Button
                    size="lg"
                    variant={timer.running ? "outline" : "default"}
                    onClick={timer.toggle}
                    aria-label={timer.running ? "Jeda" : "Lanjut"}
                  >
                    {timer.running ? <Pause /> : <Play />} {timer.running ? "Jeda" : "Lanjut"}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="min-w-0 flex-1 font-display text-lg font-bold leading-tight">
                    Siap fokus {timer.settings.focus} menit?
                  </p>
                  <Button size="lg" onClick={() => timer.go("focus", true)}>
                    <Play /> Mulai
                  </Button>
                </div>
              )}
            </section>

            <section className="poster p-4" aria-label="Berikutnya">
              <p className="section-kicker">Berikutnya hari ini</p>
              {rows.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Tidak ada agenda lagi. Santai dulu, atau belajar ringan.
                </p>
              ) : (
                <ul className="mt-2 grid grid-cols-[minmax(0,1fr)] gap-2">
                  {rows.map((r) => (
                    <li key={r.key} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-sm font-bold tabular-nums">{r.when}</span>
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.dot}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold leading-tight">
                          {r.title}
                        </span>
                        {r.sub && (
                          <span className="block truncate text-xs text-muted-foreground">
                            {r.sub}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              className="poster grid grid-cols-2 divide-x-2 divide-foreground p-0"
              aria-label="Streak"
            >
              <div className="flex items-center gap-2 p-4">
                <Flame className="h-7 w-7 shrink-0 text-accent-foreground" aria-hidden="true" />
                <div>
                  <p className="font-display text-2xl font-bold leading-none">
                    {streak.current} hari
                  </p>
                  <p className="text-xs text-muted-foreground">streak belajar</p>
                </div>
              </div>
              <div className="p-4">
                <p className="font-display text-2xl font-bold leading-none">
                  {today}/{timer.settings.goal}
                </p>
                <p className="text-xs text-muted-foreground">sesi hari ini</p>
              </div>
            </section>

            <p className="text-center">
              <Link to="/" className="font-hand text-xl font-bold text-card underline">
                Buka Moo Study
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
