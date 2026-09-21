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
type Item = { q: QuizQuestion; order: number[] }; // order: urutan tampil opsi (diacak)
type Mode = "acak10" | "acak20" | "semua" | "ulang_salah" | "ulang_set";
type Answer = { q: QuizQuestion; pickedIndex: number };

const shuffle = <T,>(list: T[]) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

const makeItems = (list: QuizQuestion[]): Item[] =>
  shuffle(list).map((q) => ({ q, order: shuffle(q.options.map((_, i) => i)) }));

export function QuizPanel({ material, ai }: { material: Material; ai: AiInfo | undefined }) {
  const qc = useQueryClient();
  const { userId } = useSession();
  const invalidate = useInvalidateData();
  const generate = useServerFn(generateQuiz);
  const attempts = useQuizAttempts(material.id);
  const [depth, setDepth] = useDepth();
  const questions = useMemo(() => readStoredQuiz(material.quiz), [material.quiz]);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // opsi yang sedang dipilih (indeks asli), masih bisa diganti
  const [revealed, setRevealed] = useState(false); // jawaban baru terlihat setelah "Periksa jawaban"
  const [answers, setAnswers] = useState<Answer[]>([]); // jawaban yang sudah diperiksa, berurutan
  const [finished, setFinished] = useState(false);
  const [mode, setMode] = useState<Mode>("semua");
  const [saved, setSaved] = useState<"menyimpan" | "tersimpan" | "gagal" | null>(null);
  const runStart = useRef(0);
  const ready = canUseAi(ai);
  const wrong = answers.filter((a) => a.pickedIndex !== a.q.answerIndex);

  // Mulai satu latihan dari daftar soal. Soal dari riwayat tidak bergantung pada soal yang sekarang tersimpan di materi.
  const startFromQuestions = (list: QuizQuestion[], m: Mode) => {
    setItems(makeItems(list));
    setMode(m);
    setIndex(0);
    setPicked(null);
    setRevealed(false);
    setAnswers([]);
    setFinished(false);
    setSaved(null);
    runStart.current = Date.now();
  };
  const startIndexes = (indexes: number[], m: Mode) =>
    startFromQuestions(
      indexes.map((i) => questions[i]!),
      m,
    );
  const all = questions.map((_, i) => i);
  const backToMenu = () => {
    setItems([]);
    setFinished(false);
  };

  // soal baru dari server: kembali ke menu
  useEffect(() => {
    setItems([]);
    setFinished(false);
  }, [questions]);

  // Simpan hasil ke riwayat, lengkap dengan semua soal dan pilihanmu supaya bisa ditinjau lagi nanti.
  const finish = async (final: Answer[]) => {
    setFinished(true);
    if (!userId) return;
    setSaved("menyimpan");
    const payload = buildAttemptPayload(final);
    const { error } = await supabase.from("quiz_attempts").insert({
      user_id: userId,
      material_id: material.id,
      mode,
      duration_seconds: Math.max(Math.round((Date.now() - runStart.current) / 1000), 0),
      ...payload,
    });
    if (error) {
      setSaved("gagal");
      toast.error(`Hasil belum tersimpan di riwayat: ${error.message}`);
      return;
    }
    setSaved("tersimpan");
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["quiz-attempts"] }),
      qc.invalidateQueries({ queryKey: ["quiz-summary"] }),
    ]);
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

  // ---- belum ada soal (riwayat lama tetap bisa ditinjau)
  if (questions.length === 0 && items.length === 0) {
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
  if (items.length === 0) {
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
                onClick={() =>
                  startIndexes(shuffle(all).slice(0, n), n === 10 ? "acak10" : "acak20")
                }
              >
                <Shuffle /> {n} soal acak
              </Button>
            ))}
            <Button onClick={() => startIndexes(all, "semua")}>
              Semua {questions.length} soal
            </Button>
          </div>
          {material.file_type === "pdf" && generator("Buat soal baru")}
        </div>
        {history}
      </div>
    );
  }

  // ---- hasil
  if (finished) {
    const total = items.length;
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
          {saved === "menyimpan"
            ? "Menyimpan ke riwayat…"
            : saved === "tersimpan"
              ? "Tersimpan di riwayat."
              : saved === "gagal"
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
          <Button variant="outline" onClick={backToMenu}>
            Tinjau di riwayat
          </Button>
        </div>
      </div>
    );
  }

  // ---- mengerjakan
  const item = items[index]!;
  const answered = revealed;
  const correct = item.q.answerIndex;
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-muted-foreground">
          Soal {index + 1} dari {items.length}
        </p>
        <Button
          size="sm"
          variant="ghost"
          onClick={backToMenu}
          title="Latihan yang belum selesai tidak dicatat di riwayat"
        >
          Selesai
        </Button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className="h-full bg-primary" style={{ width: `${(index / items.length) * 100}%` }} />
      </div>
      <p className="font-display text-xl font-bold leading-snug">{item.q.question}</p>
      <div className="grid gap-2" role="group" aria-label="Pilihan jawaban">
        {item.order.map((optIndex, shown) => {
          const right = optIndex === correct;
          const chosen = optIndex === picked;
          const state = !answered
            ? chosen
              ? "border-primary bg-secondary ring-2 ring-primary/40"
              : "border-border bg-background hover:bg-secondary"
            : right
              ? "border-primary bg-secondary"
              : chosen
                ? "border-destructive bg-destructive/10"
                : "border-border bg-background opacity-70";
          return (
            <button
              key={optIndex}
              type="button"
              disabled={answered}
              aria-pressed={!answered && chosen}
              onClick={() => setPicked(optIndex)}
              className={`flex items-start gap-3 rounded-md border px-3 py-2.5 text-left text-sm ${state}`}
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-xs font-bold">
                {String.fromCharCode(65 + shown)}
              </span>
              <span className="min-w-0 flex-1">{item.q.options[optIndex]}</span>
            </button>
          );
        })}
      </div>
      {!answered && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            className="w-fit"
            disabled={picked === null}
            onClick={() => {
              if (picked === null) return;
              setRevealed(true);
              setAnswers((a) => [...a, { q: item.q, pickedIndex: picked }]);
            }}
          >
            Periksa jawaban
          </Button>
          <p className="text-xs text-muted-foreground">
            {picked === null
              ? "Pilih satu jawaban dulu."
              : "Kamu masih bisa mengganti pilihan sebelum memeriksa."}
          </p>
        </div>
      )}
      {answered && (
        <div className="rounded-md bg-secondary/70 p-3 text-sm">
          <p className="font-semibold">
            {picked === correct
              ? "Benar!"
              : `Kurang tepat. Jawaban yang benar: ${String.fromCharCode(65 + item.order.indexOf(correct))}.`}
          </p>
          {item.q.explanation && <p className="mt-1 leading-relaxed">{item.q.explanation}</p>}
        </div>
      )}
      {answered && (
        <Button
          className="w-fit"
          onClick={() => {
            if (index + 1 >= items.length) void finish(answers);
            else {
              setIndex(index + 1);
              setPicked(null);
              setRevealed(false);
            }
          }}
        >
          {index + 1 >= items.length ? "Lihat hasil" : "Soal berikutnya"}
        </Button>
      )}
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
