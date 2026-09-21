import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useInvalidateData } from "@/hooks/use-schedules";
import type { MaterialPoint } from "@/hooks/use-study";
import { supabase } from "@/integrations/supabase/client";
import { setReviewed } from "@/lib/materials";
import type { Material } from "@/lib/schedule-utils";
import { generateOutline, generateQuiz } from "@/lib/study.functions";
import { readStoredQuiz } from "@/lib/study-ai";

const PRIVACY =
  "Isi materi dikirim ke Google Gemini (paket gratis). Google boleh memakai isinya untuk meningkatkan produknya, jadi jangan dipakai untuk materi rahasia.";

function AiNotReady() {
  return (
    <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
      Fitur AI belum aktif di aplikasi ini. Tambahkan <code>GEMINI_API_KEY</code> di pengaturan
      server (langkahnya ada di halaman{" "}
      <Link to="/belajar" className="font-semibold text-primary underline">
        Ruang belajar
      </Link>
      ).
    </p>
  );
}

// ---------------------------------------------------------------- poin materi
export function PointsPanel({
  material,
  points,
  aiReady,
  onPage,
}: {
  material: Material;
  points: MaterialPoint[];
  aiReady: boolean;
  onPage: (page: number) => void;
}) {
  const qc = useQueryClient();
  const invalidate = useInvalidateData();
  const generate = useServerFn(generateOutline);
  const [busy, setBusy] = useState(false);
  const [confirmRedo, setConfirmRedo] = useState(false);

  const done = points.filter((p) => p.understood).length;
  const allDone = points.length > 0 && done === points.length;
  const canAi = material.file_type === "pdf";

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["points"] }),
      qc.invalidateQueries({ queryKey: ["point-progress"] }),
      invalidate(),
    ]);

  const run = async (force: boolean) => {
    setBusy(true);
    setConfirmRedo(false);
    try {
      const r = await generate({ data: { materialId: material.id, force } });
      toast.success(`${r.count} poin materi siap dipelajari.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat poin.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (p: MaterialPoint) => {
    const { error } = await supabase
      .from("material_points")
      .update({ understood: !p.understood })
      .eq("id", p.id);
    if (error) return void toast.error(error.message);
    await refresh();
  };

  const markReviewed = async () => {
    try {
      await setReviewed(material.id, true);
      toast.success("Materi ditandai sudah di-review.");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  };

  if (points.length === 0) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Belum ada poin. AI akan membaca PDF-nya lalu memecahnya jadi 6 sampai 15 poin berurutan,
          masing-masing dengan penjelasan singkat dan nomor halaman.
        </p>
        {!canAi ? (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            AI hanya bisa membaca PDF. Ubah slide PPT jadi PDF dulu, lalu unggah lagi di Materi.
          </p>
        ) : !aiReady ? (
          <AiNotReady />
        ) : (
          <>
            <Button className="w-fit" disabled={busy} onClick={() => void run(false)}>
              <Sparkles /> {busy ? "Membaca materi…" : "Buat poin dengan AI"}
            </Button>
            {busy && (
              <p className="text-sm text-muted-foreground">
                Biasanya 10 sampai 40 detik. Jangan tutup halaman ini.
              </p>
            )}
            <p className="text-xs text-muted-foreground">{PRIVACY}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div>
        <div className="flex items-center gap-3">
          <div
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={points.length}
            aria-valuenow={done}
            aria-label="Poin yang sudah dipahami"
          >
            <div
              className="h-full bg-primary"
              style={{ width: `${(done / points.length) * 100}%` }}
            />
          </div>
          <p className="shrink-0 text-xs font-semibold">
            {done} dari {points.length} poin paham
          </p>
        </div>
        {allDone && material.reviewed_at === null && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-secondary/70 p-3 text-sm">
            <span className="flex-1 basis-56 font-semibold">
              Semua poin sudah kamu pahami. Tandai materi ini sudah di-review?
            </span>
            <Button size="sm" onClick={() => void markReviewed()}>
              <Check /> Tandai sudah
            </Button>
          </div>
        )}
      </div>

      <ol className="grid grid-cols-[minmax(0,1fr)] gap-3">
        {points.map((p) => (
          <li
            key={p.id}
            className={`min-w-0 rounded-md border p-3 ${p.understood ? "border-primary/40 bg-secondary/50" : "border-border bg-background"}`}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {p.position}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-lg font-bold leading-tight">{p.heading}</h3>
                <p className="mt-1 text-sm leading-relaxed">{p.summary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--primary)]"
                      checked={p.understood}
                      onChange={() => void toggle(p)}
                    />
                    Sudah paham
                  </label>
                  {p.page && (
                    <button
                      type="button"
                      className="tag hover:bg-secondary"
                      onClick={() => onPage(p.page!)}
                      title="Buka halaman ini di PDF"
                    >
                      hlm {p.page}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {canAi && aiReady && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {confirmRedo ? (
            <>
              <span className="font-semibold text-destructive">
                Poin lama dan tanda pahammu akan hilang.
              </span>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy}
                onClick={() => void run(true)}
              >
                {busy ? "Membaca…" : "Buat ulang"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmRedo(false)}>
                Batal
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmRedo(true)}>
              <RotateCcw /> Buat ulang poin
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- soal latihan
export function QuizPanel({ material, aiReady }: { material: Material; aiReady: boolean }) {
  const invalidate = useInvalidateData();
  const generate = useServerFn(generateQuiz);
  const questions = useMemo(() => readStoredQuiz(material.quiz), [material.quiz]);
  const [busy, setBusy] = useState(false);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  const restart = () => {
    setIndex(0);
    setPicked(null);
    setScore(0);
    setFinished(false);
  };

  const make = async () => {
    setBusy(true);
    try {
      const r = await generate({ data: { materialId: material.id } });
      toast.success(`${r.count} soal latihan siap.`);
      restart();
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat soal.");
    } finally {
      setBusy(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Belum ada soal. AI akan membuat 6 sampai 8 soal pilihan ganda dari isi materi ini, lengkap
          dengan penjelasan jawabannya.
        </p>
        {material.file_type !== "pdf" ? (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            AI hanya bisa membaca PDF.
          </p>
        ) : !aiReady ? (
          <AiNotReady />
        ) : (
          <>
            <Button className="w-fit" disabled={busy} onClick={() => void make()}>
              <Sparkles /> {busy ? "Membuat soal…" : "Buat soal latihan"}
            </Button>
            {busy && (
              <p className="text-sm text-muted-foreground">
                Biasanya 10 sampai 40 detik. Jangan tutup halaman ini.
              </p>
            )}
            <p className="text-xs text-muted-foreground">{PRIVACY}</p>
          </>
        )}
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="grid gap-3 text-center">
        <p className="font-display text-5xl font-bold">
          {score}/{questions.length}
        </p>
        <p className="text-sm text-muted-foreground">
          {pct >= 80
            ? "Mantap, kamu sudah paham materi ini."
            : pct >= 50
              ? "Lumayan. Ulas poin yang masih ragu, lalu coba lagi."
              : "Baca lagi poin-poin materinya, lalu ulangi latihan."}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={restart}>
            <RotateCcw /> Ulangi soal
          </Button>
          {aiReady && (
            <Button variant="outline" disabled={busy} onClick={() => void make()}>
              {busy ? "Membuat…" : "Buat soal baru"}
            </Button>
          )}
        </div>
      </div>
    );
  }

  const q = questions[index]!;
  const answered = picked !== null;
  return (
    <div className="grid gap-4">
      <p className="text-xs font-bold uppercase text-muted-foreground">
        Soal {index + 1} dari {questions.length}
      </p>
      <p className="font-display text-xl font-bold leading-snug">{q.question}</p>
      <div className="grid gap-2" role="group" aria-label="Pilihan jawaban">
        {q.options.map((opt, i) => {
          const right = i === q.answerIndex;
          const state = !answered
            ? "border-border bg-background hover:bg-secondary"
            : right
              ? "border-primary bg-secondary"
              : i === picked
                ? "border-destructive bg-destructive/10"
                : "border-border bg-background opacity-70";
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => {
                setPicked(i);
                if (right) setScore((s) => s + 1);
              }}
              className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm ${state}`}
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">
                {String.fromCharCode(65 + i)}
              </span>
              <span className="min-w-0 flex-1">{opt}</span>
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="rounded-md bg-secondary/70 p-3 text-sm">
          <p className="font-semibold">
            {picked === q.answerIndex
              ? "Benar!"
              : `Kurang tepat. Jawaban yang benar: ${String.fromCharCode(65 + q.answerIndex)}.`}
          </p>
          {q.explanation && <p className="mt-1 leading-relaxed">{q.explanation}</p>}
        </div>
      )}
      {answered && (
        <Button
          className="w-fit"
          onClick={() => {
            if (index + 1 >= questions.length) setFinished(true);
            else {
              setIndex(index + 1);
              setPicked(null);
            }
          }}
        >
          {index + 1 >= questions.length ? "Lihat hasil" : "Soal berikutnya"}
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- catatan
export function NotesPanel({ material }: { material: Material }) {
  const [text, setText] = useState(material.study_notes);
  const [state, setState] = useState<"tersimpan" | "menyimpan" | "ubah">("tersimpan");
  const saved = useRef(material.study_notes);

  useEffect(() => {
    if (text === saved.current) return;
    setState("ubah");
    const id = window.setTimeout(async () => {
      setState("menyimpan");
      const { error } = await supabase
        .from("materials")
        .update({ study_notes: text })
        .eq("id", material.id);
      if (error) {
        toast.error(error.message);
        setState("ubah");
        return;
      }
      saved.current = text;
      setState("tersimpan");
    }, 900);
    return () => window.clearTimeout(id);
  }, [text, material.id]);

  return (
    <div className="grid gap-2">
      <textarea
        className="field min-h-64 w-full"
        value={text}
        maxLength={20000}
        onChange={(e) => setText(e.target.value)}
        placeholder="Catat hal yang penting, pertanyaan untuk dosen, atau rumus yang sering lupa…"
        aria-label="Catatan materi"
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {state === "tersimpan"
          ? "Tersimpan otomatis."
          : state === "menyimpan"
            ? "Menyimpan…"
            : "Belum tersimpan…"}
      </p>
    </div>
  );
}
