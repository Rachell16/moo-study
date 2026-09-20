import { createFileRoute } from "@tanstack/react-router";
import { Flame, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CowMark } from "@/components/cow-mark";
import { PaperCard, StudyShell } from "@/components/study-shell";

export const Route = createFileRoute("/timer")({
  head: () => ({ meta: [{ title: "Timer Belajar — Moo Study" }, { name: "description", content: "Pomodoro yang tenang untuk sesi belajar fokus." }, { property: "og:title", content: "Timer Belajar — Moo Study" }, { property: "og:description", content: "Pomodoro yang tenang untuk sesi belajar fokus." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: TimerPage,
});

function TimerPage() {
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<"focus" | "break">("focus");
  useEffect(() => { if (!running) return; const id = window.setInterval(() => setSeconds((s) => { if (s > 0) return s - 1; setRunning(false); return 0; }), 1000); return () => window.clearInterval(id); }, [running]);
  const reset = (m = minutes, nextMode = mode) => { setRunning(false); setMinutes(m); setSeconds(m * 60); setMode(nextMode); };
  const progress = 1 - seconds / (minutes * 60);
  return <StudyShell title="Timer belajar" kicker="Saatnya fokus">
    <div className="grid gap-5 lg:grid-cols-[1.5fr_.8fr]">
      <PaperCard className="relative overflow-hidden text-center"><div className="absolute left-5 top-5"><CowMark className="h-16 w-16" /></div><div className="mx-auto flex w-fit rounded-md bg-muted p-1"><Button variant={mode === "focus" ? "default" : "ghost"} size="sm" onClick={() => reset(25, "focus")}>Fokus</Button><Button variant={mode === "break" ? "default" : "ghost"} size="sm" onClick={() => reset(5, "break")}>Istirahat</Button></div><div className="timer-ring mx-auto my-8" style={{ background: `conic-gradient(var(--primary) ${progress * 360}deg, var(--muted) 0deg)` }}><div><span>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span><small>{mode === "focus" ? "tetap fokus, ya" : "tarik napas dulu"}</small></div></div><div className="flex justify-center gap-3"><Button size="lg" onClick={() => setRunning((v) => !v)}>{running ? <Pause /> : <Play />}{running ? "Jeda" : "Mulai"}</Button><Button size="icon" variant="outline" className="h-10 w-10" onClick={() => reset()} aria-label="Atur ulang"><RotateCcw /></Button></div><div className="mt-7 flex justify-center gap-2">{[15,25,45,60].map((m) => <Button key={m} variant={minutes === m ? "secondary" : "ghost"} size="sm" onClick={() => reset(m, "focus")}>{m}m</Button>)}</div></PaperCard>
      <div className="space-y-5"><PaperCard><div className="flex items-center gap-3"><div className="rounded-md bg-study-mustard p-2"><Flame /></div><div><p className="text-xs font-bold uppercase text-muted-foreground">Study streak</p><p className="font-display text-3xl font-bold">7 hari</p></div></div><div className="mt-5 flex justify-between">{[1,1,1,1,1,1,1].map((x,i) => <div key={i} className="text-center"><span className="block h-7 w-7 rounded-full bg-primary text-sm leading-7 text-primary-foreground">✓</span><small className="mt-1 block text-muted-foreground">{["S","S","R","K","J","S","M"][i]}</small></div>)}</div></PaperCard><PaperCard><h2 className="font-display text-xl font-bold">Sesi hari ini</h2><p className="mt-4 text-4xl font-bold">50 <span className="text-base font-medium text-muted-foreground">menit</span></p><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-2/3 bg-accent" /></div><p className="mt-2 text-xs text-muted-foreground">2 dari 3 sesi selesai</p></PaperCard></div>
    </div>
  </StudyShell>;
}