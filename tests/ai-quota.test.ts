import test from "node:test";
import assert from "node:assert/strict";
import {
  QuotaError,
  dayStart,
  readQuota,
  reserve,
  type QuotaStore,
} from "../src/lib/ai-quota.server.ts";

// simpanan di memori yang meniru tabel ai_usage
function memoryStore() {
  const rows: { id: string; userId: string; at: Date }[] = [];
  let n = 0;
  const now = () => new Date(2026, 8, 21, 12, 0);
  const store: QuotaStore & { rows: typeof rows; clock: Date } = {
    rows,
    clock: now(),
    async count(since, userId) {
      return rows.filter((r) => r.at >= since && (!userId || r.userId === userId)).length;
    },
    async add(userId) {
      const id = `r${++n}`;
      rows.push({ id, userId, at: store.clock });
      return id;
    },
    async remove(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
    },
    async prune(before) {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i]!.at < before) rows.splice(i, 1);
    },
  };
  return store;
}

const limits = { perUser: 3, global: 5 };
const now = new Date("2026-09-21T10:00:00Z"); // 03.00 PDT, 17.00 WIB
const TZ = "America/Los_Angeles";

test("awal hari mengikuti tengah malam zona Pasifik (PDT = UTC-7)", () => {
  assert.equal(
    dayStart(new Date("2026-09-21T10:00:00Z"), TZ).toISOString(),
    "2026-09-21T07:00:00.000Z",
  );
  assert.equal(
    dayStart(new Date("2026-09-21T04:00:00Z"), TZ).toISOString(),
    "2026-09-20T07:00:00.000Z",
  ); // masih 21.00 tanggal 20 di Pasifik
  assert.equal(
    dayStart(new Date("2026-09-21T07:00:00Z"), TZ).toISOString(),
    "2026-09-21T07:00:00.000Z",
  ); // tepat tengah malam
  assert.equal(
    dayStart(new Date("2026-09-21T10:00:00Z"), "Asia/Jakarta").toISOString(),
    "2026-09-20T17:00:00.000Z",
  ); // zona bisa diganti
});

test("sisa jatah: batas per akun dan batas total, mana yang lebih kecil", async () => {
  const s = memoryStore();
  s.clock = new Date("2026-09-21T09:00:00Z");
  await s.add("rachel", "materi");
  await s.add("pacar", "materi");
  await s.add("pacar", "soal");
  const q = await readQuota(s, "rachel", limits, now, TZ);
  assert.deepEqual(
    { used: q.used, limit: q.limit, globalUsed: q.globalUsed, remaining: q.remaining },
    { used: 1, limit: 3, globalUsed: 3, remaining: 2 },
  );
  assert.equal(q.resetsAt, "2026-09-22T07:00:00.000Z");
  const p = await readQuota(s, "pacar", limits, now, TZ);
  assert.equal(p.remaining, 1); // 2 dari 3 sudah dipakai
});

test("catatan sebelum reset tidak dihitung hari ini", async () => {
  const s = memoryStore();
  s.clock = new Date("2026-09-21T06:59:00Z"); // 23.59 PDT kemarin
  await s.add("rachel", "materi");
  const q = await readQuota(s, "rachel", limits, now, TZ);
  assert.equal(q.used, 0);
});

test("reserve: lolos sampai batas per akun, lalu ditolak dengan pesan jelas", async () => {
  const s = memoryStore();
  s.clock = new Date("2026-09-21T09:00:00Z");
  for (let i = 0; i < 3; i++) await reserve(s, "rachel", "materi", limits, now, TZ);
  await assert.rejects(
    reserve(s, "rachel", "materi", limits, now, TZ),
    (e: unknown) =>
      e instanceof QuotaError && /Jatah AI-mu hari ini habis \(3 kali\)/.test(e.message),
  );
  // akun lain masih boleh sampai batas total
  await reserve(s, "pacar", "materi", limits, now, TZ);
  await reserve(s, "pacar", "materi", limits, now, TZ);
  await assert.rejects(
    reserve(s, "pacar", "materi", limits, now, TZ),
    /untuk semua pengguna hari ini sudah habis/,
  );
  assert.equal(s.rows.length, 5); // yang ditolak tidak tercatat
});

test("dua permintaan bersamaan di batas terakhir: tidak pernah melebihi batas (boleh keduanya ditolak, klik ulang saja)", async () => {
  const s = memoryStore();
  s.clock = new Date("2026-09-21T09:00:00Z");
  await reserve(s, "rachel", "materi", limits, now, TZ);
  await reserve(s, "rachel", "materi", limits, now, TZ); // sisa satu
  const results = await Promise.allSettled([
    reserve(s, "rachel", "materi", limits, now, TZ),
    reserve(s, "rachel", "materi", limits, now, TZ),
  ]);
  assert.ok(results.filter((r) => r.status === "fulfilled").length <= 1);
  assert.ok(s.rows.length <= 3); // batas 3 tidak terlampaui
});

test("catatan lebih dari 3 hari dibersihkan", async () => {
  const s = memoryStore();
  s.clock = new Date("2026-09-10T00:00:00Z");
  await s.add("rachel", "materi");
  s.clock = new Date("2026-09-21T09:00:00Z");
  await reserve(s, "rachel", "materi", limits, now, TZ);
  assert.equal(s.rows.length, 1);
});
