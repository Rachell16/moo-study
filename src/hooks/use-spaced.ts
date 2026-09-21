import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { endOfToday, hashQuestion, nextState, planCardUpdates } from "@/lib/spaced";
import { readStoredQuiz, type QuizQuestion } from "@/lib/study-ai";

export type ReviewCard = Database["public"]["Tables"]["review_cards"]["Row"];

// Soal di dalam kartu (dibaca dengan aman dari JSON).
export const cardQuestion = (c: ReviewCard): QuizQuestion | null =>
  readStoredQuiz([c.question])[0] ?? null;

// Jumlah kartu yang jatuh tempo sampai akhir hari ini.
export function useDueCount(userId: string | null) {
  return useQuery({
    queryKey: ["due-count", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("review_cards")
        .select("id", { count: "exact", head: true })
        .lt("due_at", endOfToday(new Date()).toISOString());
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
  });
}

export function useDueCards(userId: string | null) {
  return useQuery({
    queryKey: ["due-cards", userId],
    enabled: !!userId,
    queryFn: async (): Promise<ReviewCard[]> => {
      const { data, error } = await supabase
        .from("review_cards")
        .select("*")
        .lt("due_at", endOfToday(new Date()).toISOString())
        .order("box")
        .order("due_at")
        .limit(200);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

// Total kartu per materi (untuk ringkasan di halaman Belajar).
export function useCardTotals(userId: string | null) {
  return useQuery({
    queryKey: ["card-totals", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from("review_cards").select("box,due_at").limit(5000);
      if (error) throw new Error(error.message);
      const limit = endOfToday(new Date()).getTime();
      const later = data.map((c) => new Date(c.due_at).getTime()).filter((t) => t >= limit);
      return {
        total: data.length,
        mastered: data.filter((c) => c.box >= 4).length,
        nextDue: later.length ? new Date(Math.min(...later)).toISOString() : null,
      };
    },
  });
}

// Hasil latihan biasa: soal yang salah jadi kartu, dan kartu yang sudah ada ikut naik atau turun kotak.
export async function recordAnswers(
  userId: string,
  materialId: string,
  answers: { q: QuizQuestion; pickedIndex: number }[],
) {
  const hashes = [...new Set(answers.map((a) => hashQuestion(a.q.question)))];
  if (hashes.length === 0) return 0;
  const { data, error } = await supabase
    .from("review_cards")
    .select("qhash,box,correct_count,wrong_count")
    .eq("material_id", materialId)
    .in("qhash", hashes);
  if (error) throw new Error(error.message);
  const updates = planCardUpdates(answers, new Map(data.map((r) => [r.qhash, r])), new Date());
  if (updates.length === 0) return 0;
  const { error: upErr } = await supabase.from("review_cards").upsert(
    updates.map((u) => ({
      user_id: userId,
      material_id: materialId,
      qhash: u.qhash,
      question: u.question,
      box: u.state.box,
      due_at: u.state.due_at,
      last_reviewed_at: u.state.last_reviewed_at,
      correct_count: u.state.correct_count,
      wrong_count: u.state.wrong_count,
    })),
    { onConflict: "user_id,material_id,qhash" },
  );
  if (upErr) throw new Error(upErr.message);
  return updates.length;
}

// Hasil sesi kartu berjarak: tiap kartu naik kotak (benar) atau kembali ke kotak 1 (salah).
export async function applyCardResults(results: { card: ReviewCard; correct: boolean }[]) {
  const now = new Date();
  const errors = await Promise.all(
    results.map(async ({ card, correct }) => {
      const s = nextState(card, correct, now);
      const { error } = await supabase
        .from("review_cards")
        .update({
          box: s.box,
          due_at: s.due_at,
          last_reviewed_at: s.last_reviewed_at,
          correct_count: s.correct_count,
          wrong_count: s.wrong_count,
        })
        .eq("id", card.id);
      return error;
    }),
  );
  const failed = errors.find(Boolean);
  if (failed) throw new Error(failed.message);
}
