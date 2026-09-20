import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { displayNameOf } from "@/lib/display-name";

type SessionState = { loading: boolean; userId: string | null; name: string; email: string };

const from = (session: Session | null): SessionState => ({
  loading: false,
  userId: session?.user.id ?? null,
  name: displayNameOf(session?.user),
  email: session?.user.email ?? "",
});

// Sesi login dibaca di browser saja; sebelum siap, `loading` bernilai true.
export function useSession() {
  const [state, setState] = useState<SessionState>({
    loading: true,
    userId: null,
    name: "",
    email: "",
  });
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState(from(data.session)));
    // termasuk event USER_UPDATED, jadi sapaan ikut berubah begitu nama diganti
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState(from(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}
