import test from "node:test";
import assert from "node:assert/strict";
import { chunk, pickSeries, shiftToTimeOfDay, timeOfDayChanged } from "../src/lib/series.ts";

const rows = ["2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"].map((d, i) => ({
  id: "r" + i,
  starts_at: new Date(`${d}T13:00:00`).toISOString(),
}));

test("cakupan: ini saja, ini dan berikutnya, semua", () => {
  const cur = rows[1]!;
  assert.deepEqual(pickSeries(rows, cur, "one"), []);
  assert.deepEqual(
    pickSeries(rows, cur, "following").map((r) => r.id),
    ["r2", "r3"],
  );
  assert.deepEqual(
    pickSeries(rows, cur, "all").map((r) => r.id),
    ["r0", "r2", "r3"],
  );
});

test("perubahan jam: hanya jam/lama yang dihitung, bukan tanggal", () => {
  const orig = {
    starts_at: new Date("2026-09-15T13:00:00").toISOString(),
    ends_at: new Date("2026-09-15T14:40:00").toISOString(),
  };
  assert.equal(
    timeOfDayChanged(orig, {
      start: new Date("2026-09-17T13:00:00"),
      end: new Date("2026-09-17T14:40:00"),
    }),
    false,
  ); // hanya pindah hari
  assert.equal(
    timeOfDayChanged(orig, {
      start: new Date("2026-09-15T14:00:00"),
      end: new Date("2026-09-15T15:40:00"),
    }),
    true,
  );
  assert.equal(
    timeOfDayChanged(orig, {
      start: new Date("2026-09-15T13:00:00"),
      end: new Date("2026-09-15T15:00:00"),
    }),
    true,
  ); // lamanya berubah
});

test("jam baru dipasang ke tanggal masing-masing kegiatan", () => {
  const r = shiftToTimeOfDay(rows[2]!.starts_at, {
    start: new Date("2026-09-15T14:00:00"),
    end: new Date("2026-09-15T15:40:00"),
  });
  const s = new Date(r.starts_at),
    e = new Date(r.ends_at);
  assert.equal(s.getDate(), 22);
  assert.equal(s.getHours(), 14);
  assert.equal(e.getHours(), 15);
  assert.equal(e.getMinutes(), 40);
});

test("chunk", () => assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]));
