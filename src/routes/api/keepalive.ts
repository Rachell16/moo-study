import { createFileRoute } from "@tanstack/react-router";

// Dipanggil terjadwal (lihat vercel.json) supaya project Supabase paket gratis tidak di-pause karena tidak ada aktivitas.
// Query paling ringan yang tersedia: hitung baris tabel courses tanpa mengambil datanya.
export const Route = createFileRoute("/api/keepalive")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Vercel Cron mengirim header ini; permintaan dari luar tanpa CRON_SECRET yang cocok ditolak,
        // supaya orang lain tidak bisa memicu query berulang-ulang ke database.
        const secret = process.env["CRON_SECRET"];
        if (secret) {
          const auth = request.headers.get("authorization");
          if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
        }
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("courses").select("id", { count: "exact", head: true }).limit(1);
          if (error) return new Response(`db error: ${error.message}`, { status: 500 });
          return new Response(`ok ${new Date().toISOString()}`, { status: 200 });
        } catch (e) {
          return new Response(`error: ${e instanceof Error ? e.message : "unknown"}`, { status: 500 });
        }
      },
    },
  },
});
