import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QuizHistory } from "@/components/quiz-history";
import { useQuizAttempts } from "@/hooks/use-quiz-history";
import type { Material } from "@/lib/schedule-utils";
import { cleanMaterialName } from "@/lib/study-plan";

// Riwayat latihan satu materi dalam dialog (dipakai di halaman Materi).
export function QuizHistoryDialog({
  material,
  onClose,
}: {
  material: Material | null;
  onClose: () => void;
}) {
  const attempts = useQuizAttempts(material?.id ?? null);
  return (
    <Dialog open={!!material} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Riwayat latihan</DialogTitle>
          <DialogDescription>{material ? cleanMaterialName(material.name) : ""}</DialogDescription>
        </DialogHeader>
        {attempts.isError ? (
          <p className="text-sm text-destructive">Gagal memuat riwayat: {attempts.error.message}</p>
        ) : attempts.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat riwayat…</p>
        ) : (
          <QuizHistory attempts={attempts.data ?? []} />
        )}
      </DialogContent>
    </Dialog>
  );
}
