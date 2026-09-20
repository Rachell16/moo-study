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
import { COURSE_COLORS, type Course } from "@/lib/schedule-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  courses: Course[];
  onChanged: () => void;
};

export function CoursesDialog({ open, onOpenChange, userId, courses, onChanged }: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [lecturer, setLecturer] = useState("");
  const [color, setColor] = useState("sage");
  const [semester, setSemester] = useState(1);
  const [error, setError] = useState("");

  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return setError("Nama dan kode mata kuliah wajib diisi.");
    const { error: err } = await supabase.from("courses").insert({
      user_id: userId,
      name: name.trim(),
      code: code.trim(),
      lecturer: lecturer.trim() || null,
      color,
      semester: Math.min(Math.max(semester, 1), 20),
    });
    if (err) return setError(err.message);
    setName("");
    setCode("");
    setLecturer("");
    setError("");
    onChanged();
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase.from("courses").delete().eq("id", id);
    if (err) return setError(err.message);
    onChanged();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Mata kuliah</DialogTitle>
          <DialogDescription>
            Warna mata kuliah dipakai di kartu jadwal. Menghapus mata kuliah tidak menghapus
            agendanya.
          </DialogDescription>
        </DialogHeader>

        <ul className="grid gap-2">
          {courses.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Belum ada mata kuliah. Tambahkan yang pertama di bawah.
            </li>
          )}
          {courses.map((c) => (
            <li
              key={c.id}
              className={`schedule-note tone-${c.color} flex min-h-0 items-center gap-3 py-2`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold">{c.name}</p>
                <p className="truncate text-xs">
                  {c.code} · Semester {c.semester}
                  {c.lecturer ? ` · ${c.lecturer}` : ""}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => void remove(c.id)}
                aria-label={`Hapus ${c.name}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>

        <form onSubmit={add} className="grid gap-3 border-t border-border pt-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
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
          <input
            className="field w-full"
            value={lecturer}
            onChange={(e) => setLecturer(e.target.value)}
            placeholder="Dosen (opsional)"
            aria-label="Dosen"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="field w-full"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Warna"
            >
              {COURSE_COLORS.map((c) => (
                <option key={c.value} value={c.value}>
                  Warna {c.label.toLowerCase()}
                </option>
              ))}
            </select>
            <input
              className="field w-full"
              type="number"
              min={1}
              max={20}
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value) || 1)}
              aria-label="Semester"
            />
          </div>
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
