import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { beep } from "@/lib/beep";
import {
  PHASE_LABEL,
  afterFocus,
  clockText,
  minutesOf,
  parseSaved,
  restore,
  type Phase,
} from "@/lib/timer-core";
import {
  DEFAULTS,
  loadSettings,
  sanitize,
  saveSettings,
  type TimerSettings,
} from "@/lib/timer-settings";

// Timer global: tetap jalan saat pindah halaman (mis. buka materi di ruang belajar), dan pulih setelah halaman dimuat ulang.
const STATE_KEY = "moo-timer-state";

export type FinishEvent = {
  id: number;
  kind: "focus-done" | "break-done";
  long: boolean;
  breakMinutes: number;
};

type TimerApi = {
  settings: TimerSettings;
  update: (patch: Partial<TimerSettings>) => void;
  phase: Phase;
  running: boolean;
  remaining: number; // ms
  total: number; // ms
  cycle: number;
  courseId: string;
  setCourseId: (id: string) => void;
  clock: string;
  progress: number; // 0..1
  active: boolean; // sedang berjalan, dijeda di tengah, atau menunggu istirahat dimulai
  toggle: () => void;
  reset: () => void;
  go: (phase: Phase, start?: boolean) => void;
  lastEvent: FinishEvent | null;
};

const Ctx = createContext<TimerApi | null>(null);

export function useTimer() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTimer harus dipakai di dalam TimerProvider");
  return v;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const { userId } = useSession();
  const qc = useQueryClient();

  const [settings, setSettings] = useState<TimerSettings>(DEFAULTS);
  const [phase, setPhase] = useState<Phase>("focus");
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(DEFAULTS.focus * 60000);
  const [cycle, setCycle] = useState(0);
  const [courseId, setCourseId] = useState("");
  const [lastEvent, setLastEvent] = useState<FinishEvent | null>(null);
  const [ready, setReady] = useState(false);
  const endAt = useRef(0);
  const startedAt = useRef<Date | null>(null);
  const finishing = useRef(false);
  const eventId = useRef(0);

  const total = minutesOf(phase, settings) * 60000;

  // Muat pengaturan dan pulihkan timer yang tersimpan (setelah tampil di browser, supaya sama dengan hasil render server).
  useEffect(() => {
    const s = loadSettings();
    setSettings(s);
    setRemaining(s.focus * 60000);
    try {
      const restored = restore(
        parseSaved(JSON.parse(window.localStorage.getItem(STATE_KEY) ?? "null")),
        Date.now(),
        s,
      );
      if (restored) {
        setPhase(restored.phase);
        setRunning(restored.running);
        setRemaining(restored.remaining);
        setCycle(restored.cycle);
        setCourseId(restored.courseId);
        endAt.current = restored.endAt;
        startedAt.current = restored.startedAt ? new Date(restored.startedAt) : null;
      }
    } catch {
      /* data tersimpan rusak: mulai bersih */
    }
    setReady(true);
  }, []);

  // Simpan keadaan tiap kali fase, jalan/jeda, atau putaran berubah (bukan tiap detik).
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(
        STATE_KEY,
        JSON.stringify({
          phase,
          running,
          endAt: endAt.current,
          remaining,
          cycle,
          courseId,
          startedAt: startedAt.current?.getTime() ?? null,
        }),
      );
    } catch {
      /* penyimpanan penuh atau diblokir */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, phase, running, cycle, courseId, running ? 0 : remaining]);

  const update = (patch: Partial<TimerSettings>) => {
    const next = sanitize({ ...settings, ...patch });
    setSettings(next);
    saveSettings(next);
  };

  // Saat pengaturan diubah dan timer tidak jalan, tampilan ikut durasi baru.
  useEffect(() => {
    if (ready && !running) setRemaining(minutesOf(phase, settings) * 60000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.focus, settings.short, settings.long, phase]);

  const go = useCallback(
    (next: Phase, start = false) => {
      finishing.current = false;
      const ms = minutesOf(next, settings) * 60000;
      setPhase(next);
      setRemaining(ms);
      startedAt.current = null;
      if (start) {
        endAt.current = Date.now() + ms;
        if (next === "focus") startedAt.current = new Date();
        setRunning(true);
      } else setRunning(false);
    },
    [settings],
  );

  const announce = (e: Omit<FinishEvent, "id">) => setLastEvent({ ...e, id: ++eventId.current });

  const finish = useCallback(async () => {
    if (finishing.current) return;
    finishing.current = true;
    setRunning(false);
    if (settings.sound) beep();

    if (phase !== "focus") {
      announce({ kind: "break-done", long: phase === "long", breakMinutes: 0 });
      go("focus", settings.auto);
      return;
    }

    const step = afterFocus(cycle, settings);
    const longBreak = step.next === "long";
    setCycle(step.cycle);
    announce({
      kind: "focus-done",
      long: longBreak,
      breakMinutes: longBreak ? settings.long : settings.short,
    });
    toast.success(
      longBreak
        ? `Sesi selesai! Waktunya istirahat panjang ${settings.long} menit.`
        : `Sesi selesai! Istirahat ${settings.short} menit.`,
    );
    const started = startedAt.current ?? new Date(Date.now() - settings.focus * 60000);
    go(step.next, settings.auto);

    if (userId) {
      const { error } = await supabase.from("focus_sessions").insert({
        user_id: userId,
        course_id: courseId || null,
        focus_minutes: settings.focus,
        break_minutes: settings.short,
        completed: true,
        started_at: started.toISOString(),
        completed_at: new Date().toISOString(),
      });
      if (error) toast.error(`Sesi belum tercatat di streak: ${error.message}`);
      else await qc.invalidateQueries({ queryKey: ["focus-sessions"] });
    }
  }, [phase, cycle, settings, userId, courseId, go, qc]);

  // Sisa waktu dihitung dari jam dinding, jadi tetap akurat saat tab di latar belakang.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = endAt.current - Date.now();
      if (left <= 0) void finish();
      else setRemaining(left);
    }, 250);
    return () => window.clearInterval(id);
  }, [running, finish]);

  const clock = clockText(remaining);
  useEffect(() => {
    document.title = running
      ? `${clock} ${PHASE_LABEL[phase]} — Moo Study`
      : document.title.replace(/^\d\d:\d\d \S+( \S+)? — /, "");
  }, [running, clock, phase]);

  const toggle = () => {
    if (running) {
      setRemaining(Math.max(endAt.current - Date.now(), 0));
      setRunning(false);
    } else {
      endAt.current = Date.now() + remaining;
      if (phase === "focus" && !startedAt.current) startedAt.current = new Date();
      setRunning(true);
    }
  };
  const reset = () => {
    setRunning(false);
    setRemaining(total);
    startedAt.current = null;
  };

  const value = useMemo<TimerApi>(
    () => ({
      settings,
      update,
      phase,
      running,
      remaining,
      total,
      cycle,
      courseId,
      setCourseId,
      clock,
      progress: 1 - remaining / total,
      active: running || phase !== "focus" || remaining < total,
      toggle,
      reset,
      go,
      lastEvent,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, phase, running, remaining, total, cycle, courseId, clock, go, lastEvent],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
