import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { rankByImpact, summarizeCourse, type GradeComponent } from "@/lib/grade-calc";

export type GradeRow = Database["public"]["Tables"]["grade_components"]["Row"];

export function useGradeComponents(userId: string | null) {
  return useQuery({
    queryKey: ["grade-components", userId],
    enabled: !!userId,
    queryFn: async (): Promise<GradeRow[]> => {
      const { data, error } = await supabase.from("grade_components").select("*").order("position");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export const toComponent = (r: GradeRow): GradeComponent => ({
  id: r.id,
  name: r.name,
  weightPercent: Number(r.weight_percent),
  score: r.score === null ? null : Number(r.score),
});

// Kelompokkan baris database mentah per mata kuliah — dipakai GradeEditor (butuh id, weight_percent, dst apa adanya).
export function groupRowsByCourse(rows: GradeRow[]): Map<string, GradeRow[]> {
  const map = new Map<string, GradeRow[]>();
  for (const r of rows) map.set(r.course_id, [...(map.get(r.course_id) ?? []), r]);
  return map;
}

// Kelompokkan lalu ubah ke bentuk ringkas, siap dipakai summarizeCourse / rankByImpact.
export function groupByCourse(rows: GradeRow[]): Map<string, GradeComponent[]> {
  const map = new Map<string, GradeComponent[]>();
  for (const r of rows) map.set(r.course_id, [...(map.get(r.course_id) ?? []), toComponent(r)]);
  return map;
}

export { rankByImpact, summarizeCourse };
