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
import { deleteMaterial } from "@/lib/materials";
import { EXAM_KINDS, type Course, type Material } from "@/lib/schedule-utils";

type Props = {
  material: Material | null;
  courses: Course[];
  onClose: () => void;
  onChanged: (message: string) => void;
};

export function MaterialDialog({ material, onClose, ...rest }: Props) {
  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {material && <Form material={material} close={onClose} {...rest} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({
  material,
  courses,
  close,
  onChanged,
}: {
  material: Material;
  courses: Course[];
  close: () => void;
  onChanged: (m: string) => void;
}) {
  const [name, setName] = useState(material.name);
  const [courseId, setCourseId] = useState(material.course_id ?? "");
  const [type, setType] = useState(material.material_type);
  const [scope, setScope] = useState(material.exam_scope);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Nama file tidak boleh kosong.");
    setBusy(true);
    const course = courses.find((c) => c.id === courseId);
    const { error: err } = await supabase
      .from("materials")
      .update({
        name: name.trim(),
        course_id: courseId || null,
        material_type: type,
        exam_scope: scope,
        semester: course?.semester ?? material.semester,
      })
      .eq("id", material.id);
    if (err) {
      setError(err.message);
      setBusy(false);
      return;
    }
    onChanged("Materi diperbarui.");
    close();
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteMaterial(material);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
      setBusy(false);
      return;
    }
    onChanged("Materi dihapus.");
    close();
  };

  return (
    <form onSubmit={save} className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl">Ubah materi</DialogTitle>
        <DialogDescription>Pindahkan ke mata kuliah atau kategori yang benar.</DialogDescription>
      </DialogHeader>
      <label className="grid gap-1.5 text-sm font-semibold">
        Nama
        <input
          className="field w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        Mata kuliah
        <select
          className="field w-full"
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
        >
          <option value="">Belum dikategorikan</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm font-semibold">
          Jenis
          <select className="field w-full" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="kuliah">Kuliah</option>
            <option value="praktikum">Praktikum</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-semibold">
          Untuk ujian
          <select className="field w-full" value={scope} onChange={(e) => setScope(e.target.value)}>
            {EXAM_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="text-destructive"
          disabled={busy}
          onClick={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
        >
          <Trash2 /> {confirmDelete ? "Yakin hapus file?" : "Hapus"}
        </Button>
        <span className="flex-1" />
        <Button type="button" variant="ghost" onClick={close}>
          Batal
        </Button>
        <Button type="submit" disabled={busy}>
          Simpan
        </Button>
      </div>
    </form>
  );
}
