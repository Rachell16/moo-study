import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Poin materi untuk sekumpulan materi (satu mata kuliah), terurut per materi lalu per nomor.
export function useCoursePoints(materialIds: string[]) {
  return useQuery({
    queryKey: ["course-points", materialIds.join(",")],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_points")
        .select("material_id,position,heading,summary,page")
        .in("material_id", materialIds)
        .order("position");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

// Riwayat latihan untuk sekumpulan materi, dipakai untuk mencari soal yang sering salah.
export function useCourseAttempts(materialIds: string[]) {
  return useQuery({
    queryKey: ["course-attempts", materialIds.join(",")],
    enabled: materialIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quiz_attempts")
        .select("id,material_id,wrong,review,created_at")
        .in("material_id", materialIds)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
