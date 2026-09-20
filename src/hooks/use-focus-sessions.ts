import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Sesi fokus yang selesai, 400 hari terakhir: cukup untuk menghitung streak dan ringkasan hari ini.
export function useFocusSessions(userId: string | null) {
  return useQuery({
    queryKey: ["focus-sessions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const since = new Date(Date.now() - 400 * 864e5).toISOString();
      const { data, error } = await supabase
        .from("focus_sessions")
        .select("id,focus_minutes,course_id,started_at,completed_at")
        .eq("completed", true)
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(2000);
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
