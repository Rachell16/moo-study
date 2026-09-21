import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useCourses,
  useExams,
  useMaterials,
  useSchedulesBetween,
  useTasks,
} from "@/hooks/use-schedules";
import { useServerFn } from "@tanstack/react-start";
import { getAiStatus } from "@/lib/study.functions";
import { useQuizSummaries } from "@/hooks/use-quiz-history";
import { useDueCount } from "@/hooks/use-spaced";
import { buildPlan } from "@/lib/study-plan";
import { addDays, startOfDay, ymd } from "@/lib/schedule-utils";
import type { Database } from "@/integrations/supabase/types";

export type MaterialPoint = Database["public"]["Tables"]["material_points"]["Row"];

// Poin yang sudah dipahami per materi, untuk bar progres dan rencana belajar.
export function usePointProgress(userId: string | null) {
  return useQuery({
    queryKey: ["point-progress", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_points")
        .select("material_id,understood");
      if (error) throw new Error(error.message);
      const map = new Map<string, { done: number; total: number }>();
      for (const p of data) {
        const cur = map.get(p.material_id) ?? { done: 0, total: 0 };
        cur.total++;
        if (p.understood) cur.done++;
        map.set(p.material_id, cur);
      }
      return map;
    },
  });
}

export function usePoints(materialId: string | null) {
  return useQuery({
    queryKey: ["points", materialId],
    enabled: !!materialId,
    queryFn: async (): Promise<MaterialPoint[]> => {
      const { data, error } = await supabase
        .from("material_points")
        .select("*")
        .eq("material_id", materialId!)
        .order("position");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

const EMPTY: never[] = [];

// Rencana belajar hari ini, dihitung ulang tiap 5 menit dan setiap data berubah.
export function usePlan(userId: string | null) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  const dayKey = now ? ymd(now) : "";
  const dayStart = useMemo(() => startOfDay(now ?? new Date(0)), [dayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const schedules = useSchedulesBetween(now ? userId : null, dayStart, addDays(dayStart, 2));
  const tasks = useTasks(userId);
  const exams = useExams(userId);
  const materials = useMaterials(userId);
  const courses = useCourses(userId);
  const progress = usePointProgress(userId);
  const summaries = useQuizSummaries(userId);
  const dueCount = useDueCount(userId);

  const ready =
    !!now &&
    [schedules, tasks, exams, materials, courses, progress, summaries, dueCount].every(
      (q) => q.isSuccess,
    );

  const plan = useMemo(() => {
    if (!now || !ready) return null;
    return buildPlan({
      now,
      schedules: schedules.data ?? EMPTY,
      tasks: tasks.data ?? EMPTY,
      exams: exams.data ?? EMPTY,
      materials: materials.data ?? EMPTY,
      courses: courses.data ?? EMPTY,
      progress: progress.data ?? new Map(),
      quizBest: new Map(
        [...(summaries.data ?? new Map()).entries()].flatMap(([id, s]) =>
          s.best !== null ? [[id, s.best] as [string, number]] : [],
        ),
      ),
      dueCards: dueCount.data ?? 0,
    });
  }, [
    now,
    ready,
    schedules.data,
    tasks.data,
    exams.data,
    materials.data,
    courses.data,
    progress.data,
  ]);

  return { plan, loading: !!userId && !plan, now, courses: courses.data ?? EMPTY };
}

// Status AI: kunci terpasang atau belum, dan sisa jatah hari ini.
export function useAiStatus(userId: string | null) {
  const statusFn = useServerFn(getAiStatus);
  return useQuery({
    queryKey: ["ai-status", userId],
    enabled: !!userId,
    queryFn: () => statusFn(),
    staleTime: 30 * 1000,
  });
}

export type AiInfo = NonNullable<ReturnType<typeof useAiStatus>["data"]>;

// Kunci terpasang dan masih ada jatah? (Tanpa data jatah, dianggap boleh: server yang memutuskan.)
export const canUseAi = (ai: AiInfo | undefined) =>
  !!ai?.configured && (ai.quota ? ai.quota.remaining > 0 : true);
