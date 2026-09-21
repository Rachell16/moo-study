import test from "node:test";
import assert from "node:assert/strict";
import { GeminiError, askGemini, toBase64 } from "../src/lib/gemini.server.ts";

process.env["GEMINI_RETRY_MS"] = "1";
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
  await assert.rejects(call(), /sedang sibuk/);
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
