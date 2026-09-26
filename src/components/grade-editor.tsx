import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { GradeRow } from "@/hooks/use-grades";
import type { Database } from "@/integrations/supabase/types";
import { neededOnRemaining, summarizeCourse } from "@/lib/grade-calc";
import { toComponent } from "@/hooks/use-grades";

// Baris komponen nilai yang bisa diedit langsung (nama, bobot %, nilai), tersimpan otomatis saat kolomnya ditinggalkan (blur).
function Row({
  row,
  onSaved,
  onDeleted,
}: {
  row: GradeRow;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [weight, setWeight] = useState(String(row.weight_percent));
  const [score, setScore] = useState(row.score === null ? "" : String(row.score));
  useEffect(() => {
    setName(row.name);
    setWeight(String(row.weight_percent));
    setScore(row.score === null ? "" : String(row.score));
  }, [row.name, row.weight_percent, row.score]);

  const save = async (patch: Database["public"]["Tables"]["grade_components"]["Update"]) => {
    const { error } = await supabase.from("grade_components").update(patch).eq("id", row.id);
    if (error) toast.error(error.message);
    else onSaved();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        className="field min-w-0 flex-1 basis-32"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== row.name && void save({ name: name.trim() })}
        placeholder="mis. Tugas 1, UTS, UAS"
        maxLength={80}
      />
      <label className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
        <input
          className="field w-16 text-right"
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => {
            const n = Number(weight);
            if (Number.isFinite(n) && n > 0 && n <= 100 && n !== row.weight_percent)
              void save({ weight_percent: n });
            else setWeight(String(row.weight_percent));
          }}
          aria-label={`Bobot ${row.name}`}
        />
        %
      </label>
      <label className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
        nilai
        <input
          className="field w-16 text-right"
          type="number"
          min={0}
          max={100}
          step={0.5}
          placeholder="-"
          value={score}
          onChange={(e) => setScore(e.target.value)}
          onBlur={() => {
            if (score.trim() === "") {
              if (row.score !== null) void save({ score: null });
              return;
            }
            const n = Number(score);
            if (Number.isFinite(n) && n >= 0 && n <= 100) {
              if (n !== row.score) void save({ score: n });
            } else setScore(row.score === null ? "" : String(row.score));
          }}
          aria-label={`Nilai ${row.name}`}
        />
      </label>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Hapus ${row.name}`}
        onClick={async () => {
          const { error } = await supabase.from("grade_components").delete().eq("id", row.id);
          if (error) toast.error(error.message);
          else onDeleted();
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Kalkulator "nilai UAS berapa yang aku butuh". Dihitung dari komponen yang sudah dimasukkan, di browser, tanpa server.
function TargetCalculator({ rows }: { rows: GradeRow[] }) {
  const [target, setTarget] = useState("80");
  const components = rows.map(toComponent);
  const t = Number(target);
  const needed = Number.isFinite(t) ? neededOnRemaining(components, t) : null;

  if (components.every((c) => c.score !== null) || components.length === 0) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
      Supaya nilai akhir
      <input
        className="field w-16 text-center"
        type="number"
        min={0}
        max={100}
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Target nilai akhir"
      />
      , kamu butuh rata-rata
      <span className="font-semibold text-foreground">{needed === null ? "-" : `${needed}%`}</span>
      di sisa komponen yang belum dinilai.
    </p>
  );
}

export function GradeEditor({
  userId,
  courseId,
  rows,
}: {
  userId: string;
  courseId: string;
  rows: GradeRow[];
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["grade-components"] });
  const summary = summarizeCourse(rows.map(toComponent));

  const addRow = async () => {
    setAdding(true);
    const { error } = await supabase.from("grade_components").insert({
      user_id: userId,
      course_id: courseId,
      name: `Komponen ${rows.length + 1}`,
      weight_percent: Math.max(Math.min(100 - summary.totalWeight, 100), 5),
      position: rows.length,
    });
    setAdding(false);
    if (error) toast.error(error.message);
    else void refresh();
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Belum ada komponen nilai. Tambah dulu, mis. Tugas, UTS, UAS, sesuai rubrik dosen.
        </p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {rows.map((r) => (
            <Row key={r.id} row={r} onSaved={refresh} onDeleted={refresh} />
          ))}
        </div>
      )}
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        disabled={adding}
        onClick={() => void addRow()}
      >
        <Plus /> Tambah komponen
      </Button>

      {rows.length > 0 && (
        <div className="mt-1 grid gap-1 border-t border-border pt-3 text-sm">
          <p
            className={
              summary.totalWeight !== 100
                ? "font-semibold text-destructive"
                : "text-muted-foreground"
            }
          >
            Total bobot: {summary.totalWeight}% {summary.totalWeight !== 100 && "(idealnya 100%)"}
          </p>
          {summary.runningPercent !== null && (
            <p>
              Nilai berjalan: <span className="font-semibold">{summary.runningPercent}</span> ·
              proyeksi akhir kalau sisanya setara:{" "}
              <span className="font-semibold">{summary.projectedFinal}</span>
            </p>
          )}
          <TargetCalculator rows={rows} />
        </div>
      )}
    </div>
  );
}
