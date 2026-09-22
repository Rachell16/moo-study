// Hanya untuk server. Memanggil Gemini API dengan PDF materi dan mengembalikan teks jawabannya.
// Kunci API gratis dibuat di https://aistudio.google.com (tanpa kartu kredit) dan disimpan sebagai GEMINI_API_KEY.

const DEFAULT_MODEL = "gemini-3.7-flash";
// Model cadangan, dicoba kalau model utama sibuk atau kena batas. Bisa diganti lewat GEMINI_FALLBACK_MODELS (pisahkan dengan koma).
const DEFAULT_FALLBACKS = "gemini-flash-lite-latest";
const MAX_PDF_BYTES = 14 * 1024 * 1024; // batas permintaan inline Gemini ~20 MB setelah base64
const MAX_RETRIES = 2; // ulangi model yang sama kalau server sibuk

export const geminiConfigured = () => !!process.env["GEMINI_API_KEY"];
export const geminiModel = () => process.env["GEMINI_MODEL"] || DEFAULT_MODEL;
export const MAX_PDF = MAX_PDF_BYTES;

export const modelChain = (): string[] => {
  const extra = (process.env["GEMINI_FALLBACK_MODELS"] ?? DEFAULT_FALLBACKS)
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([geminiModel(), ...extra])];
};

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

const short = (s: string) => (s.length > 180 ? `${s.slice(0, 180)}…` : s);

function friendly(status: number, apiMessage: string, model: string) {
  if (status === 429)
    return "Batas gratis Gemini sedang tercapai. Tunggu beberapa menit lalu coba lagi.";
  if (status === 400 && /api key/i.test(apiMessage))
    return "Kunci Gemini tidak valid. Periksa GEMINI_API_KEY di pengaturan server.";
  if (status === 401 || status === 403)
    return "Kunci Gemini ditolak. Periksa GEMINI_API_KEY, dan pastikan API-nya aktif untuk kunci itu.";
  if (status === 404)
    return `Model ${model} tidak ditemukan. Ubah GEMINI_MODEL ke model Flash yang tersedia di Google AI Studio.`;
  // pesan asli dari Google disertakan supaya penyebabnya bisa dilacak
  if (status >= 500)
    return `Layanan Gemini sedang sibuk (${status}${apiMessage ? `: ${short(apiMessage)}` : ""}). Coba lagi sebentar lagi.`;
  return apiMessage
    ? `Gemini menolak permintaan (${status}): ${short(apiMessage)}`
    : `Gemini error ${status}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Model seri 3 mendukung "thinking level" (low, medium, high): makin tinggi makin teliti, tapi makin lama dan berat.
export type ThinkingLevel = "low" | "medium" | "high";

function requestBody(
  fileData: string,
  mimeType: string,
  prompt: string,
  system: string,
  model: string,
  withThinking: boolean,
  level?: ThinkingLevel,
) {
  const generationConfig: Record<string, unknown> = {
    responseMimeType: "application/json",
    temperature: 0.3,
    maxOutputTokens: 20000,
  };
  if (withThinking && /gemini-3/.test(model) && process.env["GEMINI_THINKING"] !== "off") {
    generationConfig["thinkingConfig"] = {
      thinkingLevel: level ?? (process.env["GEMINI_THINKING_LEVEL"] || "medium"),
    };
  }
  return JSON.stringify({
    system_instruction: { parts: [{ text: system }] },
    contents: [
      {
        role: "user",
        parts: [{ inline_data: { mime_type: mimeType, data: fileData } }, { text: prompt }],
      },
    ],
    generationConfig,
  });
}

// Satu model: ulangi kalau server sibuk, dan coba tanpa thinking kalau model menolak parameternya.
async function callModel(
  model: string,
  key: string,
  fileData: string,
  mimeType: string,
  prompt: string,
  system: string,
  level?: ThinkingLevel,
): Promise<string> {
  let withThinking = true;
  const timeout = Number(process.env["GEMINI_TIMEOUT_MS"] ?? 120000);
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: requestBody(fileData, mimeType, prompt, system, model, withThinking, level),
          signal: AbortSignal.timeout(timeout),
        },
      );
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
        throw new GeminiError(
          "Gemini terlalu lama menjawab. Coba lagi, atau pakai materi yang lebih pendek.",
          504,
        );
      }
      throw new GeminiError(
        "Tidak bisa menghubungi Gemini. Periksa koneksi server lalu coba lagi.",
        0,
      );
    }
    const json = (await res.json().catch(() => ({}))) as GenerateResponse;

    if (!res.ok) {
      const apiMessage = json.error?.message ?? "";
      if (res.status === 400 && withThinking && /thinking/i.test(apiMessage)) {
        withThinking = false; // model ini tidak mengenal parameter thinking level
        continue;
      }
      if ((res.status === 500 || res.status === 503) && attempt < MAX_RETRIES) {
        await sleep(Number(process.env["GEMINI_RETRY_MS"] ?? 2000) * (attempt + 1));
        continue;
      }
      throw new GeminiError(friendly(res.status, apiMessage, model), res.status);
    }

    if (json.promptFeedback?.blockReason)
      throw new GeminiError("Gemini menolak membaca materi ini.", 422);
    const text = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    if (!text) throw new GeminiError("Gemini tidak memberi jawaban. Coba lagi.", 502);
    return text;
  }
}

// Status yang layak dicoba di model cadangan: sibuk, batas gratis, atau model tidak ada.
const canFallback = (status: number) =>
  status === 429 || status === 404 || status >= 500 || status === 0;

// Batas ukuran per jenis file. PDF materi biasanya lebih besar; foto jadwal cukup kecil setelah dikompres di browser.
export const MAX_IMAGE = 8 * 1024 * 1024;

async function askGeminiRaw(opts: {
  bytes: Uint8Array;
  mimeType: string;
  prompt: string;
  system: string;
  thinking?: ThinkingLevel | undefined;
}): Promise<string> {
  const key = process.env["GEMINI_API_KEY"];
  if (!key)
    throw new GeminiError(
      "Fitur AI belum diaktifkan: GEMINI_API_KEY belum diisi di pengaturan server.",
    );
  const data = toBase64(opts.bytes);

  let first: GeminiError | null = null;
  for (const model of modelChain()) {
    try {
      return await callModel(
        model,
        key,
        data,
        opts.mimeType,
        opts.prompt,
        opts.system,
        opts.thinking,
      );
    } catch (e) {
      if (!(e instanceof GeminiError)) throw e;
      first ??= e; // yang dilaporkan: kesalahan model utama
      if (!canFallback(e.status)) throw e;
    }
  }
  throw first ?? new GeminiError("Gemini tidak memberi jawaban.");
}

export async function askGemini(opts: {
  pdf: Uint8Array;
  prompt: string;
  system: string;
  thinking?: ThinkingLevel;
}): Promise<string> {
  if (opts.pdf.length > MAX_PDF_BYTES)
    throw new GeminiError("PDF terlalu besar untuk dibaca AI (maksimal sekitar 14 MB).");
  return askGeminiRaw({
    bytes: opts.pdf,
    mimeType: "application/pdf",
    prompt: opts.prompt,
    system: opts.system,
    thinking: opts.thinking,
  });
}

export async function askGeminiImage(opts: {
  image: Uint8Array;
  mimeType: string;
  prompt: string;
  system: string;
  thinking?: ThinkingLevel;
}): Promise<string> {
  if (opts.image.length > MAX_IMAGE)
    throw new GeminiError(
      "Foto terlalu besar (maksimal sekitar 8 MB). Coba foto ulang atau kompres dulu.",
    );
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(opts.mimeType))
    throw new GeminiError("Format foto tidak dikenali. Pakai JPG, PNG, atau WEBP.");
  return askGeminiRaw({
    bytes: opts.image,
    mimeType: opts.mimeType,
    prompt: opts.prompt,
    system: opts.system,
    thinking: opts.thinking,
  });
}
