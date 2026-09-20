import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteSchedule } from "@/lib/calendar.functions";
import { EXAM_KINDS, toLocalInput, type Course, type Schedule } from "@/lib/schedule-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  courses: Course[];
  exam: Schedule | null;
  presetCourseId?: string | undefined;
  presetKind?: string | undefined;
  onSaved: (message: string) => void;
};

export function ExamDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <ExamForm {...rest} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ExamForm({
  userId,
  courses,
  exam,
  presetCourseId,
  presetKind,
  onSaved,
  close,
}: Omit<Props, "open" | "onOpenChange"> & { close: () => void }) {
  const [courseId, setCourseId] = useState(
    exam?.course_id ?? presetCourseId ?? courses[0]?.id ?? "",
  );
  const [kind, setKind] = useState(exam?.exam_kind ?? presetKind ?? "uts");
  const [start, setStart] = useState(exam ? toLocalInput(new Date(exam.starts_at)) : "");
  const [minutes, setMinutes] = useState(
    exam
      ? Math.round((new Date(exam.ends_at).getTime() - new Date(exam.starts_at).getTime()) / 60000)
      : 100,
  );
  const [location, setLocation] = useState(exam?.location ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const removeFn = useServerFn(deleteSchedule);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const course = courses.find((c) => c.id === courseId);
    if (!course) return setError("Pilih mata kuliahnya dulu.");
    const s = new Date(start);
    if (!start || Number.isNaN(s.getTime())) return setError("Isi tanggal dan jam ujian.");
    const mins = Math.min(Math.max(minutes || 0, 10), 600);
    setBusy(true);
    setError("");
    const row = {
      course_id: course.id,
      title: `${kind.toUpperCase()} ${course.name}`,
      activity_type: "ujian",
      exam_kind: kind,
      starts_at: s.toISOString(),
      ends_at: new Date(s.getTime() + mins * 60000).toISOString(),
      location: location.trim() || null,
      sync_status: "lokal",
    };
    const { error: err } = exam
      ? await supabase.from("schedules").update(row).eq("id", exam.id)
      : await supabase.from("schedules").insert({ ...row, user_id: userId });
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    onSaved(exam ? "Jadwal ujian diperbarui." : "Jadwal ujian ditambahkan.");
    close();
  };

  const remove = async () => {
    if (!exam) return;
    setBusy(true);
    try {
      await removeFn({ data: { id: exam.id } });
      onSaved("Jadwal ujian dihapus.");
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">
          {exam ? "Ubah jadwal ujian" : "Jadwal ujian"}
        </DialogTitle>
        <DialogDescription>
          Masuk ke Jadwal dan Google Calendar, dengan pengingat H-3 dan H-1.
        </DialogDescription>
      </DialogHeader>

      {courses.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada mata kuliah. Impor jadwal kuliah di halaman Jadwal dulu.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
            <label className="grid gap-1.5 text-sm font-semibold">
              Mata kuliah
              <select
                className="field"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Jenis
              <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
                {EXAM_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
            <label className="grid gap-1.5 text-sm font-semibold">
              Mulai
              <input
                className="field"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Durasi (menit)
              <input
                className="field"
                type="number"
                min={10}
                max={600}
                step={5}
                value={minutes}
                onChange={(e) => setMinutes(Number(e.target.value))}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-semibold">
            Lokasi
            <input
              className="field"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="mis. Gedung FMIPA R. 101"
            />
          </label>
        </>
      )}

      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        {exam && (
          <Button
            type="button"
            variant="outline"
            className="text-destructive"
            disabled={busy}
            onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
          >
            <Trash2 /> {confirmDelete ? "Yakin hapus?" : "Hapus"}
          </Button>
        )}
        <span className="flex-1" />
        <Button type="button" variant="ghost" onClick={close}>
          Batal
        </Button>
        <Button type="submit" disabled={busy || courses.length === 0}>
          {busy ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
