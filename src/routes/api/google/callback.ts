import { createFileRoute } from "@tanstack/react-router";

// Tujuan redirect dari Google setelah pengguna memberi izin.
// Pengguna dikenali dari `state` yang ditandatangani server, bukan dari cookie/header.
export const Route = createFileRoute("/api/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { verifyState, exchangeCode } = await import("@/lib/google.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const url = new URL(request.url);
        const state = await verifyState(url.searchParams.get("state") ?? "").catch(() => null);
        if (!state)
          return new Response(
            "Permintaan tidak valid atau sudah kedaluwarsa. Ulangi dari halaman Jadwal.",
            { status: 400 },
          );

        const back = (result: string) =>
          Response.redirect(`${state.origin}/jadwal?google=${result}`, 302);
        const code = url.searchParams.get("code");
        if (url.searchParams.get("error") || !code) return back("batal");

        try {
          const { refreshToken, email } = await exchangeCode(code, state.origin);
          const { error } = await supabaseAdmin
            .from("google_connections")
            .upsert({ user_id: state.uid, refresh_token: refreshToken, google_email: email });
          if (error) throw new Error(error.message);
          return back("ok");
        } catch (e) {
          console.error("Google callback gagal:", e);
          return back("gagal");
        }
      },
    },
  },
});
