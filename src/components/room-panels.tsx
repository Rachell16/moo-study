import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, RotateCcw, Shuffle, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useQuizAttempts } from "@/hooks/use-quiz-history";
import { useInvalidateData } from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import { QuizHistory } from "@/components/quiz-history";
import { QuizRunner, shuffle, type RunAnswer } from "@/components/quiz-runner";
import { recordAnswers } from "@/hooks/use-spaced";
import { buildAttemptPayload } from "@/lib/quiz-history";
import { canUseAi, type AiInfo, type MaterialPoint } from "@/hooks/use-study";
import { supabase } from "@/integrations/supabase/client";
import { setReviewed } from "@/lib/materials";
import { fmtTime, type Material } from "@/lib/schedule-utils";
import { generateQuiz, prepareMaterial } from "@/lib/study.functions";
import { DEPTHS, readStoredQuiz, type Depth, type QuizQuestion } from "@/lib/study-ai";

const PRIVACY =
  "Isi materi dikirim ke Google Gemini (paket gratis). Google boleh memakai isinya untuk meningkatkan produknya, jadi jangan dipakai untuk materi rahasia.";

// ------------------------------------------------------------ status AI dan jatah
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

export function AiQuotaLine({ ai }: { ai: AiInfo | undefined }) {
  if (!ai?.configured || !ai.quota) return null;
  const q = ai.quota;
  const reset = fmtTime(new Date(q.resetsAt));
  return (
    <p
      className={`text-xs ${q.remaining === 0 ? "font-semibold text-destructive" : "text-muted-foreground"}`}
    >
      {q.remaining === 0
        ? `Jatah AI-mu hari ini habis. Terisi lagi sekitar pukul ${reset}.`
        : `Sisa jatah AI hari ini: ${q.remaining} dari ${q.limit}. Terisi lagi sekitar pukul ${reset}.`}
    </p>
  );
}

// ------------------------------------------------------------ ketelitian AI
const DEPTH_KEY = "moo-ai-depth";

function useDepth(): [Depth, (d: Depth) => void] {
  const [depth, setDepth] = useState<Depth>("seimbang");
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(DEPTH_KEY);
      if (v === "cepat" || v === "seimbang" || v === "teliti") setDepth(v);
    } catch {
      /* penyimpanan diblokir: pilihan berlaku selama halaman terbuka */
    }
  }, []);
  const set = (d: Depth) => {
    setDepth(d);
    try {
      window.localStorage.setItem(DEPTH_KEY, d);
    } catch {
      /* abaikan */
    }
  };
  return [depth, set];
}

function DepthPicker({ value, onChange }: { value: Depth; onChange: (d: Depth) => void }) {
  return (
    <div className="grid gap-1.5">
      <p className="text-xs font-semibold">Seberapa teliti AI-nya?</p>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Ketelitian AI">
        {DEPTHS.map((d) => (
          <Button
            key={d.value}
            size="sm"
            variant={value === d.value ? "default" : "outline"}
            aria-pressed={value === d.value}
            onClick={() => onChange(d.value)}
          >
            {d.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{DEPTHS.find((d) => d.value === value)?.hint}</p>
    </div>
  );
}

// ------------------------------------------------------------ poin materi
export function PointsPanel({
  material,
  points,
  ai,
  onPage,
}: {
  material: Material;
  points: MaterialPoint[];
  ai: AiInfo | undefined;
  onPage: (page: number) => void;
}) {
  const qc = useQueryClient();
  const invalidate = useInvalidateData();
  const prepare = useServerFn(prepareMaterial);
  const [depth, setDepth] = useDepth();
  const [busy, setBusy] = useState(false);
  const [confirmRedo, setConfirmRedo] = useState(false);

  const done = points.filter((p) => p.understood).length;
  const allDone = points.length > 0 && done === points.length;
  const canAi = material.file_type === "pdf";
  const ready = canUseAi(ai);

  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["points"] }),
      qc.invalidateQueries({ queryKey: ["point-progress"] }),
      qc.invalidateQueries({ queryKey: ["ai-status"] }),
      invalidate(),
    ]);

  const run = async (force: boolean) => {
    setBusy(true);
    setConfirmRedo(false);
    try {
      const r = await prepare({ data: { materialId: material.id, force, depth } });
      toast.success(`${r.points} poin dan ${r.questions} soal latihan siap.`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyiapkan materi.");
      await qc.invalidateQueries({ queryKey: ["ai-status"] });
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
          AI akan membaca PDF-nya lalu memecahnya jadi 6 sampai 15 poin berurutan (dengan penjelasan
          singkat dan nomor halaman), sekaligus membuat 15 sampai 30 soal latihan. Semuanya dalam
          satu kali proses.
        </p>
        {!canAi ? (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            AI hanya bisa membaca PDF. Ubah slide PPT jadi PDF dulu, lalu unggah lagi di Materi.
          </p>
        ) : !ai?.configured ? (
          <AiNotReady />
        ) : (
          <>
            <DepthPicker value={depth} onChange={setDepth} />
            <Button className="w-fit" disabled={busy || !ready} onClick={() => void run(false)}>
              <Sparkles /> {busy ? "Membaca materi…" : "Siapkan materi dengan AI"}
            </Button>
            {busy && (
              <p className="text-sm text-muted-foreground">
                Biasanya 20 sampai 60 detik. Jangan tutup halaman ini.
              </p>
            )}
            <AiQuotaLine ai={ai} />
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

      {canAi && ai?.configured && (
        <div className="grid gap-2">
          {confirmRedo && <DepthPicker value={depth} onChange={setDepth} />}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {confirmRedo ? (
              <>
                <span className="font-semibold text-destructive">
                  Poin lama dan tanda pahammu akan hilang.
                </span>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy || !ready}
                  onClick={() => void run(true)}
                >
                  {busy ? "Membaca…" : "Buat ulang"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmRedo(false)}>
                  Batal
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                disabled={!ready}
                onClick={() => setConfirmRedo(true)}
              >
                <RotateCcw /> Buat ulang poin dan soal
              </Button>
            )}
          </div>
          <AiQuotaLine ai={ai} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ latihan soal
type Mode = "acak10" | "acak20" | "semua" | "ulang_salah" | "ulang_set";
type Run = { questions: QuizQuestion[]; mode: Mode; startedAt: number; key: number };
type Result = {
  answers: RunAnswer[];
  saved: "menyimpan" | "tersimpan" | "gagal" | null;
  cards: number;
};

export function QuizPanel({ material, ai }: { material: Material; ai: AiInfo | undefined }) {
  const qc = useQueryClient();
  const { userId } = useSession();
  const invalidate = useInvalidateData();
  const generate = useServerFn(generateQuiz);
  const attempts = useQuizAttempts(material.id);
  const [depth, setDepth] = useDepth();
  const questions = useMemo(() => readStoredQuiz(material.quiz), [material.quiz]);
  const [busy, setBusy] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const runKey = useRef(0);
  const ready = canUseAi(ai);

  // Mulai satu latihan dari daftar soal. Soal dari riwayat tidak bergantung pada soal yang sekarang tersimpan di materi.
  const startFromQuestions = (list: QuizQuestion[], mode: Mode) => {
    setResult(null);
    setRun({ questions: list, mode, startedAt: Date.now(), key: ++runKey.current });
  };
  const startIndexes = (indexes: number[], mode: Mode) =>
    startFromQuestions(
      indexes.map((i) => questions[i]!),
      mode,
    );
  const all = questions.map((_, i) => i);

  // soal baru dari server: kembali ke menu
  useEffect(() => {
    setRun(null);
    setResult(null);
  }, [questions]);

  // Simpan hasil ke riwayat (semua soal dan pilihanmu, supaya bisa ditinjau lagi) dan perbarui kartu hafalan berjarak.
  const finish = async (answers: RunAnswer[]) => {
    if (!run) return;
    const { mode, startedAt } = run;
    setRun(null);
    setResult({ answers, saved: userId ? "menyimpan" : null, cards: 0 });
    if (!userId) return;
    const payload = buildAttemptPayload(answers);
    const { error } = await supabase.from("quiz_attempts").insert({
      user_id: userId,
      material_id: material.id,
      mode,
      duration_seconds: Math.max(Math.round((Date.now() - startedAt) / 1000), 0),
      ...payload,
    });
    if (error) {
      setResult((r) => (r ? { ...r, saved: "gagal" } : r));
      toast.error(`Hasil belum tersimpan di riwayat: ${error.message}`);
      return;
    }
    let cards = 0;
    try {
      cards = await recordAnswers(userId, material.id, answers);
    } catch (e) {
      toast.error(`Kartu hafalan belum diperbarui: ${e instanceof Error ? e.message : "gagal"}`);
    }
    setResult((r) => (r ? { ...r, saved: "tersimpan", cards } : r));
    await Promise.all(
      ["quiz-attempts", "quiz-summary", "due-count", "due-cards", "card-totals"].map((k) =>
        qc.invalidateQueries({ queryKey: [k] }),
      ),
    );
  };

  const make = async () => {
    setBusy(true);
    try {
      const r = await generate({ data: { materialId: material.id, depth } });
      toast.success(`${r.count} soal baru siap.`);
      await Promise.all([invalidate(), qc.invalidateQueries({ queryKey: ["ai-status"] })]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuat soal.");
      await qc.invalidateQueries({ queryKey: ["ai-status"] });
    } finally {
      setBusy(false);
    }
  };

  const generator = (label: string) =>
    !ai?.configured ? (
      <AiNotReady />
    ) : (
      <div className="grid gap-2">
        <DepthPicker value={depth} onChange={setDepth} />
        <Button
          className="w-fit"
          variant={questions.length ? "outline" : "default"}
          disabled={busy || !ready}
          onClick={() => void make()}
        >
          <Sparkles /> {busy ? "Membuat soal…" : label}
        </Button>
        {busy && (
          <p className="text-sm text-muted-foreground">
            Biasanya 20 sampai 60 detik. Jangan tutup halaman ini.
          </p>
        )}
        <AiQuotaLine ai={ai} />
        <p className="text-xs text-muted-foreground">{PRIVACY}</p>
      </div>
    );

  const history = (
    <section className="grid gap-3 border-t border-border pt-4" aria-label="Riwayat latihan">
      <h3 className="font-display text-xl font-bold">Riwayat latihan</h3>
      {attempts.isError ? (
        <p className="text-sm text-destructive">Gagal memuat riwayat: {attempts.error.message}</p>
      ) : (
        <QuizHistory attempts={attempts.data ?? []} onRetake={startFromQuestions} />
      )}
    </section>
  );

  // ---- mengerjakan
  if (run)
    return (
      <QuizRunner
        key={run.key}
        questions={run.questions}
        onFinish={(a) => void finish(a)}
        onExit={() => setRun(null)}
      />
    );

  // ---- hasil
  if (result) {
    const total = result.answers.length;
    const wrong = result.answers.filter((a) => a.pickedIndex !== a.q.answerIndex);
    const score = total - wrong.length;
    const pctScore = Math.round((score / total) * 100);
    return (
      <div className="grid gap-3 text-center">
        <p className="font-display text-5xl font-bold">
          {score}/{total}
        </p>
        <p className="text-sm text-muted-foreground">
          {pctScore >= 80
            ? "Mantap, kamu sudah paham materi ini."
            : pctScore >= 50
              ? "Lumayan. Ulas poin yang masih ragu, lalu coba lagi."
              : "Baca lagi poin-poin materinya, lalu ulangi latihan."}
        </p>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {result.saved === "menyimpan"
            ? "Menyimpan ke riwayat…"
            : result.saved === "tersimpan"
              ? `Tersimpan di riwayat.${wrong.length > 0 ? " Soal yang salah akan muncul lagi di Ulang berjarak." : ""}`
              : result.saved === "gagal"
                ? "Belum tersimpan di riwayat."
                : !userId
                  ? "Masuk supaya hasilnya tersimpan di riwayat."
                  : ""}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {wrong.length > 0 && (
            <Button
              onClick={() =>
                startFromQuestions(
                  wrong.map((w) => w.q),
                  "ulang_salah",
                )
              }
            >
              <RotateCcw /> Ulangi yang salah ({wrong.length})
            </Button>
          )}
          <Button variant="outline" onClick={() => setResult(null)}>
            Tinjau di riwayat
          </Button>
        </div>
      </div>
    );
  }

  // ---- belum ada soal (riwayat lama tetap bisa ditinjau)
  if (questions.length === 0) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">
            Belum ada soal. Tombol <strong>Siapkan materi dengan AI</strong> di tab Poin materi
            membuat poin dan soal sekaligus. Kamu juga bisa membuat soalnya saja di sini.
          </p>
          {material.file_type !== "pdf" ? (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              AI hanya bisa membaca PDF.
            </p>
          ) : (
            generator("Buat soal latihan")
          )}
        </div>
        {(attempts.data?.length ?? 0) > 0 && history}
      </div>
    );
  }

  // ---- menu: pilih berapa soal
  const sizes = [10, 20].filter((n) => n < questions.length);
  return (
    <div className="grid gap-5">
      <div className="grid gap-4">
        <div>
          <p className="font-display text-3xl font-bold">{questions.length} soal</p>
          <p className="text-sm text-muted-foreground">
            Urutan soal dan pilihan jawabannya diacak tiap kali kamu mulai. Hasil tiap latihan
            tersimpan di riwayat dan bisa kamu tinjau lagi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {sizes.map((n) => (
            <Button
              key={n}
              variant="outline"
              onClick={() => startIndexes(shuffle(all).slice(0, n), n === 10 ? "acak10" : "acak20")}
            >
              <Shuffle /> {n} soal acak
            </Button>
          ))}
          <Button onClick={() => startIndexes(all, "semua")}>Semua {questions.length} soal</Button>
        </div>
        {material.file_type === "pdf" && generator("Buat soal baru")}
      </div>
      {history}
    </div>
  );
}

// ------------------------------------------------------------ catatan
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
