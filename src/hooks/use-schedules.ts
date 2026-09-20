import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Course, Material, Schedule } from "@/lib/schedule-utils";

const DATA_KEYS = ["schedules", "tasks", "exams", "materials", "courses"] as const;

// Setelah ada perubahan data, muat ulang semua daftar yang mungkin terpengaruh.
export const invalidateData = (qc: QueryClient) =>
  Promise.all(DATA_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));

export function useInvalidateData() {
  const qc = useQueryClient();
  return () => invalidateData(qc);
}

export function useSchedulesBetween(userId: string | null, from: Date, to: Date) {
  return useQuery({
    queryKey: ["schedules", userId, from.toISOString(), to.toISOString()],
    enabled: !!userId,
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .gte("starts_at", from.toISOString())
        .lt("starts_at", to.toISOString())
        .order("starts_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useCourses(userId: string | null) {
  return useQuery({
    queryKey: ["courses", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Course[]> => {
      const { data, error } = await supabase.from("courses").select("*").order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

// Semua tugas (deadline), diurutkan dari yang paling dekat.
export function useTasks(userId: string | null) {
  return useQuery({
    queryKey: ["tasks", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("activity_type", "tugas")
        .order("ends_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useExams(userId: string | null) {
  return useQuery({
    queryKey: ["exams", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Schedule[]> => {
      const { data, error } = await supabase
        .from("schedules")
        .select("*")
        .eq("activity_type", "ujian")
        .order("starts_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

export function useMaterials(userId: string | null) {
  return useQuery({
    queryKey: ["materials", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Material[]> => {
      const { data, error } = await supabase
        .from("materials")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
