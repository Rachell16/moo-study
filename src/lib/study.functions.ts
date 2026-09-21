import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// File *.functions.ts ikut ke bundle browser, jadi modul server dimuat lewat import() di dalam handler.

const idInput = z.object({ materialId: z.string().uuid(), force: z.boolean().optional() });

export const getAiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { geminiConfigured, geminiModel } = await import("./gemini.server");
    return { configured: geminiConfigured(), model: geminiModel() };
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

// Pecah materi jadi poin belajar. Poin lama diganti (progres "paham" ikut hilang), jadi klien meminta `force` untuk membuat ulang.
export const generateOutline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(idInput)
  .handler(async ({ context, data }) => {
    const { askGemini } = await import("./gemini.server");
    const { OUTLINE_PROMPT, SYSTEM_PROMPT, parseOutline } = await import("./study-ai");
    const { supabase, userId } = context;

    const { count } = await supabase
      .from("material_points")
      .select("id", { count: "exact", head: true })
      .eq("material_id", data.materialId);
    if ((count ?? 0) > 0 && !data.force) throw new Error("Poin materi ini sudah ada.");

    const pdf = await loadPdf(supabase, data.materialId);
    const points = parseOutline(
      await askGemini({ pdf, prompt: OUTLINE_PROMPT, system: SYSTEM_PROMPT }),
    );

    await supabase.from("material_points").delete().eq("material_id", data.materialId);
    const { error } = await supabase.from("material_points").insert(
      points.map((p, i) => ({
        user_id: userId,
        material_id: data.materialId,
        position: i + 1,
        heading: p.heading,
        summary: p.summary,
        page: p.page,
      })),
    );
    if (error) throw new Error(error.message);
    await supabase
      .from("materials")
      .update({ outline_generated_at: new Date().toISOString() })
      .eq("id", data.materialId);
    return { count: points.length };
  });

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(idInput)
  .handler(async ({ context, data }) => {
    const { askGemini } = await import("./gemini.server");
    const { QUIZ_PROMPT, SYSTEM_PROMPT, parseQuiz } = await import("./study-ai");
    const { supabase } = context;

    const pdf = await loadPdf(supabase, data.materialId);
    const questions = parseQuiz(
      await askGemini({ pdf, prompt: QUIZ_PROMPT, system: SYSTEM_PROMPT }),
    );
    const { error } = await supabase
      .from("materials")
      .update({ quiz: questions, quiz_generated_at: new Date().toISOString() })
      .eq("id", data.materialId);
    if (error) throw new Error(error.message);
    return { count: questions.length };
  });
