import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withQuota } from "./ai-quota.server";

// File *.functions.ts ikut ke bundle browser, jadi modul server dimuat lewat import() di dalam handler.

const idInput = z.object({
  materialId: z.string().uuid(),
  force: z.boolean().optional(),
  depth: z.enum(["cepat", "seimbang", "teliti"]).optional(),
});

// Status AI untuk tampilan: apakah kunci sudah dipasang dan berapa sisa jatah hari ini.
export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { geminiConfigured, geminiModel } = await import("./gemini.server");
    const configured = geminiConfigured();
    let quota: import("./ai-quota.server").Quota | null = null;
    if (configured) {
      try {
        const { adminStore, limitsFromEnv, readQuota } = await import("./ai-quota.server");
        quota = await readQuota(await adminStore(), context.userId, limitsFromEnv());
      } catch {
        quota = null; // tabel ai_usage belum ada: tampilan tanpa penghitung, dan pesan jelas muncul saat AI dipakai
      }
    }
    return { configured, model: geminiModel(), quota };
  });

async function loadPdf(
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  materialId: string,
) {
  const { MAX_PDF } = await import("./gemini.server");
  const { data: m, error } = await supabase
    .from("materials")
    .select("id,name,file_type,size_bytes,storage_path")
    .eq("id", materialId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!m) throw new Error("Materi tidak ditemukan.");
  if (m.file_type !== "pdf")
    throw new Error("AI hanya bisa membaca PDF. Ubah slide PPT jadi PDF dulu, lalu unggah lagi.");
  if (m.size_bytes > MAX_PDF)
    throw new Error("PDF terlalu besar untuk dibaca AI (maksimal sekitar 14 MB).");
  const { data: blob, error: dlErr } = await supabase.storage
    .from("study-materials")
    .download(m.storage_path);
  if (dlErr || !blob) throw new Error(dlErr?.message ?? "File materi tidak bisa dibuka.");
  return new Uint8Array(await blob.arrayBuffer());
}

// Jatah dicatat sebelum memanggil Gemini. Kalau panggilan gagal sebelum Gemini memproses (kunci salah, server sibuk, batas Google),
// catatannya dibatalkan supaya tidak menghabiskan jatah; kalau Gemini sudah menjawab tapi jawabannya tidak terbaca, tetap terhitung.
// Satu permintaan ke Gemini menghasilkan poin materi sekaligus soal latihan. Poin lama diganti (tanda "paham" ikut hilang), jadi klien meminta `force` untuk membuat ulang.
export const prepareMaterial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(idInput)
  .handler(async ({ context, data }) => {
    const { askGemini } = await import("./gemini.server");
    const { COMBINED_PROMPT, SYSTEM_PROMPT, parseCombined, thinkingFor } =
      await import("./study-ai");
    const { supabase, userId } = context;

    const { count } = await supabase
      .from("material_points")
      .select("id", { count: "exact", head: true })
      .eq("material_id", data.materialId);
    if ((count ?? 0) > 0 && !data.force) throw new Error("Poin materi ini sudah ada.");

    const pdf = await loadPdf(supabase, data.materialId);
    const parsed = await withQuota(userId, "materi", async () =>
      parseCombined(
        await askGemini({
          pdf,
          prompt: COMBINED_PROMPT,
          system: SYSTEM_PROMPT,
          thinking: thinkingFor(data.depth),
        }),
      ),
    );

    await supabase.from("material_points").delete().eq("material_id", data.materialId);
    const { error } = await supabase.from("material_points").insert(
      parsed.points.map((p, i) => ({
        user_id: userId,
        material_id: data.materialId,
        position: i + 1,
        heading: p.heading,
        summary: p.summary,
        page: p.page,
      })),
    );
    if (error) throw new Error(error.message);

    const now = new Date().toISOString();
    const patch: import("@/integrations/supabase/types").Database["public"]["Tables"]["materials"]["Update"] =
      { outline_generated_at: now };
    if (parsed.questions) {
      patch.quiz = parsed.questions;
      patch.quiz_generated_at = now;
    }
    await supabase.from("materials").update(patch).eq("id", data.materialId);
    return { points: parsed.points.length, questions: parsed.questions?.length ?? 0 };
  });

// Soal baru saja (mis. soal lama sudah hafal, atau soal dari permintaan gabungan rusak).
export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(idInput)
  .handler(async ({ context, data }) => {
    const { askGemini } = await import("./gemini.server");
    const { QUIZ_PROMPT, SYSTEM_PROMPT, parseQuiz, thinkingFor } = await import("./study-ai");
    const { supabase, userId } = context;

    const pdf = await loadPdf(supabase, data.materialId);
    const questions = await withQuota(userId, "soal", async () =>
      parseQuiz(
        await askGemini({
          pdf,
          prompt: QUIZ_PROMPT,
          system: SYSTEM_PROMPT,
          thinking: thinkingFor(data.depth),
        }),
      ),
    );
    const { error } = await supabase
      .from("materials")
      .update({ quiz: questions, quiz_generated_at: new Date().toISOString() })
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { count: questions.length };
  });

const photoInput = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  depth: z.enum(["cepat", "seimbang", "teliti"]).optional(),
});

// Baca jadwal kuliah dari foto (KRS, jadwal cetak, papan pengumuman). Hasilnya teks bebas dengan format yang sama
// seperti jadwal yang ditempel dari chat, supaya bisa langsung dibaca ulang oleh parser jadwal yang sudah ada
// dan pengguna tetap bisa memeriksa/mengedit hasilnya sebelum diimpor.
export const importSchedulePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(photoInput)
  .handler(async ({ context, data }) => {
    const { askGeminiImage } = await import("./gemini.server");
    const { SCHEDULE_PHOTO_PROMPT, SCHEDULE_SYSTEM_PROMPT, cleanScheduleText } =
      await import("./import-photo");
    const { thinkingFor } = await import("./study-ai");

    const bytes = Uint8Array.from(Buffer.from(data.imageBase64, "base64"));
    const text = await withQuota(context.userId, "jadwal", async () =>
      askGeminiImage({
        image: bytes,
        mimeType: data.mimeType,
        prompt: SCHEDULE_PHOTO_PROMPT,
        system: SCHEDULE_SYSTEM_PROMPT,
        thinking: thinkingFor(data.depth),
      }),
    );
    return { text: cleanScheduleText(text) };
  });

// Baca rubrik nilai dari foto (catatan, slide dosen, kontrak perkuliahan; bisa berisi beberapa mata kuliah
// sekaligus). Hasilnya teks bebas dengan format yang sama seperti impor cepat manual, supaya bisa langsung
// dibaca ulang oleh parser yang sama dan pengguna tetap bisa memeriksa/mengedit sebelum diterapkan.
export const importGradesPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(photoInput)
  .handler(async ({ context, data }) => {
    const { askGeminiImage } = await import("./gemini.server");
    const { GRADE_PHOTO_PROMPT, GRADE_SYSTEM_PROMPT, cleanScheduleText } =
      await import("./import-photo");
    const { thinkingFor } = await import("./study-ai");

    const bytes = Uint8Array.from(Buffer.from(data.imageBase64, "base64"));
    const text = await withQuota(context.userId, "nilai", async () =>
      askGeminiImage({
        image: bytes,
        mimeType: data.mimeType,
        prompt: GRADE_PHOTO_PROMPT,
        system: GRADE_SYSTEM_PROMPT,
        thinking: thinkingFor(data.depth),
      }),
    );
    return { text: cleanScheduleText(text) };
  });
