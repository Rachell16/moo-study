// Hanya untuk server. Jangan diimpor dari komponen; muat lewat `await import()` di dalam handler.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { matchCourse } from "@/lib/course-aliases";

type Db = SupabaseClient<Database>;
type ScheduleRow = Database["public"]["Tables"]["schedules"]["Row"];

const SCOPES = ["https://www.googleapis.com/auth/calendar.events", "openid", "email"].join(" ");
const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const ACTIVITY_TYPES = ["kuliah", "belajar", "praktikum", "tugas", "ujian"];
const DEADLINE_PREFIX = "Deadline: ";
const PUSH_BATCH = 15; // jumlah agenda yang dikirim per panggilan sinkron
const MAX_RETRIES = 2; // ulangi permintaan yang kena batas kecepatan Google

// Google Calendar membatasi kecepatan tulis per pengguna, jadi pengiriman dibuat pelan dan berurutan.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const delays = () => ({
  between: Number(process.env["SYNC_DELAY_MS"] ?? 250),
  retry: Number(process.env["SYNC_RETRY_MS"] ?? 1000),
});

// Env dibaca per permintaan (bukan di level modul) supaya jalan di runtime edge.
function config() {
  const clientId = process.env["GOOGLE_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"];
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret, timeZone: process.env["TIMEZONE"] || "Asia/Jakarta" };
}

export const googleConfigured = () => config() !== null;

function requireConfig() {
  const c = config();
  if (!c)
    throw new Error(
      "Google Calendar belum diatur: isi secret GOOGLE_CLIENT_ID dan GOOGLE_CLIENT_SECRET.",
    );
  return c;
}

export class GoogleAuthError extends Error {}

// ---------- state OAuth (ditandatangani supaya callback tahu ini milik siapa) ----------
const enc = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey() {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(requireConfig().clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

type StatePayload = { uid: string; origin: string; exp: number };

async function signState(payload: StatePayload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyState(state: string): Promise<StatePayload | null> {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), fromB64url(sig), enc.encode(body));
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as StatePayload;
  return payload.exp > Date.now() ? payload : null;
}

const redirectUri = (origin: string) => `${origin}/api/google/callback`;

export async function buildAuthUrl(origin: string, userId: string) {
  const c = requireConfig();
  const state = await signState({ uid: userId, origin, exp: Date.now() + 10 * 60 * 1000 });
  const p = new URLSearchParams({
    client_id: c.clientId,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent", // supaya refresh_token selalu dikirim
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

// ---------- token ----------
type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(code: string, origin: string) {
  const c = requireConfig();
  const t = await tokenRequest({
    code,
    client_id: c.clientId,
    client_secret: c.clientSecret,
    redirect_uri: redirectUri(origin),
    grant_type: "authorization_code",
  });
  if (!t.refresh_token)
    throw new Error(t.error_description || t.error || "Google tidak mengirim izin akses offline.");
  let email: string | null = null;
  const payload = t.id_token?.split(".")[1];
  if (payload) {
    try {
      email =
        (JSON.parse(new TextDecoder().decode(fromB64url(payload))) as { email?: string }).email ??
        null;
    } catch {
      email = null;
    }
  }
  return { refreshToken: t.refresh_token, email };
}

async function getAccessToken(userId: string): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("google_connections")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new GoogleAuthError("Google Calendar belum terhubung.");
  const c = requireConfig();
  const t = await tokenRequest({
    client_id: c.clientId,
    client_secret: c.clientSecret,
    refresh_token: data.refresh_token,
    grant_type: "refresh_token",
  });
  if (!t.access_token) {
    if (t.error === "invalid_grant") {
      // izin dicabut atau kedaluwarsa (app Google berstatus Testing: 7 hari)
      await supabaseAdmin.from("google_connections").delete().eq("user_id", userId);
      throw new GoogleAuthError("Izin Google sudah kedaluwarsa. Hubungkan Google Calendar lagi.");
    }
    throw new Error(t.error_description || t.error || "Gagal memperbarui token Google.");
  }
  return t.access_token;
}

export async function revokeConnection(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("google_connections")
    .select("refresh_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (data) {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(data.refresh_token)}`,
      { method: "POST" },
    ).catch(() => undefined);
  }
  await supabaseAdmin.from("google_connections").delete().eq("user_id", userId);
}

// ---------- Google Calendar REST ----------
type GEvent = {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
};

class GoogleHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public rateLimited = false,
  ) {
    super(message);
  }
}

type GoogleErrorBody = { error?: { message?: string; errors?: { reason?: string }[] } };

function isRateLimit(status: number, body: GoogleErrorBody) {
  if (status === 429) return true;
  if (status !== 403) return false;
  const msg = body.error?.message ?? "";
  const reasons = (body.error?.errors ?? []).map((e) => e.reason ?? "");
  return /rate limit|quota/i.test(msg) || reasons.some((r) => /ratelimitexceeded/i.test(r));
}

async function gcal(token: string, path: string, init: RequestInit = {}): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${CAL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 204) return null;
    const json = (await res.json().catch(() => ({}))) as GoogleErrorBody;
    if (res.ok) return json;

    const rate = isRateLimit(res.status, json);
    if ((rate || res.status >= 500) && attempt < MAX_RETRIES) {
      await sleep(delays().retry * 2 ** attempt + Math.random() * 200); // tunggu makin lama tiap ulangan
      continue;
    }
    throw new GoogleHttpError(
      res.status,
      json.error?.message || `Google Calendar error ${res.status}`,
      rate,
    );
  }
}

const gone = (e: unknown) => e instanceof GoogleHttpError && (e.status === 404 || e.status === 410);

function toGoogleBody(s: ScheduleRow, timeZone: string) {
  // Deadline tugas diberi awalan supaya jelas di Google Calendar, dan urgent berwarna merah tomat.
  const isTask = s.activity_type === "tugas";
  const isExam = s.activity_type === "ujian";
  const reminders = isTask
    ? [
        { method: "popup", minutes: 1440 },
        { method: "popup", minutes: 180 },
      ] // H-1 dan 3 jam sebelum
    : isExam
      ? [
          { method: "popup", minutes: 4320 },
          { method: "popup", minutes: 1440 },
        ] // H-3 dan H-1
      : undefined;
  return {
    summary: isTask ? `${DEADLINE_PREFIX}${s.title}` : s.title,
    location: s.location ?? undefined,
    description: s.notes ?? undefined,
    start: { dateTime: s.starts_at, timeZone },
    end: { dateTime: s.ends_at, timeZone },
    colorId: isTask && s.urgent ? "11" : undefined,
    reminders: reminders ? { useDefault: false, overrides: reminders } : undefined,
    extendedProperties: { private: { mooId: s.id, mooType: s.activity_type } },
  };
}

export async function deleteGoogleEvent(userId: string, eventId: string) {
  const token = await getAccessToken(userId);
  try {
    await gcal(token, `/${encodeURIComponent(eventId)}`, { method: "DELETE" });
  } catch (e) {
    if (!gone(e)) throw e;
  }
}

// ---------- sinkron dua arah ----------
const DAY = 864e5;

function fieldsFromGoogle(it: GEvent) {
  if (it.status === "cancelled" || !it.start?.dateTime || !it.end?.dateTime) return null; // kegiatan seharian dilewati
  const start = new Date(it.start.dateTime);
  let end = new Date(it.end.dateTime);
  if (end <= start) end = new Date(start.getTime() + 30 * 60 * 1000);
  const type = it.extendedProperties?.private?.["mooType"];
  let title = it.summary || "(tanpa judul)";
  if (type === "tugas" && title.startsWith(DEADLINE_PREFIX))
    title = title.slice(DEADLINE_PREFIX.length) || title;
  return {
    title: title.slice(0, 160),
    location: it.location ?? null,
    notes: it.description ?? null,
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    activity_type: type && ACTIVITY_TYPES.includes(type) ? type : "kuliah",
  };
}

const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

export type SyncResult = {
  pushed: number;
  pulled: number;
  removed: number;
  remaining: number;
  throttled: boolean;
  errors: string[];
};

export async function syncForUser(db: Db, userId: string): Promise<SyncResult> {
  const { timeZone } = requireConfig();
  const token = await getAccessToken(userId);
  const result: SyncResult = {
    pushed: 0,
    pulled: 0,
    removed: 0,
    remaining: 0,
    throttled: false,
    errors: [],
  };

  // 1) kirim perubahan lokal ke Google, PUSH_BATCH sekaligus (impor jadwal satu semester bisa ratusan agenda)
  const pendingFilter = () =>
    db.from("schedules").select("*", { count: "exact" }).in("sync_status", ["lokal", "gagal"]);
  const {
    data: pending,
    error: pendingErr,
    count,
  } = await pendingFilter()
    .order("sync_status", { ascending: false }) // "lokal" dulu, yang pernah gagal belakangan
    .order("starts_at")
    .limit(PUSH_BATCH);
  if (pendingErr) throw new Error(pendingErr.message);

  let failed = 0;
  const pushOne = async (s: ScheduleRow) => {
    try {
      let saved: GEvent;
      const body = JSON.stringify(toGoogleBody(s, timeZone));
      if (s.google_event_id) {
        try {
          saved = (await gcal(token, `/${encodeURIComponent(s.google_event_id)}`, {
            method: "PUT",
            body,
          })) as GEvent;
        } catch (e) {
          if (!gone(e)) throw e;
          saved = (await gcal(token, "", { method: "POST", body })) as GEvent; // event sudah hilang di Google
        }
      } else {
        saved = (await gcal(token, "", { method: "POST", body })) as GEvent;
      }
      await db
        .from("schedules")
        .update({ google_event_id: saved.id, sync_status: "tersinkron" })
        .eq("id", s.id);
      result.pushed++;
    } catch (e) {
      if (e instanceof GoogleHttpError && e.rateLimited) {
        result.throttled = true; // bukan kesalahan agenda: biarkan "lokal", coba lagi setelah jeda
        return;
      }
      failed++;
      await db.from("schedules").update({ sync_status: "gagal" }).eq("id", s.id);
      result.errors.push(`${s.title}: ${e instanceof Error ? e.message : "gagal"}`);
    }
  };

  const rows = pending ?? [];
  for (const row of rows) {
    if (result.throttled) break; // Google minta pelan-pelan, hentikan batch ini
    await pushOne(row);
    if (delays().between) await sleep(delays().between);
  }

  // Masih ada antrean: berhenti di sini, pemanggil memanggil lagi sampai `remaining` 0.
  // Kalau batch ini tidak menghasilkan apa-apa (semua gagal), lanjut ke tarik supaya tidak berputar selamanya.
  result.remaining = Math.max((count ?? rows.length) - result.pushed - failed, 0);
  if (result.throttled) return result;
  if (result.remaining > 0 && result.pushed > 0) return result;
  result.remaining = 0;

  // 2) tarik dari Google: jendela 30 hari ke belakang sampai 120 hari ke depan
  const now = Date.now();
  const timeMin = new Date(now - 30 * DAY).toISOString();
  const timeMax = new Date(now + 120 * DAY).toISOString();
  const remote: GEvent[] = [];
  let pageToken: string | undefined;
  do {
    const q = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) q.set("pageToken", pageToken);
    const page = (await gcal(token, `?${q}`)) as { items?: GEvent[]; nextPageToken?: string };
    remote.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const { data: courseRows } = await db.from("courses").select("id,name,code,alias");

  const { data: existingRows, error: exErr } = await db
    .from("schedules")
    .select("*")
    .not("google_event_id", "is", null);
  if (exErr) throw new Error(exErr.message);
  const byGid = new Map((existingRows ?? []).map((r) => [r.google_event_id as string, r]));
  const seen = new Set<string>();
  const inserts: Database["public"]["Tables"]["schedules"]["Insert"][] = [];

  const applyRemote = async (it: GEvent) => {
    const f = fieldsFromGoogle(it);
    if (!f) return;
    const ex = byGid.get(it.id);
    if (!ex) {
      inserts.push({
        ...f,
        user_id: userId,
        google_event_id: it.id,
        sync_status: "tersinkron",
        course_id: matchCourse(f.title, courseRows ?? [])?.id ?? null, // dicocokkan dari judul, mis. "E-Commerce (32)"
      });
      return;
    }
    if (ex.sync_status === "lokal") return; // perubahan lokal menang, akan dikirim di sinkron berikutnya
    const changed =
      ex.title !== f.title ||
      (ex.location ?? null) !== f.location ||
      (ex.notes ?? null) !== f.notes ||
      !sameInstant(ex.starts_at, f.starts_at) ||
      !sameInstant(ex.ends_at, f.ends_at);
    if (changed) {
      await db
        .from("schedules")
        .update({ ...f, activity_type: ex.activity_type, sync_status: "tersinkron" })
        .eq("id", ex.id);
      result.pulled++;
    }
  };

  for (const it of remote) {
    seen.add(it.id);
    await applyRemote(it);
  }

  if (inserts.length) {
    const { error } = await db.from("schedules").insert(inserts);
    if (error) result.errors.push(`Gagal menyimpan kegiatan dari Google: ${error.message}`);
    else result.pulled += inserts.length;
  }

  // 3) yang ada di lokal (dalam jendela) tapi tidak muncul di Google: cek satu per satu sebelum dihapus
  const missing = (existingRows ?? []).filter(
    (r) =>
      r.sync_status === "tersinkron" &&
      !seen.has(r.google_event_id as string) &&
      r.starts_at >= timeMin &&
      r.starts_at <= timeMax,
  );
  for (const r of missing.slice(0, 25)) {
    try {
      const it = (await gcal(
        token,
        `/${encodeURIComponent(r.google_event_id as string)}`,
      )) as GEvent;
      if (it.status === "cancelled") {
        await db.from("schedules").delete().eq("id", r.id);
        result.removed++;
      } else {
        await applyRemote(it); // ternyata hanya dipindah keluar jendela waktu
      }
    } catch (e) {
      if (gone(e)) {
        await db.from("schedules").delete().eq("id", r.id);
        result.removed++;
      } else {
        result.errors.push(`${r.title}: ${e instanceof Error ? e.message : "gagal dicek"}`);
      }
    }
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("google_connections")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("user_id", userId);
  return result;
}
