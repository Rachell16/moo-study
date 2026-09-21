import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock3, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NotesPanel, PointsPanel, QuizPanel } from "@/components/room-panels";
import { PaperCard, StudyShell } from "@/components/study-shell";
import { useCourses, useMaterials } from "@/hooks/use-schedules";
import { useAiStatus, usePoints } from "@/hooks/use-study";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { BUCKET, openMaterial } from "@/lib/materials";
import { cleanMaterialName } from "@/lib/study-plan";

export const Route = createFileRoute("/belajar/$id")({
  head: () => ({
    meta: [
      { title: "Ruang belajar — Moo Study" },
      { name: "description", content: "Baca materi, pelajari poin-poinnya, dan berlatih soal." },
      { property: "og:title", content: "Ruang belajar — Moo Study" },
      {
        property: "og:description",
        content: "Baca materi, pelajari poin-poinnya, dan berlatih soal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RoomPage,
});

type Tab = "poin" | "soal" | "catatan";
const TABS: { id: Tab; label: string }[] = [
  { id: "poin", label: "Poin materi" },
  { id: "soal", label: "Latihan soal" },
  { id: "catatan", label: "Catatanku" },
];

function RoomPage() {
  const { id } = Route.useParams();
  const { loading, userId } = useSession();
  const materials = useMaterials(userId);
  const courses = useCourses(userId);
  const points = usePoints(userId ? id : null);
  const ai = useAiStatus(userId);

  const material = materials.data?.find((m) => m.id === id);
  const course = courses.data?.find((c) => c.id === material?.course_id);
  const isPdf = material?.file_type === "pdf";

  const pdf = useQuery({
    queryKey: ["pdf-url", id],
    enabled: !!material && isPdf,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(material!.storage_path, 3600);
      if (error || !data) throw new Error(error?.message ?? "File tidak ditemukan.");
      return data.signedUrl;
    },
  });

  const [tab, setTab] = useState<Tab>("poin");
  const [page, setPage] = useState<number | null>(null);

  const openFile = async () => {
    if (!material) return;
    try {
      await openMaterial(material);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal membuka file.");
    }
  };

  return (
    <StudyShell title="Ruang belajar" kicker={course ? `${course.code} ${course.name}` : "Belajar"}>
      {loading ? null : !userId ? (
        <PaperCard className="mx-auto max-w-lg text-center">
          <h2 className="font-display text-2xl font-bold">
            Masuk dulu untuk membuka ruang belajar
          </h2>
          <Button asChild className="mt-5">
            <Link to="/auth">Masuk atau buat akun</Link>
          </Button>
        </PaperCard>
      ) : !material ? (
        <PaperCard>
          {materials.isSuccess ? (
            <>
              <p className="font-semibold">Materi ini tidak ditemukan.</p>
              <Button asChild className="mt-4" variant="outline">
                <Link to="/belajar">
                  <ArrowLeft /> Kembali ke ruang belajar
                </Link>
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Memuat materi…</p>
          )}
        </PaperCard>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Button asChild variant="ghost" size="sm" className="-ml-3">
                <Link to="/belajar">
                  <ArrowLeft /> Ruang belajar
                </Link>
              </Button>
              <h2 className="font-display text-2xl font-bold leading-tight">
                {cleanMaterialName(material.name)}
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {course && <span className={`tag tone-${course.color}`}>{course.code}</span>}
                <span>
                  {material.material_type === "praktikum" ? "Praktikum" : "Kuliah"},{" "}
                  {material.exam_scope.toUpperCase()}
                </span>
                {material.reviewed_at && <span className="tag">sudah di-review</span>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void openFile()}>
                <ExternalLink /> Buka file
              </Button>
              <Button asChild>
                <Link to="/timer">
                  <Clock3 /> Mulai fokus
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:h-[max(26rem,calc(100dvh-17rem))] md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <PaperCard className="hidden min-h-0 flex-col p-2 md:flex">
              {!isPdf ? (
                <p className="p-6 text-sm text-muted-foreground">
                  Pratinjau hanya tersedia untuk PDF. Klik “Buka file” untuk membuka slide ini.
                </p>
              ) : pdf.isError ? (
                <p className="p-6 text-sm text-destructive">
                  Gagal memuat PDF: {pdf.error.message}
                </p>
              ) : pdf.data ? (
                <iframe
                  key={page ?? 0}
                  title={material.name}
                  src={`${pdf.data}#page=${page ?? 1}`}
                  className="min-h-0 w-full flex-1 rounded-md border border-border bg-background"
                />
              ) : (
                <p className="p-6 text-sm text-muted-foreground">Memuat PDF…</p>
              )}
              {pdf.data && (
                <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
                  Kalau PDF tidak muncul di sini, klik “Buka file” di kanan atas.
                </p>
              )}
            </PaperCard>

            <PaperCard className="flex min-h-0 min-w-0 flex-col md:overflow-hidden">
              <div
                className="mb-4 flex shrink-0 flex-wrap gap-1 rounded-md bg-muted p-1"
                role="tablist"
                aria-label="Bagian ruang belajar"
              >
                {TABS.map((t) => (
                  <Button
                    key={t.id}
                    role="tab"
                    aria-selected={tab === t.id}
                    size="sm"
                    variant={tab === t.id ? "default" : "ghost"}
                    onClick={() => setTab(t.id)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
              <div className="md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
                {tab === "poin" && (
                  <PointsPanel
                    material={material}
                    points={points.data ?? []}
                    ai={ai.data}
                    onPage={(p) => {
                      setPage(p);
                      if (window.matchMedia("(max-width: 767px)").matches) void openFile();
                    }}
                  />
                )}
                {tab === "soal" && <QuizPanel material={material} ai={ai.data} />}
                {tab === "catatan" && <NotesPanel key={material.id} material={material} />}
              </div>
            </PaperCard>
          </div>
        </>
      )}
    </StudyShell>
  );
}
