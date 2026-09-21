import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CowMark } from "@/components/cow-mark";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { useFocusSessions } from "@/hooks/use-focus-sessions";
import { useCourses } from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import { useTimer } from "@/hooks/use-timer";
import { CompanionSettings } from "@/components/companion-settings";
import { PHASE_LABEL } from "@/lib/timer-core";
import { computeStreak, dayKey, weekMarks } from "@/lib/streak";
import { startOfWeek } from "@/lib/schedule-utils";
import { LIMITS, PRESETS, presetIdOf } from "@/lib/timer-settings";

export const Route = createFileRoute("/timer")({
  head: () => ({
    meta: [
      { title: "Timer Belajar — Moo Study" },
      {
        name: "description",
        content: "Podomororo yang tenang untuk sesi belajar fokus.",
      },
      { property: "og:title", content: "Timer Belajar — Moo Study" },
      {
        property: "og:description",
        content: "Podomororo yang tenang untuk sesi belajar fokus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TimerPage,
});

const DAY_LETTERS = ["S", "S", "R", "K", "J", "S", "M"];

function TimerPage() {
  const { loading, userId } = useSession();
  const courses = useCourses(userId);
  const sessions = useFocusSessions(userId);
  // Timer hidup di provider global, jadi tetap jalan saat pindah halaman.
  const {
    settings,
    update,
    phase,
    remaining,
    total,
    cycle,
    courseId,
    setCourseId,
    clock,
    progress,
    toggle,
    reset,
    go,
    running,
  } = useTimer();

  // ---- streak dan ringkasan hari ini (dihitung di browser, setelah tampil) ----
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const dates = useMemo(
    () =>
      (sessions.data ?? []).map(
        (s) => new Date(s.completed_at ?? s.started_at),
      ),
    [sessions.data],
  );
  const streak = useMemo(
    () => computeStreak(dates, now ?? new Date()),
    [dates, now],
  );
  const marks = useMemo(
    () => weekMarks(dates, startOfWeek(now ?? new Date())),
    [dates, now],
  );
  const todayIndex = now ? (now.getDay() + 6) % 7 : -1;
  const today = useMemo(() => {
    const key = dayKey(now ?? new Date());
    const list = (sessions.data ?? []).filter(
      (s) => dayKey(new Date(s.completed_at ?? s.started_at)) === key,
    );
    return {
      count: list.length,
      minutes: list.reduce((sum, s) => sum + s.focus_minutes, 0),
    };
  }, [sessions.data, now]);

  const courseList = useMemo(() => courses.data ?? [], [courses.data]);

  return (
    <StudyShell title="Timer belajar" kicker="Saatnya fokus">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,.8fr)]">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <PaperCard className="relative overflow-hidden text-center">
            <div className="absolute left-5 top-5 hidden sm:block">
              <CowMark className="h-16 w-16" />
            </div>
            <div
              className="mx-auto flex w-fit flex-wrap justify-center rounded-md bg-muted p-1"
              role="group"
              aria-label="Jenis sesi"
            >
              {(["focus", "short", "long"] as const).map((p) => (
                <Button
                  key={p}
                  variant={phase === p ? "default" : "ghost"}
                  size="sm"
                  onClick={() => go(p, false)}
                >
                  {PHASE_LABEL[p]}
                </Button>
              ))}
            </div>

            <div
              className="timer-ring mx-auto my-8"
              style={{
                background: `conic-gradient(var(--primary) ${progress * 360}deg, var(--muted) 0deg)`,
              }}
              role="timer"
              aria-label={`${PHASE_LABEL[phase]}, sisa ${clock}`}
            >
              <div>
                <span>{clock}</span>
                <small>
                  {phase === "focus" ? "tetap fokus, ya" : "tarik napas dulu"}
                </small>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <Button size="lg" onClick={toggle}>
                {running ? <Pause /> : <Play />}
                {running ? "Jeda" : remaining < total ? "Lanjut" : "Mulai"}
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10"
                onClick={reset}
                aria-label="Atur ulang"
              >
                <RotateCcw />
              </Button>
              {phase !== "focus" && (
                <Button variant="outline" onClick={() => go("focus", false)}>
                  <SkipForward /> Lewati istirahat
                </Button>
              )}
            </div>

            <div
              className="mt-6 flex items-center justify-center gap-2"
              aria-label={`Sesi ke-${cycle + 1} dari ${settings.cycle}`}
            >
              {Array.from({ length: settings.cycle }, (_, i) => (
                <span
                  key={i}
                  className={`h-3 w-3 rounded-full border border-foreground/40 ${i < cycle ? "bg-primary" : i === cycle && phase === "focus" ? "bg-accent" : "bg-transparent"}`}
                />
              ))}
              <span className="ml-2 text-xs text-muted-foreground">
                sesi{" "}
                {Math.min(cycle + (phase === "focus" ? 1 : 0), settings.cycle)}{" "}
                dari {settings.cycle} sebelum istirahat panjang
              </span>
            </div>

            <label className="mx-auto mt-5 grid max-w-xs gap-1.5 text-left text-sm font-semibold">
              Belajar apa? (opsional)
              <select
                className="field w-full"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">Tanpa mata kuliah</option>
                {courseList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </PaperCard>

          <PaperCard>
            <p className="section-kicker">Pengaturan</p>
            <h2 className="font-display text-2xl font-bold">
              Atur ritme belajarmu
            </h2>
            <div
              className="mt-4 flex flex-wrap gap-2"
              role="group"
              aria-label="Preset"
            >
              {PRESETS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={
                    presetIdOf(settings) === p.id ? "default" : "outline"
                  }
                  onClick={() =>
                    update({
                      focus: p.focus,
                      short: p.short,
                      long: p.long,
                      cycle: p.cycle,
                    })
                  }
                >
                  {p.label}
                </Button>
              ))}
              <span
                className={`inline-flex h-8 items-center rounded-md border px-3 text-sm font-medium ${presetIdOf(settings) === "kustom" ? "border-primary bg-primary text-primary-foreground" : "border-dashed border-border text-muted-foreground"}`}
              >
                Kustom
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Pilih preset, atau ubah angka di bawah untuk membuat ritme
              sendiri. Perubahan berlaku di sesi berikutnya kalau timer sedang
              jalan.
            </p>

            <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <NumberField
                label="Fokus (menit)"
                value={settings.focus}
                range={LIMITS.focus}
                onCommit={(v) => update({ focus: v })}
              />
              <NumberField
                label="Istirahat pendek (menit)"
                value={settings.short}
                range={LIMITS.short}
                onCommit={(v) => update({ short: v })}
              />
              <NumberField
                label="Istirahat panjang (menit)"
                value={settings.long}
                range={LIMITS.long}
                onCommit={(v) => update({ long: v })}
              />
              <NumberField
                label="Sesi sebelum istirahat panjang"
                value={settings.cycle}
                range={LIMITS.cycle}
                onCommit={(v) => update({ cycle: v })}
              />
              <NumberField
                label="Target sesi per hari"
                value={settings.goal}
                range={LIMITS.goal}
                onCommit={(v) => update({ goal: v })}
              />
            </div>

            <div className="mt-5 grid gap-3">
              <label className="flex items-center justify-between gap-4 text-sm font-semibold">
                <span>
                  Mulai otomatis sesi berikutnya
                  <span className="block text-xs font-normal text-muted-foreground">
                    Fokus dan istirahat bergantian tanpa perlu klik Mulai.
                  </span>
                </span>
                <Switch
                  checked={settings.auto}
                  onCheckedChange={(v) => update({ auto: v })}
                  aria-label="Mulai otomatis"
                />
              </label>
              <label className="flex items-center justify-between gap-4 text-sm font-semibold">
                <span>
                  Bunyi saat selesai
                  <span className="block text-xs font-normal text-muted-foreground">
                    Tiga nada pendek ketika sesi atau istirahat habis.
                  </span>
                </span>
                <Switch
                  checked={settings.sound}
                  onCheckedChange={(v) => update({ sound: v })}
                  aria-label="Bunyi saat selesai"
                />
              </label>
            </div>
          </PaperCard>
          <CompanionSettings />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-5">
          <PaperCard>
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-study-mustard p-2">
                <Flame />
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  Study streak
                </p>
                <p className="font-display text-3xl font-bold">
                  {streak.current} hari
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-between">
              {marks.map((done, i) => (
                <div key={i} className="text-center">
                  <span
                    className={`block h-7 w-7 rounded-full text-sm leading-7 ${done ? "bg-primary text-primary-foreground" : "border border-dashed border-foreground/30 text-transparent"} ${i === todayIndex ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : ""}`}
                    aria-label={done ? "sudah belajar" : "belum belajar"}
                  >
                    ✓
                  </span>
                  <small className="mt-1 block text-muted-foreground">
                    {DAY_LETTERS[i]}
                  </small>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {loading ? null : !userId ? (
                <>
                  <Link
                    to="/auth"
                    className="font-semibold text-primary underline"
                  >
                    Masuk
                  </Link>{" "}
                  supaya sesi fokusmu tercatat.
                </>
              ) : streak.current === 0 ? (
                "Selesaikan satu sesi fokus untuk memulai streak."
              ) : streak.todayDone ? (
                `Hari ini sudah, mantap!${streak.best > streak.current ? ` Rekor terbaikmu ${streak.best} hari.` : ""}`
              ) : (
                "Selesaikan satu sesi hari ini supaya streak-mu lanjut."
              )}
            </p>
          </PaperCard>

          <PaperCard>
            <h2 className="font-display text-xl font-bold">Sesi hari ini</h2>
            <p className="mt-4 text-4xl font-bold">
              {today.minutes}{" "}
              <span className="text-base font-medium text-muted-foreground">
                menit
              </span>
            </p>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={settings.goal}
              aria-valuenow={Math.min(today.count, settings.goal)}
              aria-label="Target sesi hari ini"
            >
              <div
                className="h-full bg-accent"
                style={{
                  width: `${Math.min(today.count / settings.goal, 1) * 100}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {today.count} dari {settings.goal} sesi selesai
              {today.count >= settings.goal ? ". Target tercapai!" : ""}
            </p>
          </PaperCard>
        </div>
      </div>
    </StudyShell>
  );
}

// Kolom angka: bisa dihapus dan diketik bebas, baru disimpan kalau angkanya valid.
function NumberField({
  label,
  value,
  range,
  onCommit,
}: {
  label: string;
  value: number;
  range: readonly [number, number];
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      {label}
      <input
        className="field w-full"
        type="number"
        inputMode="numeric"
        min={range[0]}
        max={range[1]}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (
            e.target.value !== "" &&
            Number.isInteger(n) &&
            n >= range[0] &&
            n <= range[1]
          )
            onCommit(n);
        }}
        onBlur={() => setText(String(value))}
      />
      <span className="text-xs font-normal text-muted-foreground">
        {range[0]} sampai {range[1]}
      </span>
    </label>
  );
}
