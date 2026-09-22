// Hanya untuk server. Membatasi pemakaian AI per pengguna dan total per hari, supaya jatah gratis Gemini tidak habis oleh satu orang.
// Jatah gratis dihitung per project Google, dan direset tiap tengah malam waktu Pasifik (zona bisa diubah lewat AI_RESET_TZ).

export type QuotaStore = {
  count(since: Date, userId?: string): Promise<number>;
  add(userId: string, kind: string): Promise<string>;
  remove(id: string): Promise<void>;
  prune(before: Date): Promise<void>;
};

export type Limits = { perUser: number; global: number };

export type Quota = {
  used: number; // pemakaian akun ini hari ini
  limit: number; // batas per akun
  globalUsed: number;
  globalLimit: number;
  remaining: number; // sisa yang benar-benar bisa dipakai akun ini
  resetsAt: string; // ISO
};

const int = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
};

// Bawaan: 8 per akun dan 18 total. Jatah Gemini gratis project ini 20 per hari, sisanya untuk percobaan manual di AI Studio.
export const limitsFromEnv = (): Limits => ({
  perUser: int(process.env["AI_DAILY_LIMIT_PER_USER"], 8),
  global: int(process.env["AI_DAILY_LIMIT_GLOBAL"], 18),
});

export const resetZone = () => process.env["AI_RESET_TZ"] || "America/Los_Angeles";

// Awal "hari" di zona reset (tengah malam di zona itu), sebagai waktu absolut.
export function dayStart(now: Date, tz: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const sinceMidnight = get("hour") * 3600 + get("minute") * 60 + get("second");
  return new Date(now.getTime() - sinceMidnight * 1000 - now.getMilliseconds());
}

export async function readQuota(
  store: QuotaStore,
  userId: string,
  limits: Limits,
  now = new Date(),
  tz = resetZone(),
): Promise<Quota> {
  const start = dayStart(now, tz);
  const [used, globalUsed] = await Promise.all([store.count(start, userId), store.count(start)]);
  return {
    used,
    limit: limits.perUser,
    globalUsed,
    globalLimit: limits.global,
    remaining: Math.max(Math.min(limits.perUser - used, limits.global - globalUsed), 0),
    resetsAt: new Date(start.getTime() + 24 * 3600 * 1000).toISOString(),
  };
}

export class QuotaError extends Error {}

const clock = (iso: string) => new Date(iso).toISOString().slice(11, 16);

// Catat dulu, baru hitung: dua klik bersamaan tidak bisa sama-sama lolos. Kalau ternyata melebihi batas, catatan dibatalkan.
export async function reserve(
  store: QuotaStore,
  userId: string,
  kind: string,
  limits: Limits,
  now = new Date(),
  tz = resetZone(),
): Promise<{ id: string; quota: Quota }> {
  const before = await readQuota(store, userId, limits, now, tz);
  if (before.used >= before.limit) {
    throw new QuotaError(
      `Jatah AI-mu hari ini habis (${before.limit} kali). Reset sekitar pukul ${clock(before.resetsAt)} UTC, dan jatahmu terisi lagi.`,
    );
  }
  if (before.globalUsed >= before.globalLimit) {
    throw new QuotaError(
      "Jatah AI gratis untuk semua pengguna hari ini sudah habis. Coba lagi setelah reset harian.",
    );
  }
  const id = await store.add(userId, kind);
  const after = await readQuota(store, userId, limits, now, tz);
  if (after.used > after.limit || after.globalUsed > after.globalLimit) {
    await store.remove(id);
    throw new QuotaError(
      "Jatah AI hari ini baru saja habis dipakai. Coba lagi setelah reset harian.",
    );
  }
  await store.prune(new Date(now.getTime() - 3 * 24 * 3600 * 1000)); // bersihkan catatan lama
  return { id, quota: after };
}

export async function adminStore(): Promise<QuotaStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return {
    async count(since, userId) {
      let q = supabaseAdmin
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since.toISOString());
      if (userId) q = q.eq("user_id", userId);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      return count ?? 0;
    },
    async add(userId, kind) {
      const { data, error } = await supabaseAdmin
        .from("ai_usage")
        .insert({ user_id: userId, kind })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return data.id;
    },
    async remove(id) {
      await supabaseAdmin.from("ai_usage").delete().eq("id", id);
    },
    async prune(before) {
      await supabaseAdmin.from("ai_usage").delete().lt("created_at", before.toISOString());
    },
  };
}

// Jatah dicatat sebelum memanggil Gemini; kalau panggilan gagal sebelum Gemini memproses (kunci salah, server sibuk,
// batas Google), catatannya dibatalkan supaya tidak menghabiskan jatah. Kalau Gemini sudah menjawab tapi jawabannya
// tidak terbaca (AiParseError), tetap terhitung karena permintaannya sudah benar-benar terpakai.
export async function withQuota<T>(
  userId: string,
  kind: string,
  run: () => Promise<T>,
): Promise<T> {
  const { AiParseError } = await import("./study-ai");
  const store = await adminStore();
  let slot: { id: string };
  try {
    slot = await reserve(store, userId, kind, limitsFromEnv());
  } catch (e) {
    if (e instanceof QuotaError) throw e;
    throw new Error(
      "Pencatat jatah AI belum siap. Jalankan migrasi 20260921040000_ai_usage.sql di Supabase.",
    );
  }
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof AiParseError)) await store.remove(slot.id).catch(() => undefined);
    throw e;
  }
}
