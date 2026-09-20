import { useMemo, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PaperCard } from "@/components/study-shell";
import { supabase } from "@/integrations/supabase/client";
import { matchCourse } from "@/lib/course-aliases";
import { parseEvent } from "@/lib/parse-event";
import { ACTIVITY_TYPES, fmtDayDate, fmtTime, type Course } from "@/lib/schedule-utils";

type Props = { userId: string; courses: Course[]; onAdded: (start: Date, message: string) => void };

// Ketik satu kalimat, mis. "rapat hima hari rabu jam 12.00": hari, jam, dan lokasinya dibaca otomatis.
export function QuickAdd({ userId, courses, onAdded }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => parseEvent(text), [text]);
  const course = parsed && !parsed.error ? matchCourse(parsed.title, courses) : null;
  const ready = !!parsed && !parsed.error && !!parsed.start && !!parsed.end;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!parsed || !parsed.start || !parsed.end || parsed.error) return;
    setBusy(true);
    const { error } = await supabase.from("schedules").insert({
      user_id: userId,
      title: parsed.title.slice(0, 160),
      activity_type: parsed.kind,
      course_id: course?.id ?? null,
      starts_at: parsed.start.toISOString(),
      ends_at: parsed.end.toISOString(),
      location: parsed.location,
      sync_status: "lokal",
    });
    setBusy(false);
    if (error) return void toast.error(error.message);
    setText("");
    onAdded(
      parsed.start,
      `${parsed.title} dijadwalkan: ${fmtDayDate(parsed.start)}, ${fmtTime(parsed.start)}.`,
    );
  };

  const kindLabel = parsed
    ? (ACTIVITY_TYPES.find((t) => t.value === parsed.kind)?.label ?? parsed.kind)
    : "";

  return (
    <PaperCard className="mb-5 py-3">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
        <CalendarPlus className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <input
          className="field min-w-0 flex-1 basis-64"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ketik agenda, mis. rapat HIMA hari Rabu jam 12.00"
          aria-label="Agenda baru dalam satu kalimat"
          maxLength={200}
        />
        <Button type="submit" disabled={!ready || busy}>
          {busy ? "Menyimpan…" : "Jadwalkan"}
        </Button>
      </form>

      <div className="mt-2 min-h-5 pl-7 text-sm" aria-live="polite">
        {!parsed ? (
          <p className="text-xs text-muted-foreground">
            Tekan Enter untuk menjadwalkan. Contoh lain: “belajar ML besok 19.00-21.00”, “kumpul
            organisasi jumat 16.00 di aula”.
          </p>
        ) : parsed.error ? (
          <p className="text-xs text-muted-foreground">{parsed.error}</p>
        ) : (
          <>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Check className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="font-semibold">{parsed.title}</span>
              <span>
                {fmtDayDate(parsed.start!)}, {fmtTime(parsed.start!)}–{fmtTime(parsed.end!)}
              </span>
              {parsed.location && <span>di {parsed.location}</span>}
              <span className="tag">{kindLabel}</span>
              {course && <span className={`tag tone-${course.color}`}>{course.code}</span>}
            </p>
            <p className="text-xs text-muted-foreground">
              {parsed.timeGuessed && "Jam tidak ditulis, dipakai 09.00. "}
              {parsed.durationGuessed && "Durasi 1 jam, bisa diubah nanti dengan klik kartunya. "}
              {parsed.looksLikeTask && (
                <>
                  Kalau ini tugas dengan deadline, pakai{" "}
                  <Link to="/tugas" className="font-semibold text-primary underline">
                    halaman Tugas
                  </Link>{" "}
                  supaya ada pengingatnya.
                </>
              )}
            </p>
          </>
        )}
      </div>
    </PaperCard>
  );
}
