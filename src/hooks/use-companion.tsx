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
import { useFocusSessions } from "@/hooks/use-focus-sessions";
import { useSchedulesBetween, useTasks } from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import { useTimer } from "@/hooks/use-timer";
import { supabase } from "@/integrations/supabase/client";
import { beep } from "@/lib/beep";
import {
  COMPANION_DEFAULTS,
  MOOD_TEXT,
  cleanCowName,
  dueSoon,
  moodOf,
  sanitizeCompanion,
  say,
  shouldIdleNudge,
  startingBlocks,
  type CompanionSettings,
  type Mood,
} from "@/lib/companion";
import { addDays, startOfDay, ymd } from "@/lib/schedule-utils";

// Teman belajar (sapi bernama): suasana hati, gelembung pengingat, dan notifikasi.
// Pengingat hanya berjalan selama aplikasi terbuka (di tab mana pun). Untuk pengingat saat aplikasi tertutup, blok belajar
// yang dijadwalkan ikut ke Google Calendar dan dibunyikan oleh Google Calendar di HP.

const KEY = "moo-companion";

export type Message = {
  id: number;
  kind: "idle" | "block" | "due" | "focus-done" | "break-done" | "info";
  text: string;
  action?: { label: string; run: () => void };
};
export type NotifyPermission = NotificationPermission | "unsupported";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

type CompanionApi = {
  name: string;
  setName: (name: string) => Promise<string | null>; // mengembalikan pesan error, atau null kalau berhasil
  mood: Mood;
  moodText: string;
  message: Message | null;
  dismiss: () => void;
  settings: CompanionSettings;
  updateSettings: (patch: Partial<CompanionSettings>) => void;
  permission: NotifyPermission;
  requestPermission: () => Promise<NotifyPermission>;
  test: () => void;
  install: { canPrompt: boolean; ios: boolean; standalone: boolean; prompt: () => Promise<void> };
};

const Ctx = createContext<CompanionApi | null>(null);

export function useCompanion() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCompanion harus dipakai di dalam CompanionProvider");
  return v;
}

async function showOsNotification(title: string, body: string) {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg)
      return void (await reg.showNotification(title, {
        body,
        icon: "/icon.png",
        badge: "/icon.png",
        tag: "moo-study",
      }));
    new Notification(title, { body, icon: "/icon.png", tag: "moo-study" });
  } catch {
    /* notifikasi tidak tersedia: gelembung di layar tetap jalan */
  }
}

const EMPTY: never[] = [];

export function CompanionProvider({ children }: { children: ReactNode }) {
  const { userId, cowName } = useSession();
  const timer = useTimer();
  const [settings, setSettings] = useState<CompanionSettings>(COMPANION_DEFAULTS);
  const [message, setMessage] = useState<Message | null>(null);
  const [celebrateUntil, setCelebrateUntil] = useState(0);
  const [tick, setTick] = useState(0); // memicu hitung ulang suasana hati (jam berganti, perayaan selesai)
  const [permission, setPermission] = useState<NotifyPermission>("unsupported");
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  const idRef = useRef(0);
  const lastActivityAt = useRef(Date.now());
  const lastNudgeAt = useRef(0);
  const snoozedUntil = useRef(0);
  const notifiedBlocks = useRef(new Set<string>());
  const notifiedDue = useRef(new Set<string>());

  useEffect(() => {
    try {
      setSettings(sanitizeCompanion(JSON.parse(window.localStorage.getItem(KEY) ?? "null")));
    } catch {
      /* bawaan */
    }
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    setToday(startOfDay(new Date()));
    const onInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onInstall);
    return () => window.removeEventListener("beforeinstallprompt", onInstall);
  }, []);

  const dayKey = today ? ymd(today) : "";
  const dayStart = useMemo(() => startOfDay(today ?? new Date(0)), [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const schedules = useSchedulesBetween(today ? userId : null, dayStart, addDays(dayStart, 1));
  const tasks = useTasks(userId);
  const sessions = useFocusSessions(userId);

  // Sesi fokus yang sudah tercatat hari ini dihitung sebagai aktivitas belajar terakhir.
  useEffect(() => {
    const latest = sessions.data?.[0];
    if (latest)
      lastActivityAt.current = Math.max(
        lastActivityAt.current,
        new Date(latest.completed_at ?? latest.started_at).getTime(),
      );
  }, [sessions.data]);

  const updateSettings = (patch: Partial<CompanionSettings>) => {
    const next = sanitizeCompanion({ ...settings, ...patch });
    setSettings(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* abaikan */
    }
  };

  const speak = useCallback(
    (kind: Message["kind"], text: string, action?: Message["action"]) => {
      if (settings.bubble)
        setMessage({ id: ++idRef.current, kind, text, ...(action ? { action } : {}) });
      if (settings.notify && permission === "granted" && (document.hidden || !settings.bubble))
        void showOsNotification(cowName, text);
    },
    [settings.bubble, settings.notify, permission, cowName],
  );

  const dismiss = useCallback(() => {
    setMessage((m) => {
      if (m?.kind === "idle") snoozedUntil.current = Date.now() + 30 * 60000; // "nanti dulu": jangan ganggu 30 menit
      return null;
    });
  }, []);

  const startFocus = useCallback(() => {
    timer.go("focus", true);
    setMessage(null);
  }, [timer]);

  // Reaksi terhadap timer: selesai fokus, selesai istirahat, dan mulai belajar.
  const seenEvent = useRef(0);
  useEffect(() => {
    const e = timer.lastEvent;
    if (!e || e.id === seenEvent.current) return;
    seenEvent.current = e.id;
    lastActivityAt.current = Date.now();
    if (e.kind === "focus-done") {
      setCelebrateUntil(Date.now() + 12000);
      window.setTimeout(() => setTick((t) => t + 1), 12100);
      speak("focus-done", say.focusDone(e.breakMinutes, e.long));
    } else {
      speak("break-done", say.breakDone(cowName), { label: "Mulai fokus", run: startFocus });
    }
  }, [timer.lastEvent, speak, cowName, startFocus]);

  useEffect(() => {
    lastActivityAt.current = Date.now(); // menjalankan atau menjeda timer dihitung sebagai aktivitas
    if (timer.running)
      setMessage((m) => (m && (m.kind === "idle" || m.kind === "block") ? null : m));
  }, [timer.running]);

  // Pengecekan berkala: blok belajar yang dimulai, tugas yang mepet, dan pengingat "lama tidak belajar".
  const check = useCallback(() => {
    const nowMs = Date.now();
    for (const b of startingBlocks(schedules.data ?? EMPTY, nowMs, notifiedBlocks.current)) {
      notifiedBlocks.current.add(b.id);
      speak("block", say.block(cowName, b.title), { label: "Mulai fokus", run: startFocus });
    }
    for (const t of dueSoon(tasks.data ?? EMPTY, nowMs, notifiedDue.current)) {
      notifiedDue.current.add(t.id);
      speak(
        "due",
        say.due(
          cowName,
          t.title,
          Math.max(Math.round((new Date(t.ends_at).getTime() - nowMs) / 60000), 1),
        ),
      );
    }
    if (
      shouldIdleNudge({
        now: nowMs,
        settings,
        timerActive: timer.running, // timer yang dijeda lama tetap diingatkan
        lastActivityAt: lastActivityAt.current,
        lastNudgeAt: lastNudgeAt.current,
        snoozedUntil: snoozedUntil.current,
        hour: new Date().getHours(),
      })
    ) {
      lastNudgeAt.current = nowMs;
      if (timer.active)
        speak("idle", say.paused(cowName, timer.clock), { label: "Lanjut", run: timer.toggle });
      else
        speak("idle", say.idle(cowName, timer.settings.focus), {
          label: "Mulai fokus",
          run: startFocus,
        });
    }
    setTick((t) => t + 1);
  }, [
    schedules.data,
    tasks.data,
    settings,
    timer.running,
    timer.active,
    timer.clock,
    timer.toggle,
    timer.settings.focus,
    cowName,
    speak,
    startFocus,
  ]);

  useEffect(() => {
    if (!userId) return;
    const id = window.setInterval(check, 30000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [userId, check]);

  const nudging =
    message !== null &&
    (message.kind === "idle" || message.kind === "block" || message.kind === "due");
  const mood = useMemo(
    () =>
      moodOf({
        running: timer.running,
        phase: timer.phase,
        active: timer.active,
        celebrating: Date.now() < celebrateUntil,
        nudging,
        hour: new Date().getHours(),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timer.running, timer.phase, timer.active, celebrateUntil, nudging, tick],
  );

  const setName = async (value: string) => {
    const { error } = await supabase.auth.updateUser({ data: { cow_name: cleanCowName(value) } });
    return error ? error.message : null;
  };

  const requestPermission = async (): Promise<NotifyPermission> => {
    if (!("Notification" in window)) return "unsupported";
    const p = await Notification.requestPermission();
    setPermission(p);
    return p;
  };

  const test = () => {
    beep();
    const text = say.idle(cowName, timer.settings.focus);
    if (settings.bubble)
      setMessage({
        id: ++idRef.current,
        kind: "info",
        text,
        action: { label: "Mulai fokus", run: startFocus },
      });
    if (settings.notify && permission === "granted") void showOsNotification(cowName, text);
  };

  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true,
    );
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
  }, []);

  const value: CompanionApi = {
    name: cowName,
    setName,
    mood,
    moodText: MOOD_TEXT[mood],
    message,
    dismiss,
    settings,
    updateSettings,
    permission,
    requestPermission,
    test,
    install: {
      canPrompt: !!installEvent,
      ios,
      standalone,
      prompt: async () => {
        if (!installEvent) return;
        await installEvent.prompt();
        setInstallEvent(null);
      },
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
