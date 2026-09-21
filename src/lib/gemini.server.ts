// Hanya untuk server. Memanggil Gemini API dengan PDF materi dan mengembalikan teks jawabannya.
// Kunci API gratis dibuat di https://aistudio.google.com (tanpa kartu kredit) dan disimpan sebagai GEMINI_API_KEY.

const DEFAULT_MODEL = "gemini-3.7-flash";
const MAX_PDF_BYTES = 14 * 1024 * 1024; // batas permintaan inline Gemini ~20 MB setelah base64

export const geminiConfigured = () => !!process.env["GEMINI_API_KEY"];
export const geminiModel = () => process.env["GEMINI_MODEL"] || DEFAULT_MODEL;
export const MAX_PDF = MAX_PDF_BYTES;

export class GeminiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

type GenerateResponse = {
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

function friendly(status: number, apiMessage: string, model: string) {
  if (status === 429)
    return "Batas gratis Gemini sedang tercapai. Tunggu beberapa menit lalu coba lagi.";
  if (status === 400 && /api key/i.test(apiMessage))
    return "Kunci Gemini tidak valid. Periksa GEMINI_API_KEY di pengaturan server.";
  if (status === 401 || status === 403)
    return "Kunci Gemini ditolak. Periksa GEMINI_API_KEY, dan pastikan API-nya aktif untuk kunci itu.";
  if (status === 404)
    return `Model ${model} tidak ditemukan. Ubah GEMINI_MODEL ke model Flash yang tersedia di Google AI Studio.`;
  if (status >= 500) return "Layanan Gemini sedang sibuk. Coba lagi sebentar lagi.";
  return apiMessage ? `Gemini menolak permintaan: ${apiMessage}` : `Gemini error ${status}`;
}

export async function askGemini(opts: {
  pdf: Uint8Array;
  prompt: string;
  system: string;
}): Promise<string> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key)
    throw new GeminiError(
      "Fitur AI belum diaktifkan: GEMINI_API_KEY belum diisi di pengaturan server.",
    );
  if (opts.pdf.length > MAX_PDF_BYTES)
    throw new GeminiError("PDF terlalu besar untuk dibaca AI (maksimal sekitar 14 MB).");
  const model = geminiModel();

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: opts.system }] },
    contents: [
      {
        role: "user",
        parts: [
          { inline_data: { mime_type: "application/pdf", data: toBase64(opts.pdf) } },
          { text: opts.prompt },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
  });

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body,
      },
    );
    const json = (await res.json().catch(() => ({}))) as GenerateResponse;

    if (!res.ok) {
      const retryable = res.status === 503 || res.status === 500;
      if (retryable && attempt < 1) {
        await new Promise((r) => setTimeout(r, Number(process.env["GEMINI_RETRY_MS"] ?? 2000)));
        continue;
      }
      throw new GeminiError(friendly(res.status, json.error?.message ?? "", model), res.status);
    }

    if (json.promptFeedback?.blockReason)
      throw new GeminiError("Gemini menolak membaca materi ini.");
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new GeminiError("Gemini tidak memberi jawaban. Coba lagi.");
    return text;
  }
}
