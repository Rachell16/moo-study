import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { summarize, type Summary } from "@/lib/quiz-history";

export type QuizAttempt = Database["public"]["Tables"]["quiz_attempts"]["Row"];

// Riwayat latihan satu materi, terbaru di atas.
export function useQuizAttempts(materialId: string | null) {
  return useQuery({
    queryKey: ["quiz-attempts", materialId],
    enabled: !!materialId,
    queryFn: async (): Promise<QuizAttempt[]> => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("*")
        .eq("material_id", materialId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

// Ringkasan per materi untuk daftar Materi dan Ruang belajar.
export function useQuizSummaries(userId: string | null) {
  return useQuery({
    queryKey: ["quiz-summary", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id,material_id,score,total,mode,created_at")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      const groups = new Map<string, typeof data>();
      for (const row of data)
        groups.set(row.material_id, [...(groups.get(row.material_id) ?? []), row]);
      const out = new Map<string, Summary>();
      for (const [id, rows] of groups) {
        const s = summarize(rows.map((r) => ({ ...r, duration_seconds: null, wrong: [] })));
        if (s) out.set(id, s);
      }
      return out;
    },
  });
}
