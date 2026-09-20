import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// File *.functions.ts ikut ke bundle browser, jadi modul server dimuat lewat import() di dalam handler.

export const getGoogleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { googleConfigured } = await import("./google.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("google_connections")
      .select("google_email,last_synced_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      configured: googleConfigured(),
      connected: !!data,
      email: data?.google_email ?? null,
      lastSyncedAt: data?.last_synced_at ?? null,
    };
  });

export const startGoogleConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ origin: z.string().url() }))
  .handler(async ({ context, data }) => {
    const { buildAuthUrl } = await import("./google.server");
    return { url: await buildAuthUrl(new URL(data.origin).origin, context.userId) };
  });

export const disconnectGoogle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { revokeConnection } = await import("./google.server");
    await revokeConnection(context.userId);
    return { ok: true };
  });

export const syncCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncForUser } = await import("./google.server");
    return await syncForUser(context.supabase, context.userId);
  });

// Hapus jadwal; kalau sudah pernah terkirim ke Google, event-nya ikut dihapus di sana.
export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("schedules")
      .select("id,google_event_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { ok: true };
    if (row.google_event_id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: conn } = await supabaseAdmin
        .from("google_connections")
        .select("user_id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (conn) {
        const { deleteGoogleEvent } = await import("./google.server");
        await deleteGoogleEvent(context.userId, row.google_event_id);
      }
    }
    const { error: delErr } = await context.supabase.from("schedules").delete().eq("id", data.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });
