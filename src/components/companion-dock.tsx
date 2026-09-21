import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, Download, Pause, PictureInPicture2, Play, Settings2, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { CowBuddy } from "@/components/cow-buddy";
import { PipContent } from "@/components/pip-content";
import { useCompanion } from "@/hooks/use-companion";
import { usePip } from "@/hooks/use-pip";
import { useSession } from "@/hooks/use-session";
import { useTimer } from "@/hooks/use-timer";
import { PHASE_LABEL } from "@/lib/timer-core";

const HIDDEN = ["/widget", "/auth"];

// Sapi teman belajar yang melayang di pojok kanan bawah, plus timer mini yang tetap terlihat saat membuka halaman lain.
export function CompanionDock() {
  const { userId } = useSession();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const timer = useTimer();
  const cow = useCompanion();
  const [open, setOpen] = useState(false);
  const pip = usePip();

  if (!userId || HIDDEN.includes(path)) return null;
  const onTimerPage = path === "/timer";
  const showPill = timer.active && !onTimerPage;

  return (
    <>
      {pip.win && createPortal(<PipContent />, pip.win.document.body)}
      <div
        className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 print:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {cow.message && !open && (
          <div
            role="status"
            aria-live="polite"
            className="cow-pop relative w-72 max-w-full rounded-2xl border-2 border-foreground bg-card p-3 text-sm shadow-lg"
          >
            <button
              type="button"
              onClick={cow.dismiss}
              className="absolute right-1.5 top-1.5 rounded p-1 text-muted-foreground hover:bg-secondary"
              aria-label="Tutup pesan"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="pr-6 font-hand text-xl font-bold leading-tight">{cow.message.text}</p>
            {cow.message.action && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => {
                  cow.message?.action?.run();
                }}
              >
                {cow.message.action.label}
              </Button>
            )}
            <span
              className="absolute -bottom-[9px] right-6 h-4 w-4 rotate-45 border-b-2 border-r-2 border-foreground bg-card"
              aria-hidden="true"
            />
          </div>
        )}

        {open && (
          <div
            className="cow-pop w-72 max-w-full rounded-2xl border-2 border-foreground bg-card p-4 shadow-lg"
            role="dialog"
            aria-label={`Teman belajar ${cow.name}`}
          >
            <div className="flex items-start gap-3">
              <CowBuddy mood={cow.mood} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-bold leading-tight">{cow.name}</p>
                <p className="text-sm text-muted-foreground">{cow.moodText}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 text-muted-foreground hover:bg-secondary"
                aria-label="Tutup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {timer.active ? (
                <Button onClick={timer.toggle}>
                  {timer.running ? <Pause /> : <Play />} {timer.running ? "Jeda" : "Lanjut"}{" "}
                  {PHASE_LABEL[timer.phase].toLowerCase()} ({timer.clock})
                </Button>
              ) : (
                <Button onClick={() => timer.go("focus", true)}>
                  <Play /> Mulai fokus {timer.settings.focus} menit
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/belajar" onClick={() => setOpen(false)}>
                    <BookOpen /> Belajar
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/timer" hash="teman" onClick={() => setOpen(false)}>
                    <Settings2 /> Atur {cow.name}
                  </Link>
                </Button>
              </div>
              {pip.supported && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void (pip.win ? pip.close() : pip.open())}
                >
                  <PictureInPicture2 />{" "}
                  {pip.win ? "Tutup jendela mengambang" : "Melayang di atas semua jendela"}
                </Button>
              )}
              {!cow.install.standalone && cow.install.canPrompt && (
                <Button variant="ghost" size="sm" onClick={() => void cow.install.prompt()}>
                  <Download /> Pasang aplikasi
                </Button>
              )}
              {!cow.install.standalone && cow.install.ios && !cow.install.canPrompt && (
                <p className="text-xs text-muted-foreground">
                  Untuk memasang di iPhone: ketuk Bagikan, lalu Tambah ke Layar Utama.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {showPill && (
            <div
              className="cow-pop flex items-center gap-2 rounded-full border-2 border-foreground bg-card py-1 pl-4 pr-1.5 shadow-lg"
              role="timer"
              aria-label={`${PHASE_LABEL[timer.phase]}, sisa ${timer.clock}`}
            >
              <span className="font-display text-xl font-bold tabular-nums leading-none">
                {timer.clock}
              </span>
              <span className="hidden text-xs font-semibold sm:inline">
                {PHASE_LABEL[timer.phase]}
              </span>
              {pip.supported && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 rounded-full"
                  onClick={() => void (pip.win ? pip.close() : pip.open())}
                  aria-label="Jendela mengambang"
                  title="Melayang di atas semua jendela"
                >
                  <PictureInPicture2 />
                </Button>
              )}
              <Button
                size="icon"
                variant={timer.running ? "outline" : "default"}
                className="h-8 w-8 rounded-full"
                onClick={timer.toggle}
                aria-label={timer.running ? "Jeda timer" : "Lanjutkan timer"}
              >
                {timer.running ? <Pause /> : <Play />}
              </Button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={`Teman belajar ${cow.name}: ${cow.moodText}`}
            className={`grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 border-foreground bg-card shadow-lg transition-transform hover:scale-105 ${cow.message ? "cow-wiggle" : ""}`}
          >
            <CowBuddy mood={cow.mood} size={46} />
          </button>
        </div>
      </div>
    </>
  );
}
