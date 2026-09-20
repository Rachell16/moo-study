import { useState, type FormEvent } from "react";
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
import { defaultAliases } from "@/lib/course-aliases";
import { COURSE_COLORS, type Course } from "@/lib/schedule-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  courses: Course[];
  onChanged: () => void;
};

function ColorSwatches({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (color: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {COURSE_COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          className={`swatch tone-${c.value}`}
          aria-pressed={value === c.value}
          aria-label={c.label}
          title={c.label}
          onClick={() => onChange(c.value)}
        />
      ))}
    </div>
  );
}

export function CoursesDialog({ open, onOpenChange, userId, courses, onChanged }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [color, setColor] = useState<string>("sage");
  const [semester, setSemester] = useState(1);
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return setError("Nama dan kode mata kuliah wajib diisi.");
    const { error: err } = await supabase.from("courses").insert({
      user_id: userId,
      name: name.trim(),
      code: code.trim(),
      lecturer: lecturer.trim() || null,
      color,
      alias: defaultAliases(name.trim()).join(", "),
      semester: Math.min(Math.max(semester, 1), 20),
    });
    if (err) return setError(err.message);
    setName("");
    setCode("");
    setLecturer("");
    setError("");
    onChanged();
  };

  const changeColor = async (c: Course, next: string) => {
    if (c.color === next) return;
    const { error: err } = await supabase.from("courses").update({ color: next }).eq("id", c.id);
    if (err) return setError(err.message);
    setError("");
    onChanged();
  };

  const remove = async (c: Course) => {
    if (confirmId !== c.id) return setConfirmId(c.id);
    const { error: err } = await supabase.from("courses").delete().eq("id", c.id);
    if (err) return setError(err.message);
    setConfirmId(null);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Mata kuliah</DialogTitle>
          <DialogDescription>
            Klik lingkaran warna untuk mengganti warna kartunya di jadwal. Menghapus mata kuliah
            tidak menghapus agendanya.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {courses.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Belum ada mata kuliah. Tambahkan yang pertama di bawah.
            </li>
          )}
          {courses.map((c) => (
            <li key={c.id} className={`course-row tone-${c.color} min-w-0`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold leading-tight">{c.name}</p>
                  <p className="truncate text-xs">
                    {c.code}, semester {c.semester}
                    {c.lecturer ? `, ${c.lecturer}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className={confirmId === c.id ? "text-destructive" : ""}
                  onClick={() => void remove(c)}
                  onBlur={() => setConfirmId(null)}
                  aria-label={`Hapus ${c.name}`}
                >
                  <Trash2 /> {confirmId === c.id ? "Yakin?" : ""}
                </Button>
              </div>
              <div className="mt-2.5">
                <ColorSwatches
                  value={c.color}
                  onChange={(next) => void changeColor(c, next)}
                  label={`Warna ${c.name}`}
                />
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={add} className="grid gap-3 border-t border-border pt-4">
          <p className="text-sm font-semibold">Tambah mata kuliah</p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <input
              className="field w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama mata kuliah"
              maxLength={120}
              aria-label="Nama mata kuliah"
            />
            <input
              className="field w-full"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Kode"
              maxLength={30}
              aria-label="Kode"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <input
              className="field w-full"
              value={lecturer}
              onChange={(e) => setLecturer(e.target.value)}
              placeholder="Dosen (opsional)"
              aria-label="Dosen"
            />
            <input
              className="field w-full"
              type="number"
              min={1}
              max={20}
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value) || 1)}
              aria-label="Semester"
              title="Semester"
            />
          </div>
          <ColorSwatches value={color} onChange={setColor} label="Warna mata kuliah baru" />
          {error && (
            <p className="text-sm font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit">Tambah mata kuliah</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
