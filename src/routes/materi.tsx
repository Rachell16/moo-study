import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen,
  Check,
  FileText,
  History,
  Pencil,
  Presentation,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MaterialDialog } from "@/components/material-dialog";
import { QuizHistoryDialog } from "@/components/quiz-history-dialog";
import { useQuizSummaries } from "@/hooks/use-quiz-history";
import type { Summary } from "@/lib/quiz-history";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { useCourses, useInvalidateData, useMaterials } from "@/hooks/use-schedules";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  BUCKET,
  deleteMaterial,
  fmtSize,
  isReviewed,
  openMaterial,
  setReviewed,
} from "@/lib/materials";
import { EXAM_KINDS, type Course, type Material } from "@/lib/schedule-utils";

export const Route = createFileRoute("/materi")({
  head: () => ({
    meta: [
      { title: "Materi — Moo Study" },
      {
        name: "description",
        content: "Simpan PDF dan slide per mata kuliah, dipisah kuliah dan praktikum.",
      },
      { property: "og:title", content: "Materi — Moo Study" },
      {
        property: "og:description",
        content: "Simpan PDF dan slide per mata kuliah, dipisah kuliah dan praktikum.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MateriPage,
});

const MAX_BYTES = 50 * 1024 * 1024;
type Filter = "semua" | "perlu" | "sudah";

function MateriPage() {
  const { loading, userId } = useSession();
  const invalidate = useInvalidateData();
  const courses = useCourses(userId);
  const materials = useMaterials(userId);
  const summaries = useQuizSummaries(userId);
  const [historyFor, setHistoryFor] = useState<Material | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const [courseId, setCourseId] = useState("");
  const [type, setType] = useState("kuliah");
  const [scope, setScope] = useState("uts");
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("semua");
  const [editing, setEditing] = useState<Material | null>(null);

  const courseList = useMemo(() => courses.data ?? [], [courses.data]);
  const all = useMemo(() => materials.data ?? [], [materials.data]);

  const upload = async (files: FileList | null) => {
    if (!files?.length || !userId) return;
    setUploading(true);
    const course = courseList.find((c) => c.id === courseId);
    let ok = 0;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!["pdf", "ppt", "pptx"].includes(ext)) {
        toast.error(`${file.name}: gunakan file PDF, PPT, atau PPTX.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: ukuran maksimal 50 MB.`);
        continue;
      }
      const safe = file.name.replace(/[^\w.\- ]+/g, "_");
      const path = `${userId}/${crypto.randomUUID()}-${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file);
      if (up.error) {
        toast.error(`${file.name}: ${up.error.message}`);
        continue;
      }
      const { error } = await supabase.from("materials").insert({
        user_id: userId,
        course_id: courseId || null,
        name: file.name,
        storage_path: path,
        file_type: ext,
        material_type: type,
        exam_scope: scope,
        semester: course?.semester ?? 1,
        size_bytes: file.size,
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]); // jangan tinggalkan file yatim
        toast.error(`${file.name}: ${error.message}`);
        continue;
      }
      ok++;
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (ok) toast.success(`${ok} materi tersimpan.`);
    await invalidate();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((m) => {
      if (filter === "perlu" && isReviewed(m)) return false;
      if (filter === "sudah" && !isReviewed(m)) return false;
      if (!q) return true;
      const cname = courseList.find((c) => c.id === m.course_id)?.name ?? "";
      return m.name.toLowerCase().includes(q) || cname.toLowerCase().includes(q);
    });
  }, [all, courseList, query, filter]);

  const filtering = filter !== "semua" || query.trim() !== "";
  const pendingCount = all.filter((m) => !isReviewed(m)).length;

  const sections: { key: string; course: Course | null; items: Material[] }[] = [
    ...courseList.map((c) => ({
      key: c.id,
      course: c,
      items: filtered.filter((m) => m.course_id === c.id),
    })),
    {
      key: "none",
      course: null,
      items: filtered.filter((m) => !m.course_id || !courseList.some((c) => c.id === m.course_id)),
    },
  ].filter((s) => (s.course ? !filtering || s.items.length > 0 : s.items.length > 0));

  const toggleReview = async (m: Material) => {
    try {
      await setReviewed(m.id, !isReviewed(m));
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
    }
  };

  const remove = async (m: Material) => {
    try {
      await deleteMaterial(m);
      toast.success("Materi dihapus.");
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus materi.");
    }
  };

  const open = async (m: Material) => {
    try {
      await openMaterial(m);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuka file.");
    }
  };

  return (
    <StudyShell title="Materi kuliah & praktikum" kicker="Lumbung ilmu">
      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">Masuk dulu untuk menyimpan materi</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            File tersimpan privat, hanya bisa dibuka olehmu.
          </p>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : (
        <>
          <PaperCard className="mb-5 border-dashed bg-secondary/60">
            <div className="flex flex-wrap items-start gap-4">
              <BookOpen className="mt-1 h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-2xl font-bold">Unggah materi</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pilih mata kuliah, kuliah atau praktikum, dan untuk ujian mana. File baru otomatis
                  masuk “perlu di-review”.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Mata kuliah
                    <select
                      className="field w-full"
                      value={courseId}
                      onChange={(e) => setCourseId(e.target.value)}
                    >
                      <option value="">Belum dikategorikan</option>
                      {courseList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Jenis
                    <select
                      className="field w-full"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    >
                      <option value="kuliah">Kuliah</option>
                      <option value="praktikum">Praktikum</option>
                    </select>
                  </label>
                  <label className="grid gap-1.5 text-sm font-semibold">
                    Untuk ujian
                    <select
                      className="field w-full"
                      value={scope}
                      onChange={(e) => setScope(e.target.value)}
                    >
                      {EXAM_KINDS.map((k) => (
                        <option key={k.value} value={k.value}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.ppt,.pptx"
                  className="hidden"
                  onChange={(e) => void upload(e.target.files)}
                />
                <Button
                  className="mt-4"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  <UploadCloud /> {uploading ? "Mengunggah…" : "Pilih file"}
                </Button>
                {courses.isSuccess && courseList.length === 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Belum ada mata kuliah, jadi file masuk “belum dikategorikan”.{" "}
                    <Link to="/jadwal" className="font-semibold text-primary underline">
                      Impor jadwal kuliah
                    </Link>{" "}
                    untuk mengisinya.
                  </p>
                )}
              </div>
            </div>
          </PaperCard>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                className="field w-full"
                style={{ paddingLeft: "2.5rem" }}
                placeholder="Cari judul atau mata kuliah..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div
              className="flex gap-1 rounded-md bg-muted p-1"
              role="group"
              aria-label="Filter status review"
            >
              {(
                [
                  ["semua", `Semua (${all.length})`],
                  ["perlu", `Perlu review (${pendingCount})`],
                  ["sudah", `Sudah (${all.length - pendingCount})`],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  size="sm"
                  variant={filter === value ? "default" : "ghost"}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {materials.isError && (
            <p className="text-sm font-semibold text-destructive">
              Gagal memuat materi: {materials.error.message}
            </p>
          )}

          <div className="grid gap-5 grid-cols-[minmax(0,1fr)]">
            {sections.map(({ key, course, items }) => (
              <CourseSection
                key={key}
                course={course}
                items={items}
                onOpen={(m) => void open(m)}
                onToggle={(m) => void toggleReview(m)}
                onEdit={setEditing}
                onDelete={(m) => void remove(m)}
                summaries={summaries.data}
                onHistory={setHistoryFor}
              />
            ))}
          </div>

          {materials.isSuccess && all.length === 0 && courseList.length === 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              Belum ada materi. Unggah file pertamamu di atas.
            </p>
          )}
          {filtering && sections.length === 0 && (
            <p className="text-sm text-muted-foreground">Tidak ada materi yang cocok.</p>
          )}

          <QuizHistoryDialog material={historyFor} onClose={() => setHistoryFor(null)} />
          <MaterialDialog
            material={editing}
            courses={courseList}
            onClose={() => setEditing(null)}
            onChanged={(m) => {
              toast.success(m);
              void invalidate();
            }}
          />
        </>
      )}
    </StudyShell>
  );
}

function CourseSection({
  course,
  items,
  onOpen,
  onToggle,
  onEdit,
  onDelete,
  summaries,
  onHistory,
}: {
  course: Course | null;
  items: Material[];
  onOpen: (m: Material) => void;
  onToggle: (m: Material) => void;
  onEdit: (m: Material) => void;
  onDelete: (m: Material) => void;
  summaries: Map<string, Summary> | undefined;
  onHistory: (m: Material) => void;
}) {
  const pending = items.filter((m) => !isReviewed(m)).length;
  return (
    <PaperCard>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="section-kicker">{course ? course.code : "Lainnya"}</p>
          <h2 className="font-display text-2xl font-bold">
            {course ? course.name : "Belum dikategorikan"}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {items.length} materi
          {pending ? `, ${pending} perlu di-review` : items.length ? ", semua sudah di-review" : ""}
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {(["kuliah", "praktikum"] as const).map((kind) => {
          const list = items.filter((m) => m.material_type === kind);
          return (
            <div key={kind} className="min-w-0">
              <h3 className="mb-2 text-sm font-bold">
                {kind === "kuliah" ? "Kuliah" : "Praktikum"}
              </h3>
              {list.length === 0 ? (
                <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
                  Belum ada materi {kind}.
                </p>
              ) : (
                <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
                  {list.map((m) => (
                    <MaterialRow
                      key={m.id}
                      m={m}
                      onOpen={() => onOpen(m)}
                      onToggle={() => onToggle(m)}
                      onEdit={() => onEdit(m)}
                      onDelete={() => onDelete(m)}
                      summary={summaries?.get(m.id)}
                      onHistory={() => onHistory(m)}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </PaperCard>
  );
}

function MaterialRow({
  m,
  onOpen,
  onToggle,
  onEdit,
  onDelete,
  summary,
  onHistory,
}: {
  m: Material;
  onOpen: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  summary: Summary | undefined;
  onHistory: () => void;
}) {
  const reviewed = isReviewed(m);
  const [confirming, setConfirming] = useState(false);
  const Icon = m.file_type === "pdf" ? FileText : Presentation;
  return (
    <li className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border bg-background p-2.5">
      <div
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${m.file_type === "pdf" ? "bg-study-sage" : "bg-study-pink"}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1 basis-40">
        <button
          type="button"
          onClick={onOpen}
          className="block max-w-full truncate text-left text-sm font-semibold hover:underline"
          title={m.name}
        >
          {m.name}
        </button>
        <p className="text-xs text-muted-foreground">
          {m.exam_scope.toUpperCase()}, {fmtSize(m.size_bytes)}
        </p>
        {summary && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            Latihan: {summary.last !== null ? `terakhir ${summary.last}%` : `${summary.count} kali`}
            {summary.best !== null && summary.count > 1 ? `, terbaik ${summary.best}%` : ""}
            {summary.last !== null ? `, ${summary.count} kali` : ""}
          </p>
        )}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        {confirming ? (
          <>
            <span className="text-xs font-semibold text-destructive">Hapus file ini?</span>
            <Button variant="destructive" size="sm" onClick={onDelete}>
              Hapus
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Batal
            </Button>
          </>
        ) : (
          <>
            <Button
              variant={reviewed ? "secondary" : "outline"}
              size="sm"
              onClick={onToggle}
              aria-pressed={reviewed}
              title={reviewed ? "Klik untuk kembali ke perlu review" : "Klik kalau sudah di-review"}
            >
              {reviewed ? <Check /> : <span className="h-2 w-2 rounded-full bg-destructive" />}
              {reviewed ? "Sudah" : "Perlu review"}
            </Button>
            {summary && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onHistory}
                aria-label={`Riwayat latihan ${m.name}`}
                title="Riwayat latihan"
              >
                <History />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onEdit}
              aria-label={`Ubah ${m.name}`}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirming(true)}
              aria-label={`Hapus ${m.name}`}
              title="Hapus"
            >
              <Trash2 />
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
