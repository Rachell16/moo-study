import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Sesi login dibaca di browser saja; sebelum siap, `loading` bernilai true.
export function useSession() {
  const [state, setState] = useState<{ loading: boolean; userId: string | null }>({
    loading: true,
    userId: null,
  });
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setState({ loading: false, userId: data.session?.user.id ?? null }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setState({ loading: false, userId: session?.user.id ?? null }),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}
