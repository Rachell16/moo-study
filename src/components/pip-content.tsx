import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CowBuddy } from "@/components/cow-buddy";
import { useCompanion } from "@/hooks/use-companion";
import { useTimer } from "@/hooks/use-timer";
import { PHASE_LABEL } from "@/lib/timer-core";

// Isi jendela mengambang: sapi, timer, dan satu tombol. Dirender lewat portal, jadi tetap hidup bersama aplikasi.
export function PipContent() {
  const timer = useTimer();
  const cow = useCompanion();
  return (
    <div className="flex min-h-screen items-center gap-4 bg-background p-4 text-foreground">
      <CowBuddy mood={cow.mood} size={72} title={`${cow.name}: ${cow.moodText}`} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold uppercase text-muted-foreground">
          {timer.active ? PHASE_LABEL[timer.phase] : cow.name}
        </p>
        <p className="font-display text-4xl font-bold leading-none tabular-nums" role="timer">
          {timer.active ? timer.clock : `${timer.settings.focus}:00`}
        </p>
        {cow.message && (
          <p className="mt-1 line-clamp-2 font-hand text-lg leading-tight">{cow.message.text}</p>
        )}
        <Button
          size="sm"
          className="mt-2"
          variant={timer.running ? "outline" : "default"}
          onClick={() => (timer.active ? timer.toggle() : timer.go("focus", true))}
        >
          {timer.running ? <Pause /> : <Play />}{" "}
          {timer.running ? "Jeda" : timer.active ? "Lanjut" : "Mulai fokus"}
        </Button>
      </div>
    </div>
  );
}
