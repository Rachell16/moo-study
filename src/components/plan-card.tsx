import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarCheck, CalendarPlus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaperCard } from "@/components/study-shell";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { useInvalidateData } from "@/hooks/use-schedules";
import { usePlan } from "@/hooks/use-study";
import { supabase } from "@/integrations/supabase/client";
import { fmtTime } from "@/lib/schedule-utils";
import type { PlanItem } from "@/lib/study-plan";

const KIND_LABEL: Record<PlanItem["kind"], string> = {
  tugas: "Tugas",
  ujian: "Ujian",
  persiapan: "Kuliah besok",
  ulas: "Ulas kuliah",
  lanjut: "Lanjutkan",
  review: "Review",
  ulang: "Ulang berjarak",
};

// "Ayo belajar ini hari ini": usulan belajar dari jadwal, deadline, ujian, dan materi yang belum di-review.
export function PlanCard({
  userId,
  limit,
  className = "",
}: {
  userId: string;
  limit?: number;
  className?: string;
}) {
  const { plan, loading, courses } = usePlan(userId);
  const google = useGoogleCalendar(userId);
  const invalidate = useInvalidateData();
  const [busy, setBusy] = useState(false);

  const items = plan ? plan.items.slice(0, limit ?? plan.items.length) : [];
  const hidden = plan ? plan.items.length - items.length : 0;
  const toSchedule = items.filter((i) => i.slot && !i.scheduled);

  const schedule = async (list: PlanItem[]) => {
    const rows = list
      .filter((i) => i.slot)
      .map((i) => ({
        user_id: userId,
        title: i.title.slice(0, 160),
        activity_type: "belajar",
        course_id: i.courseId,
        starts_at: i.slot!.start.toISOString(),
        ends_at: i.slot!.end.toISOString(),
        notes: i.reason,
        sync_status: "lokal",
      }));
    if (!rows.length) return;
    setBusy(true);
    const { error } = await supabase.from("schedules").insert(rows);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(
      rows.length === 1 ? "Sesi belajar dijadwalkan." : `${rows.length} sesi belajar dijadwalkan.`,
    );
    await invalidate();
    google.syncSoon();
  };

  return (
    <PaperCard className={className}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker">Rencana hari ini</p>
          <h2 className="font-display text-2xl font-bold">Ayo belajar ini hari ini</h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Disusun dari jadwal kuliah, deadline tugas, jadwal ujian, dan materi yang belum kamu
            review, lalu dicocokkan dengan waktu kosongmu.
          </p>
        </div>
        <Sparkles className="hidden h-8 w-8 shrink-0 text-primary sm:block" aria-hidden="true" />
      </div>

      {loading ? (
        <p className="mt-5 text-sm text-muted-foreground">Menyusun rencana…</p>
      ) : items.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Belum ada yang perlu dikejar hari ini. Unggah materi di{" "}
          <Link to="/materi" className="font-semibold text-primary underline">
            Materi
          </Link>{" "}
          atau tambah tugas di{" "}
          <Link to="/tugas" className="font-semibold text-primary underline">
            Tugas
          </Link>
          , nanti rencananya muncul di sini.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-3">
          {items.map((it) => {
            const course = courses.find((c) => c.id === it.courseId);
            return (
              <li
                key={it.key}
                className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-background p-3"
              >
                <div className="w-14 shrink-0 text-sm font-bold tabular-nums">
                  {it.slot ? (
                    <>
                      {fmtTime(it.slot.start)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {Math.round((it.slot.end.getTime() - it.slot.start.getTime()) / 60000)} mnt
                      </span>
                    </>
                  ) : it.scheduled ? (
                    <>
                      {fmtTime(it.scheduled.start)}
                      <span className="block text-xs font-normal text-muted-foreground">
                        terjadwal
                      </span>
                    </>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">tanpa jam</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-display text-lg font-bold leading-tight">{it.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{it.reason}</p>
                  <p className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="tag">{KIND_LABEL[it.kind]}</span>
                    {course && <span className={`tag tone-${course.color}`}>{course.code}</span>}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {it.materialId && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/belajar/$id" params={{ id: it.materialId }}>
                        Buka <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  {it.kind === "ulang" && (
                    <Button asChild size="sm">
                      <Link to="/belajar/ulang">
                        Mulai <ArrowRight />
                      </Link>
                    </Button>
                  )}
                  {it.kind === "tugas" && (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/tugas">Tugas</Link>
                    </Button>
                  )}
                  {it.scheduled ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <CalendarCheck className="h-4 w-4" /> Sudah di kalender
                    </span>
                  ) : it.slot ? (
                    <Button size="sm" disabled={busy} onClick={() => void schedule([it])}>
                      <CalendarPlus /> Jadwalkan
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {plan?.note && <p className="mt-3 text-sm text-muted-foreground">{plan.note}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {toSchedule.length > 1 && (
          <Button disabled={busy} onClick={() => void schedule(toSchedule)}>
            <CalendarPlus /> Jadwalkan semua ({toSchedule.length})
          </Button>
        )}
        {hidden > 0 && (
          <Button asChild variant="ghost">
            <Link to="/belajar">
              Lihat {hidden} lainnya <ArrowRight />
            </Link>
          </Button>
        )}
      </div>
    </PaperCard>
  );
}
