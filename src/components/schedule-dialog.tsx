import { useEffect, useState, type FormEvent } from "react";
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
import type { Database } from "@/integrations/supabase/types";
import { deleteSchedule } from "@/lib/calendar.functions";
import {
  ACTIVITY_TYPES,
  EXAM_KINDS,
  addDays,
  toLocalInput,
  type Course,
  type Schedule,
} from "@/lib/schedule-utils";
import { chunk, pickSeries, shiftToTimeOfDay, timeOfDayChanged, type Scope } from "@/lib/series";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  schedule: Schedule | null;
  defaultStart: Date;
  courses: Course[];
  onSaved: (message: string) => void;
};

export function ScheduleDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <ScheduleForm {...rest} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ScheduleForm({
  userId,
  schedule,
  defaultStart,
  courses,
  onSaved,
  close,
}: Omit<Props, "open" | "onOpenChange"> & { close: () => void }) {
  const editing = !!schedule;
  const initialStart = schedule ? new Date(schedule.starts_at) : defaultStart;
  const initialEnd = schedule
    ? new Date(schedule.ends_at)
    : new Date(defaultStart.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(schedule?.title ?? "");
  const [type, setType] = useState(schedule?.activity_type ?? "kuliah");
  const [courseId, setCourseId] = useState(schedule?.course_id ?? "");
  const [start, setStart] = useState(toLocalInput(initialStart));
  const [end, setEnd] = useState(toLocalInput(initialEnd));
  const [location, setLocation] = useState(schedule?.location ?? "");
  const [notes, setNotes] = useState(schedule?.notes ?? "");
  const [urgent, setUrgent] = useState(schedule?.urgent ?? false);
  const [examKind, setExamKind] = useState(schedule?.exam_kind ?? "uts");
  const [count, setCount] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [scope, setScope] = useState<Scope>("one");
  const [series, setSeries] = useState<{ id: string; starts_at: string }[]>([]);
  const removeSchedule = useServerFn(deleteSchedule);

  // Kegiatan lain dengan judul dan jenis yang sama (mis. kuliah yang sama tiap minggu)
  useEffect(() => {
    if (!schedule) return;
    let live = true;
    supabase
      .from("schedules")
      .select("id,starts_at")
      .eq("title", schedule.title)
      .eq("activity_type", schedule.activity_type)
      .order("starts_at")
      .then(({ data }) => {
        if (live && data) setSeries(data);
      });
    return () => {
      live = false;
    };
  }, [schedule]);
  const followingCount = schedule ? pickSeries(series, schedule, "following").length : 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const s = new Date(start);
    const en = new Date(end);
    if (!title.trim()) return setError("Isi nama agenda dulu.");
    if (Number.isNaN(s.getTime()) || Number.isNaN(en.getTime()))
      return setError("Isi waktu mulai dan selesai.");
    if (en <= s) return setError("Waktu selesai harus setelah waktu mulai.");

    setBusy(true);
    setError("");
    const base = {
      title: title.trim(),
      activity_type: type,
      course_id: courseId || null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      urgent: type === "tugas" && urgent,
      exam_kind: type === "ujian" ? examKind : null,
      sync_status: "lokal", // ditandai belum terkirim; dikirim ke Google saat sinkron
    };
    if (schedule) {
      const { error: err } = await supabase
        .from("schedules")
        .update({ ...base, starts_at: s.toISOString(), ends_at: en.toISOString() })
        .eq("id", schedule.id);
      if (err) return fail(err.message);

      // Terapkan juga ke kegiatan lain: hanya bagian yang benar-benar kamu ubah
      let updated = 1;
      const others = pickSeries(series, schedule, scope);
      const patch: Database["public"]["Tables"]["schedules"]["Update"] = {};
      if (base.title !== schedule.title) patch.title = base.title;
      if (base.activity_type !== schedule.activity_type) patch.activity_type = base.activity_type;
      if (base.course_id !== schedule.course_id) patch.course_id = base.course_id;
      if (base.location !== (schedule.location ?? null)) patch.location = base.location;
      if (base.notes !== (schedule.notes ?? null)) patch.notes = base.notes;
      if (type === "tugas" && urgent !== schedule.urgent) patch.urgent = urgent;
      const timeChanged = timeOfDayChanged(schedule, { start: s, end: en });

      if (others.length && (Object.keys(patch).length || timeChanged)) {
        // perubahan jadwal, judul, lokasi, dan catatan perlu dikirim ulang ke Google, mata kuliah saja tidak
        const visible =
          timeChanged ||
          ["title", "location", "notes", "activity_type", "urgent"].some((k) => k in patch);
        const extra = visible ? { sync_status: "lokal" } : {};
        if (timeChanged) {
          for (const group of chunk(others, 10)) {
            const results = await Promise.all(
              group.map((r) =>
                supabase
                  .from("schedules")
                  .update({
                    ...patch,
                    ...extra,
                    ...shiftToTimeOfDay(r.starts_at, { start: s, end: en }),
                  })
                  .eq("id", r.id),
              ),
            );
            const bad = results.find((x) => x.error);
            if (bad?.error) return fail(bad.error.message);
          }
        } else {
          for (const ids of chunk(
            others.map((r) => r.id),
            50,
          )) {
            const { error: err2 } = await supabase
              .from("schedules")
              .update({ ...patch, ...extra })
              .in("id", ids);
            if (err2) return fail(err2.message);
          }
        }
        updated += others.length;
      }
      onSaved(updated > 1 ? `${updated} kegiatan diperbarui.` : "Agenda diperbarui.");
    } else {
      const n = Math.min(Math.max(count, 1), 20);
      const rows = Array.from({ length: n }, (_, i) => ({
        ...base,
        user_id: userId,
        starts_at: addDays(s, 7 * i).toISOString(),
        ends_at: addDays(en, 7 * i).toISOString(),
      }));
      const { error: err } = await supabase.from("schedules").insert(rows);
      if (err) return fail(err.message);
      onSaved(n > 1 ? `${n} pertemuan ditambahkan.` : "Agenda ditambahkan.");
    }
    close();
  };

  const fail = (message: string) => {
    setError(message);
    setBusy(false);
  };

  const remove = async () => {
    if (!schedule) return;
    setBusy(true);
    try {
      await removeSchedule({ data: { id: schedule.id } });
      onSaved("Agenda dihapus.");
      close();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Gagal menghapus agenda.");
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">
          {editing ? "Ubah agenda" : "Agenda baru"}
        </DialogTitle>
        <DialogDescription>
          Kuliah, praktikum, atau sesi belajar. Semuanya bisa ikut ke Google Calendar.
        </DialogDescription>
      </DialogHeader>

      <label className="grid gap-1.5 text-sm font-semibold">
        Nama agenda
        <input
          className="field w-full"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="mis. Basis Data"
          maxLength={160}
          autoFocus
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold">
          Jenis
          <select className="field w-full" value={type} onChange={(e) => setType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Mata kuliah
          <select
            className="field w-full"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">Tanpa mata kuliah</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {type === "ujian" && (
        <label className="grid gap-1.5 text-sm font-semibold">
          Jenis ujian
          <select
            className="field w-full"
            value={examKind}
            onChange={(e) => setExamKind(e.target.value)}
          >
            {EXAM_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {type === "tugas" && (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="accent-[var(--primary)]"
            checked={urgent}
            onChange={(e) => setUrgent(e.target.checked)}
          />
          Penting (deadline mepet)
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold">
          Mulai
          <input
            className="field w-full"
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Selesai
          <input
            className="field w-full"
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
      </div>

      <label className="grid gap-1.5 text-sm font-semibold">
        Lokasi
        <input
          className="field w-full"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="mis. R. 204 atau Lab 1"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-semibold">
        Catatan
        <textarea
          className="field min-h-20 w-full"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      {!editing && (
        <label className="grid gap-1.5 text-sm font-semibold">
          Jumlah pertemuan (tiap minggu)
          <input
            className="field w-32"
            type="number"
            min={1}
            max={20}
            value={count}
            onChange={(e) => setCount(Number(e.target.value) || 1)}
          />
          <span className="text-xs font-normal text-muted-foreground">
            Isi 1 untuk sekali saja. Isi 16 untuk satu semester penuh.
          </span>
        </label>
      )}

      {editing && series.length > 1 && (
        <fieldset className="grid gap-2 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-semibold">Terapkan perubahan ke</legend>
          {(
            [
              ["one", "Hanya kegiatan ini"],
              ...(followingCount > 0
                ? [["following", `Kegiatan ini dan ${followingCount} berikutnya`]]
                : []),
              ["all", `Semua ${series.length} kegiatan “${schedule?.title ?? ""}”`],
            ] as [Scope, string][]
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="scope"
                className="mt-1 accent-[var(--primary)]"
                checked={scope === value}
                onChange={() => setScope(value)}
              />
              <span>{label}</span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">
            Hanya yang kamu ubah yang ikut berganti. Tanggal tiap kegiatan tidak berubah.
          </p>
        </fieldset>
      )}

      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        {editing && (
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
        <Button type="submit" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan agenda"}
        </Button>
      </div>
    </form>
  );
}
