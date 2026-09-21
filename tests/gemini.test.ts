import test from "node:test";
import assert from "node:assert/strict";
import { GeminiError, askGemini, toBase64 } from "../src/lib/gemini.server.ts";

process.env["GEMINI_RETRY_MS"] = "1";
process.env["GEMINI_FALLBACK_MODELS"] = "";
const pdf = new TextEncoder().encode("%PDF-1.4 contoh");
const ok = (text: string) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
const err = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { message } }), { status });
const call = () => askGemini({ pdf, prompt: "P", system: "S" });

test("permintaan berisi PDF inline, kunci di header, dan model dari env", async () => {
  process.env["GEMINI_API_KEY"] = "kunci-rahasia";
  process.env["GEMINI_MODEL"] = "gemini-x-flash";
  let seen: { url: string; headers: Record<string, string>; body: any } | null = null;
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    seen = {
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string),
    };
    return ok('{"points":[]}');
  }) as typeof fetch;
  assert.equal(await call(), '{"points":[]}');
  assert.match(seen!.url, /models\/gemini-x-flash:generateContent$/);
  assert.equal(seen!.headers["x-goog-api-key"], "kunci-rahasia");
  assert.ok(!seen!.url.includes("kunci-rahasia")); // kunci tidak boleh ada di URL
  const parts = seen!.body.contents[0].parts;
  assert.equal(parts[0].inline_data.mime_type, "application/pdf");
  assert.equal(Buffer.from(parts[0].inline_data.data, "base64").toString(), "%PDF-1.4 contoh");
  assert.equal(parts[1].text, "P");
  assert.equal(seen!.body.system_instruction.parts[0].text, "S");
  assert.equal(seen!.body.generationConfig.responseMimeType, "application/json");
  delete process.env["GEMINI_MODEL"];
});

test("pesan error yang mudah dimengerti", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  const cases: [number, string, RegExp][] = [
    [429, "quota", /Batas gratis Gemini/],
    [400, "API key not valid", /Kunci Gemini tidak valid/],
    [403, "denied", /Kunci Gemini ditolak/],
    [404, "not found", /Ubah GEMINI_MODEL/],
  ];
  for (const [status, msg, re] of cases) {
    globalThis.fetch = (async () => err(status, msg)) as typeof fetch;
    await assert.rejects(
      call(),
      (e: unknown) => e instanceof GeminiError && re.test(e.message) && e.status === status,
    );
  }
});

test("server sibuk (503) diulang sekali lalu berhasil; kalau tetap gagal, pesan jelas", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  let n = 0;
  globalThis.fetch = (async () =>
    ++n === 1 ? err(503, "overloaded") : ok("halo")) as typeof fetch;
  assert.equal(await call(), "halo");
  assert.equal(n, 2);
  globalThis.fetch = (async () => err(503, "overloaded")) as typeof fetch;
  await assert.rejects(call(), /sedang sibuk \(503: overloaded\)/);
});

test("diblokir, kosong, tanpa kunci, dan PDF terlalu besar", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ promptFeedback: { blockReason: "SAFETY" } }))) as typeof fetch;
  await assert.rejects(call(), /menolak membaca/);
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [] } }] }))) as typeof fetch;
  await assert.rejects(call(), /tidak memberi jawaban/);
  delete process.env["GEMINI_API_KEY"];
  await assert.rejects(call(), /GEMINI_API_KEY belum diisi/);
  process.env["GEMINI_API_KEY"] = "k";
  await assert.rejects(
    askGemini({ pdf: new Uint8Array(15 * 1024 * 1024), prompt: "P", system: "S" }),
    /terlalu besar/,
  );
});

test("base64 benar untuk data besar (lebih dari 32 KB)", () => {
  const big = new Uint8Array(100_000).map((_, i) => i % 251);
  assert.equal(toBase64(big), Buffer.from(big).toString("base64"));
});

test("model utama sibuk terus: pindah ke model cadangan, dan berhasil", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  process.env["GEMINI_MODEL"] = "gemini-3.7-flash";
  process.env["GEMINI_FALLBACK_MODELS"] = "model-cadangan";
  const urls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    urls.push(url);
    return url.includes("model-cadangan")
      ? ok('{"ok":true}')
      : err(503, "The model is overloaded. Please try again later.");
  }) as typeof fetch;
  assert.equal(await call(), '{"ok":true}');
  assert.equal(urls.filter((u) => u.includes("gemini-3.7-flash")).length, 3); // 1 percobaan + 2 ulangan
  assert.match(urls.at(-1)!, /model-cadangan/);
});

test("batas gratis (429) di model utama: model cadangan dicoba; kalau semua gagal, kesalahan model utama yang dilaporkan", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  process.env["GEMINI_MODEL"] = "gemini-3.7-flash";
  process.env["GEMINI_FALLBACK_MODELS"] = "cadangan-1,cadangan-2";
  const seen: string[] = [];
  globalThis.fetch = (async (url: string) => {
    seen.push(url.match(/models\/([^:]+):/)![1]!);
    return url.includes("cadangan-2")
      ? ok("dari cadangan 2")
      : url.includes("cadangan-1")
        ? err(404, "not found")
        : err(429, "quota");
  }) as typeof fetch;
  assert.equal(await call(), "dari cadangan 2");
  assert.deepEqual(seen, ["gemini-3.7-flash", "cadangan-1", "cadangan-2"]);

  globalThis.fetch = (async () => err(429, "quota")) as typeof fetch;
  await assert.rejects(call(), /Batas gratis Gemini/);
});

test("kunci ditolak (403) tidak memicu model cadangan", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  process.env["GEMINI_MODEL"] = "gemini-3.7-flash";
  process.env["GEMINI_FALLBACK_MODELS"] = "cadangan";
  let n = 0;
  globalThis.fetch = (async () => (n++, err(403, "denied"))) as typeof fetch;
  await assert.rejects(call(), /Kunci Gemini ditolak/);
  assert.equal(n, 1);
});

test("thinking level dikirim untuk model seri 3 (bawaan medium, bisa dipilih), dan dicoba ulang tanpa itu kalau ditolak", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  process.env["GEMINI_MODEL"] = "gemini-3.7-flash";
  process.env["GEMINI_FALLBACK_MODELS"] = "";
  const bodies: any[] = [];
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    const b = JSON.parse(init.body as string);
    bodies.push(b);
    return b.generationConfig.thinkingConfig
      ? err(400, "Thinking level is not supported for this model")
      : ok("{}");
  }) as typeof fetch;
  assert.equal(await call(), "{}");
  assert.equal(bodies[0].generationConfig.thinkingConfig.thinkingLevel, "medium");
  assert.equal(bodies[1].generationConfig.thinkingConfig, undefined);

  // model non-seri-3 tidak mengirim thinking sama sekali
  process.env["GEMINI_MODEL"] = "gemini-2.5-flash";
  bodies.length = 0;
  await call();
  assert.equal(bodies[0].generationConfig.thinkingConfig, undefined);
  process.env["GEMINI_MODEL"] = "gemini-3.7-flash";
});

test("pesan asli Google ikut ditampilkan untuk error tak dikenal", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  process.env["GEMINI_FALLBACK_MODELS"] = "";
  globalThis.fetch = (async () =>
    err(400, "Request payload size exceeds the limit")) as typeof fetch;
  await assert.rejects(
    call(),
    /Gemini menolak permintaan \(400\): Request payload size exceeds the limit/,
  );
});

test("tingkat berpikir yang dipilih pengguna diteruskan ke Gemini", async () => {
  process.env["GEMINI_API_KEY"] = "k";
  process.env["GEMINI_MODEL"] = "gemini-3.7-flash";
  process.env["GEMINI_FALLBACK_MODELS"] = "";
  const levels: string[] = [];
  globalThis.fetch = (async (_u: string, init: RequestInit) => {
    levels.push(JSON.parse(init.body as string).generationConfig.thinkingConfig?.thinkingLevel);
    return ok("{}");
  }) as typeof fetch;
  for (const thinking of ["low", "medium", "high"] as const)
    await askGemini({ pdf, prompt: "P", system: "S", thinking });
  assert.deepEqual(levels, ["low", "medium", "high"]);
});
