import test from "node:test";
import assert from "node:assert/strict";
import {
  COMPANION_DEFAULTS,
  cleanCowName,
  dueSoon,
  moodOf,
  sanitizeCompanion,
  say,
  shouldIdleNudge,
  startingBlocks,
} from "../src/lib/companion.ts";

const noon = 12;
const base = {
  running: false,
  phase: "focus" as const,
  active: false,
  celebrating: false,
  nudging: false,
  hour: noon,
};

test("suasana hati mengikuti timer, perayaan, pengingat, dan jam", () => {
  assert.equal(moodOf(base), "senang");
  assert.equal(moodOf({ ...base, running: true, active: true }), "fokus");
  assert.equal(moodOf({ ...base, running: true, active: true, phase: "short" }), "istirahat");
  assert.equal(moodOf({ ...base, active: true, phase: "long" }), "istirahat"); // istirahat menunggu dimulai
  assert.equal(moodOf({ ...base, celebrating: true, running: true, active: true }), "semangat"); // perayaan menang
  assert.equal(moodOf({ ...base, nudging: true }), "ingat");
  assert.equal(moodOf({ ...base, hour: 23 }), "tidur");
  assert.equal(moodOf({ ...base, hour: 3 }), "tidur");
  assert.equal(moodOf({ ...base, hour: 23, active: true, running: true }), "fokus"); // masih belajar larut malam: bukan tidur
});

const nudge = {
  now: 10 * 3600_000,
  settings: COMPANION_DEFAULTS,
  timerActive: false,
  lastActivityAt: 0,
  lastNudgeAt: 0,
  snoozedUntil: 0,
  hour: 14,
};

test("pengingat 'lama tidak belajar': hanya kalau semua syarat terpenuhi", () => {
  assert.equal(shouldIdleNudge(nudge), true);
  assert.equal(shouldIdleNudge({ ...nudge, timerActive: true }), false);
  assert.equal(shouldIdleNudge({ ...nudge, hour: 7 }), false); // terlalu pagi
  assert.equal(shouldIdleNudge({ ...nudge, hour: 21 }), false); // terlalu malam
  assert.equal(shouldIdleNudge({ ...nudge, snoozedUntil: nudge.now + 1 }), false);
  assert.equal(shouldIdleNudge({ ...nudge, lastActivityAt: nudge.now - 30 * 60000 }), false); // baru aktif 30 menit lalu, batas 60
  assert.equal(shouldIdleNudge({ ...nudge, lastNudgeAt: nudge.now - 10 * 60000 }), false); // baru diingatkan
  assert.equal(
    shouldIdleNudge({ ...nudge, settings: { ...COMPANION_DEFAULTS, idleMinutes: 0 } }),
    false,
  );
  assert.equal(
    shouldIdleNudge({ ...nudge, settings: { bubble: false, notify: false, idleMinutes: 60 } }),
    false,
  );
});

test("blok belajar yang dimulai sekarang, sekali saja", () => {
  const now = Date.parse("2026-09-21T12:00:00Z");
  const b = (id: string, offsetSec: number, type = "belajar") => ({
    id,
    title: id,
    activity_type: type,
    starts_at: new Date(now + offsetSec * 1000).toISOString(),
  });
  const list = [
    b("tepat", 0),
    b("sebentar-lagi", 30),
    b("masih-lama", 300),
    b("sudah-lewat", -300),
    b("kuliah", 0, "kuliah"),
    b("telat-sedikit", -50),
  ];
  assert.deepEqual(
    startingBlocks(list, now, new Set()).map((s) => s.id),
    ["tepat", "sebentar-lagi", "telat-sedikit"],
  );
  assert.deepEqual(
    startingBlocks(list, now, new Set(["tepat"])).map((s) => s.id),
    ["sebentar-lagi", "telat-sedikit"],
  );
});

test("tugas yang deadline-nya kurang dari 3 jam", () => {
  const now = Date.parse("2026-09-21T12:00:00Z");
  const t = (id: string, hours: number, done = false) => ({
    id,
    title: id,
    done,
    ends_at: new Date(now + hours * 3600_000).toISOString(),
  });
  const list = [t("dekat", 2), t("jauh", 5), t("lewat", -1), t("selesai", 1, true), t("pas", 3)];
  assert.deepEqual(
    dueSoon(list, now, new Set()).map((x) => x.id),
    ["dekat", "pas"],
  );
  assert.deepEqual(
    dueSoon(list, now, new Set(["dekat"])).map((x) => x.id),
    ["pas"],
  );
});

test("nama sapi dan pengaturan dibersihkan", () => {
  assert.equal(cleanCowName("  Bu   Mimi  "), "Bu Mimi");
  assert.equal(cleanCowName(""), "Moo");
  assert.equal(cleanCowName(42), "Moo");
  assert.equal(cleanCowName("x".repeat(50)).length, 20);
  assert.deepEqual(sanitizeCompanion({ idleMinutes: 45, bubble: "ya" }), COMPANION_DEFAULTS); // nilai aneh kembali ke bawaan
  assert.equal(sanitizeCompanion({ idleMinutes: 90 }).idleMinutes, 90);
  assert.match(say.paused("Moo", "12:34"), /dijeda di 12:34/);
  assert.match(say.due("Moo", "SMA LKP 4", 90), /tinggal 2 jam lagi/);
  assert.match(say.due("Moo", "SMA LKP 4", 45), /tinggal 45 menit lagi/);
});
