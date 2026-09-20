import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { defaultAliases } from "@/lib/course-aliases";
import { buildTimetableRows } from "@/lib/timetable-rows";
import {
  defaultSelection,
  parseTimetable,
  sessionTitle,
  type ClassSession,
} from "@/lib/parse-timetable";
import { COURSE_COLORS, addDays, startOfWeek, ymd, type Course } from "@/lib/schedule-utils";

const PLACEHOLDER = `*HARI SENIN*

*10:00 - 11:40*
Mata Kuliah: KEB1316 Sistem Multi-Agen (K/1)
Ruangan: IPB W8 502
PJ: Nama Dosen`;

const DAY_LABEL = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const keyOf = (s: ClassSession) => `${s.day}|${s.start}|${s.code}|${s.kind}|${s.section}`;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  courses: Course[];
  weekStart: Date;
  onImported: (message: string) => void;
};

export function ImportTimetableDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <ImportForm {...rest} close={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ImportForm({
  userId,
  courses,
  weekStart,
  onImported,
  close,
}: Omit<Props, "open" | "onOpenChange"> & { close: () => void }) {
  const [text, setText] = useState("");
  const [startDate, setStartDate] = useState(ymd(weekStart));
  const [weeks, setWeeks] = useState(14);
  const [semester, setSemester] = useState(1);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const parsed = useMemo(() => parseTimetable(text), [text]);
  const defaults = useMemo(() => defaultSelection(parsed.sessions), [parsed]);
  const isOn = (s: ClassSession, i: number) => overrides[keyOf(s)] ?? defaults[i] ?? false;
  const chosen = parsed.sessions.filter((s, i) => isOn(s, i));
  const total = chosen.length * Math.max(weeks, 1);

  const run = async () => {
    setError("");
    if (!chosen.length) return setError("Belum ada kelas yang dicentang.");
    const first = new Date(`${startDate}T00:00`);
    if (Number.isNaN(first.getTime())) return setError("Isi tanggal mulai perkuliahan.");
    const n = Math.min(Math.max(Math.floor(weeks) || 1, 1), 30);
    setBusy(true);
    try {
      // 1) mata kuliah: pakai yang sudah ada (cocok dari kode), sisanya dibuat
      const byCode = new Map(courses.map((c) => [c.code.toUpperCase(), c]));
      const missing = new Map<string, ClassSession>();
      for (const s of chosen)
        if (s.code && !byCode.has(s.code) && !missing.has(s.code)) missing.set(s.code, s);
      if (missing.size) {
        const rows = [...missing.values()].map((s, i) => ({
          user_id: userId,
          name: s.name,
          code: s.code,
          color: COURSE_COLORS[(courses.length + i) % COURSE_COLORS.length]!.value,
          alias: defaultAliases(s.name).join(", "),
          semester: Math.min(Math.max(semester, 1), 20),
        }));
        const { data, error: err } = await supabase.from("courses").insert(rows).select();
        if (err) throw new Error(err.message);
        for (const c of data) byCode.set(c.code.toUpperCase(), c);
      }

      // 2) agenda mingguan
      const monday = startOfWeek(first);
      const rows = buildTimetableRows(chosen, {
        userId,
        monday,
        weeks: n,
        courseIdByCode: new Map([...byCode].map(([code, c]) => [code, c.id])),
      });

      // 3) lewati yang sudah ada (impor dua kali tidak menggandakan)
      const times = rows.map((r) => r.starts_at).sort();
      const { data: existing, error: exErr } = await supabase
        .from("schedules")
        .select("title,starts_at")
        .gte("starts_at", times[0]!)
        .lte("starts_at", times[times.length - 1]!);
      if (exErr) throw new Error(exErr.message);
      const have = new Set(
        (existing ?? []).map((e) => `${e.title}|${new Date(e.starts_at).getTime()}`),
      );
      const fresh = rows.filter((r) => !have.has(`${r.title}|${new Date(r.starts_at).getTime()}`));

      for (let i = 0; i < fresh.length; i += 200) {
        const { error: insErr } = await supabase.from("schedules").insert(fresh.slice(i, i + 200));
        if (insErr) throw new Error(insErr.message);
      }
      const skipped = rows.length - fresh.length;
      onImported(
        `${fresh.length} agenda ditambahkan${skipped ? `, ${skipped} sudah ada dan dilewati` : ""}.`,
      );
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengimpor jadwal.");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Impor jadwal kuliah</DialogTitle>
        <DialogDescription>
          Tempel jadwal dari chat, centang kelas yang kamu ambil, lalu tiap kelas diulang setiap
          minggu.
        </DialogDescription>
      </DialogHeader>

      <label className="grid gap-1.5 text-sm font-semibold">
        Teks jadwal
        <textarea
          className="field min-h-28 font-mono text-xs"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5 text-sm font-semibold">
          Perkuliahan mulai
          <input
            className="field"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Jumlah minggu
          <input
            className="field"
            type="number"
            min={1}
            max={30}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value) || 1)}
          />
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Semester (mata kuliah baru)
          <input
            className="field"
            type="number"
            min={1}
            max={20}
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value) || 1)}
          />
        </label>
      </div>

      {parsed.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada kelas yang terbaca. Pastikan ada baris “HARI …”, jam “10:00 - 11:40”, dan “Mata
          Kuliah: …”.
        </p>
      ) : (
        <div className="grid gap-4">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const list = parsed.sessions.map((s, i) => ({ s, i })).filter(({ s }) => s.day === d);
            if (!list.length) return null;
            return (
              <div key={d}>
                <p className="section-kicker mb-2">{DAY_LABEL[d]}</p>
                <ul className="grid gap-1.5">
                  {list.map(({ s, i }) => (
                    <li key={keyOf(s)}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1 accent-[var(--primary)]"
                          checked={isOn(s, i)}
                          onChange={(e) =>
                            setOverrides({ ...overrides, [keyOf(s)]: e.target.checked })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">
                            {s.start}–{s.end} {sessionTitle(s)}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {s.room || "Ruangan belum diisi"}
                            {s.pj ? `, PJ ${s.pj}` : ""}
                          </span>
                        </span>
                        <span className="tag">{s.kind === "P" ? "Praktikum" : "Kuliah"}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Praktikum yang punya beberapa kelas (P/1, P/2, …) hanya kelas pertama yang dicentang.
            Ganti sesuai kelasmu.
          </p>
        </div>
      )}

      {parsed.notes.length > 0 && (
        <div className="rounded-md border border-border bg-secondary/60 p-3 text-sm">
          <p className="font-semibold">Catatan di teks (tidak ikut diimpor)</p>
          {parsed.notes.map((n) => (
            <p key={n} className="mt-1 text-muted-foreground">
              {n}
            </p>
          ))}
        </div>
      )}
      {parsed.warnings.map((w) => (
        <p key={w} className="text-sm text-destructive">
          {w}
        </p>
      ))}
      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <span className="flex-1 text-sm text-muted-foreground">
          {chosen.length} kelas × {Math.max(weeks, 1)} minggu = {total} agenda
        </span>
        <Button type="button" variant="ghost" onClick={close}>
          Batal
        </Button>
        <Button type="button" disabled={busy || chosen.length === 0} onClick={() => void run()}>
          {busy ? "Mengimpor…" : "Impor jadwal"}
        </Button>
      </div>
    </div>
  );
}
