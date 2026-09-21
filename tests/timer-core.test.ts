import test from "node:test";
import assert from "node:assert/strict";
import {
  afterFocus,
  clockText,
  minutesOf,
  parseSaved,
  restore,
  type SavedTimer,
} from "../src/lib/timer-core.ts";

const L = { focus: 25, short: 5, long: 15, cycle: 4 };
const base: SavedTimer = {
  phase: "focus",
  running: true,
  endAt: 1_000_000,
  remaining: 0,
  cycle: 1,
  courseId: "c1",
  startedAt: 900_000,
};

test("teks jam dan panjang fase", () => {
  assert.equal(clockText(25 * 60000), "25:00");
  assert.equal(clockText(61_500), "01:02"); // dibulatkan ke atas
  assert.equal(clockText(-5), "00:00");
  assert.equal(minutesOf("short", L), 5);
  assert.equal(minutesOf("long", L), 15);
});

test("giliran istirahat: pendek, lalu panjang di sesi ke-4 dan putaran mulai ulang", () => {
  assert.deepEqual(afterFocus(0, L), { next: "short", cycle: 1 });
  assert.deepEqual(afterFocus(2, L), { next: "short", cycle: 3 });
  assert.deepEqual(afterFocus(3, L), { next: "long", cycle: 0 });
});

test("pulihkan timer yang masih jalan: sisa waktu dihitung dari jam dinding", () => {
  const r = restore(base, 940_000, L)!;
  assert.equal(r.running, true);
  assert.equal(r.remaining, 60_000);
  assert.equal(r.endAt, 1_000_000);
});

test("timer baru saja habis saat tab tertutup: diselesaikan sekarang; yang sudah basi dimulai bersih", () => {
  const justEnded = restore(base, 1_000_000 + 5 * 60000, L)!;
  assert.equal(justEnded.running, true);
  assert.equal(justEnded.remaining, 0);
  const stale = restore(base, 1_000_000 + 8 * 3600_000, L)!;
  assert.deepEqual(
    { phase: stale.phase, running: stale.running, remaining: stale.remaining },
    { phase: "focus", running: false, remaining: 25 * 60000 },
  );
  assert.equal(stale.cycle, 1); // putaran tidak hilang
});

test("timer yang dijeda dipulihkan, yang utuh tidak perlu dipulihkan", () => {
  const paused: SavedTimer = { ...base, running: false, remaining: 10 * 60000 };
  assert.equal(restore(paused, 5, L)!.remaining, 10 * 60000);
  assert.equal(restore({ ...paused, remaining: 25 * 60000 }, 5, L), null);
  assert.equal(restore(null, 5, L), null);
});

test("data tersimpan yang rusak ditolak", () => {
  assert.equal(parseSaved(null), null);
  assert.equal(parseSaved({ phase: "ngawur" }), null);
  assert.equal(parseSaved({ phase: "focus", endAt: "x", remaining: 1, cycle: 0 }), null);
  const ok = parseSaved({
    phase: "short",
    running: true,
    endAt: 5,
    remaining: 0,
    cycle: 2.9,
    courseId: 3,
  });
  assert.deepEqual(ok, {
    phase: "short",
    running: true,
    endAt: 5,
    remaining: 0,
    cycle: 2,
    courseId: "",
    startedAt: null,
  });
});
