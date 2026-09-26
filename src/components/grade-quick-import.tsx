import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardPaste, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { GradeRow } from "@/hooks/use-grades";
import { matchBlocks, parseGradeText, type ParsedBlock } from "@/lib/parse-grades";
import type { Course } from "@/lib/schedule-utils";

const EXAMPLE = `STR
Tugas+aktivitas 10%
UTS 15%
UAS 20%
UTSP 25%
UASP 30%

SMA
Aktifitas 5%
Projek 50%
Tugas 5%
Kuis 5%
UTS 15%
UAS 20%`;

// Tempel banyak rubrik mata kuliah sekaligus, bukan isi satu-satu. Baris tanpa "%" dianggap nama mata kuliah
// baru, baris berisi "%" jadi komponen nilainya. Hanya mata kuliah yang belum punya komponen yang bisa diisi
// lewat sini, supaya tidak menimpa data yang sudah ada.
export function GradeQuickImport({
  userId,
  courses,
  existing,
}: {
  userId: string;
  courses: Course[];
  existing: Map<string, GradeRow[]>;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [picks, setPicks] = useState<Record<number, string>>({}); // index blok -> courseId pilihan manual
  const [busy, setBusy] = useState(false);

  const blocks = useMemo(() => matchBlocks(parseGradeText(text), courses), [text, courses]);
  const resolved = blocks.map((b, i) => ({ ...b, courseId: picks[i] ?? b.courseId }));
  const eligible = resolved.filter(
    (b) => b.courseId && (existing.get(b.courseId!) ?? []).length === 0,
  );
  const skippedExisting = resolved.filter(
    (b) => b.courseId && (existing.get(b.courseId!) ?? []).length > 0,
  );
  const unmatched = resolved.filter((b) => !b.courseId);

  const reset = () => {
    setText("");
    setPicks({});
  };

  const apply = async () => {
    if (eligible.length === 0) return;
    setBusy(true);
    const rows = eligible.flatMap((b) =>
      b.components.map((c, i) => ({
        user_id: userId,
        course_id: b.courseId!,
        name: c.name.slice(0, 80),
        weight_percent: c.weightPercent,
        position: i,
      })),
    );
    const { error } = await supabase.from("grade_components").insert(rows);
    setBusy(false);
    if (error) return void toast.error(error.message);
    toast.success(`${eligible.length} mata kuliah, ${rows.length} komponen nilai ditambahkan.`);
    reset();
    setOpen(false);
    await qc.invalidateQueries({ queryKey: ["grade-components"] });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ClipboardPaste /> Impor cepat (tempel banyak sekaligus)
      </Button>
      <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : (setOpen(false), reset()))}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Impor cepat komponen nilai</DialogTitle>
            <DialogDescription>
              Tempel dari catatanmu: nama mata kuliah di satu baris, lalu komponen dan bobotnya di
              baris-baris berikutnya (harus ada tanda %). Baris kosong memisahkan mata kuliah.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <textarea
              className="field min-h-40 w-full font-mono text-xs"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              spellCheck={false}
            />
            {text.trim() === "" ? (
              <Button size="sm" variant="ghost" className="w-fit" onClick={() => setText(EXAMPLE)}>
                Pakai contoh
              </Button>
            ) : (
              <div className="grid gap-3">
                {resolved.map((b, i) => (
                  <BlockPreview
                    key={i}
                    block={b}
                    courses={courses}
                    alreadyHas={(existing.get(b.courseId ?? "") ?? []).length > 0}
                    onPick={(id) => setPicks((p) => ({ ...p, [i]: id }))}
                  />
                ))}
                <div className="rounded-md bg-secondary/60 p-3 text-sm">
                  <p>
                    Siap diisi: <span className="font-semibold">{eligible.length}</span> mata
                    kuliah.
                    {skippedExisting.length > 0 && (
                      <> {skippedExisting.length} dilewati (sudah ada komponen nilainya).</>
                    )}
                    {unmatched.length > 0 && (
                      <>
                        {" "}
                        {unmatched.length} belum ketemu mata kuliahnya, pilih manual dulu di atas.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
          <Button disabled={eligible.length === 0 || busy} onClick={() => void apply()}>
            <Sparkles /> {busy ? "Menyimpan…" : `Terapkan (${eligible.length} mata kuliah)`}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BlockPreview({
  block,
  courses,
  alreadyHas,
  onPick,
}: {
  block: ParsedBlock;
  courses: Course[];
  alreadyHas: boolean;
  onPick: (courseId: string) => void;
}) {
  const total = block.components.reduce((s, c) => s + c.weightPercent, 0);
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs font-bold uppercase text-muted-foreground">
            {block.header}
          </span>
          {block.courseId ? (
            <span className="truncate font-semibold">
              {courses.find((c) => c.id === block.courseId)?.name}
            </span>
          ) : (
            <select
              className="field h-8 py-0 text-sm"
              value=""
              onChange={(e) => onPick(e.target.value)}
              aria-label={`Pilih mata kuliah untuk ${block.header}`}
            >
              <option value="" disabled>
                Pilih mata kuliah…
              </option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <span
          className={`shrink-0 text-xs font-semibold ${total !== 100 ? "text-destructive" : "text-muted-foreground"}`}
        >
          total {total}%
        </span>
      </div>
      {alreadyHas && block.courseId && (
        <p className="mt-1 text-xs text-destructive">
          Sudah ada komponen nilai untuk mata kuliah ini — dilewati supaya tidak menimpa.
        </p>
      )}
      <p className="mt-1.5 text-sm text-muted-foreground">
        {block.components.map((c) => `${c.name} ${c.weightPercent}%`).join(" · ")}
      </p>
    </div>
  );
}
