import test from "node:test";
import assert from "node:assert/strict";
import { computeStreak, weekMarks } from "../src/lib/streak.ts";
import { PRESETS, presetIdOf, sanitize } from "../src/lib/timer-settings.ts";

const now = new Date(2026, 8, 21, 10, 0); // Senin, 21 Sep 2026
const day = (offset: number, h = 9) => new Date(2026, 8, 21 + offset, h, 0);

test("streak berturut-turut sampai hari ini", () => {
  const s = computeStreak([day(-2), day(-1), day(0), day(0, 15)], now);
  assert.deepEqual(s, { current: 3, best: 3, todayDone: true });
});

test("hari ini belum belajar tapi kemarin sudah: streak masih hidup", () => {
  const s = computeStreak([day(-2), day(-1)], now);
  assert.equal(s.current, 2);
  assert.equal(s.todayDone, false);
});

test("lewat sehari penuh: streak kembali ke 0, rekor terbaik tetap", () => {
  const s = computeStreak([day(-5), day(-4), day(-3)], now);
  assert.equal(s.current, 0);
  assert.equal(s.best, 3);
});

test("ada jeda: streak dihitung dari yang terakhir saja", () => {
  const s = computeStreak([day(-6), day(-5), day(-4), day(-1), day(0)], now);
  assert.equal(s.current, 2);
  assert.equal(s.best, 3);
});

test("belum pernah belajar", () => {
  assert.deepEqual(computeStreak([], now), { current: 0, best: 0, todayDone: false });
});

test("centang minggu ini (Senin sampai Minggu)", () => {
  const monday = new Date(2026, 8, 21);
  assert.deepEqual(weekMarks([day(0), day(2)], monday), [
    true,
    false,
    true,
    false,
    false,
    false,
    false,
  ]);
  assert.deepEqual(weekMarks([day(-1)], monday), [false, false, false, false, false, false, false]); // Minggu lalu tidak ikut
});

test("pengaturan timer: batas angka, preset, dan kustom", () => {
  assert.equal(sanitize({ focus: 999 }).focus, 240);
  assert.equal(sanitize({ focus: 0 }).focus, 1);
  assert.equal(sanitize({ cycle: 1 }).cycle, 2);
  assert.equal(sanitize({ focus: "abc" as unknown as number }).focus, 25);
  const p = PRESETS[1];
  assert.equal(
    presetIdOf(sanitize({ focus: p.focus, short: p.short, long: p.long, cycle: p.cycle })),
    "lima-puluh",
  );
  assert.equal(presetIdOf(sanitize({ focus: 30 })), "kustom");
});
