import test from "node:test";
import assert from "node:assert/strict";
import {
  groupByDay,
  isSameMonth,
  monthCursor,
  monthGridDays,
  moveToDay,
  shiftMonth,
} from "../src/lib/calendar-month.ts";

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test("kursor bulan selalu tanggal 1, dan geser bulan tidak meleset karena tanggal akhir", () => {
  const c = monthCursor(new Date(2026, 0, 31)); // 31 Januari
  assert.equal(ymd(c), "2026-01-01");
  assert.equal(ymd(shiftMonth(c, 1)), "2026-02-01"); // bukan lompat ke Maret
  assert.equal(ymd(shiftMonth(c, -1)), "2025-12-01");
  assert.equal(isSameMonth(new Date(2026, 8, 1), new Date(2026, 8, 30)), true);
  assert.equal(isSameMonth(new Date(2026, 8, 30), new Date(2026, 9, 1)), false);
});

test("kisi bulan dimulai Senin dan diakhiri Minggu, mencakup seluruh bulan", () => {
  // September 2026: tanggal 1 jatuh hari Selasa, tanggal 30 jatuh hari Rabu -> 5 baris (35 hari)
  const days = monthGridDays(new Date(2026, 8, 1));
  assert.equal(days.length, 35);
  assert.equal(days[0]!.getDay(), 1); // Senin
  assert.equal(ymd(days[0]!), "2026-08-31");
  assert.equal(days.at(-1)!.getDay(), 0); // Minggu
  assert.equal(ymd(days.at(-1)!), "2026-10-04");
  assert.ok(days.some((d) => ymd(d) === "2026-09-01"));
  assert.ok(days.some((d) => ymd(d) === "2026-09-30"));

  // Februari 2026: 1 Feb hari Minggu -> kisi bisa sampai 6 baris (42 hari)
  const feb = monthGridDays(new Date(2026, 1, 1));
  assert.equal(feb.length % 7, 0);
  assert.ok(feb.length === 35 || feb.length === 42);
});

test("pindah agenda ke hari lain: jam dan durasi tetap, tanggal ikut hari tujuan", () => {
  const original = { starts_at: "2026-09-21T03:00:00.000Z", ends_at: "2026-09-21T04:40:00.000Z" }; // 10.00-11.40 WIB
  const moved = moveToDay(original, new Date(2026, 8, 25));
  const s = new Date(moved.starts_at);
  const e = new Date(moved.ends_at);
  assert.equal(`${s.getDate()}/${s.getMonth() + 1}`, "25/9");
  assert.equal(s.getHours(), new Date(original.starts_at).getHours());
  assert.equal(s.getMinutes(), new Date(original.starts_at).getMinutes());
  assert.equal(
    e.getTime() - s.getTime(),
    new Date(original.ends_at).getTime() - new Date(original.starts_at).getTime(),
  );
});

test("pengelompokan per hari: urut jam, hari tanpa agenda tetap ada sebagai daftar kosong", () => {
  const days = [new Date(2026, 8, 21), new Date(2026, 8, 22)];
  const items = [
    { id: "b", starts_at: "2026-09-21T05:00:00.000Z" },
    { id: "a", starts_at: "2026-09-21T02:00:00.000Z" },
    { id: "c", starts_at: "2026-09-23T02:00:00.000Z" }, // di luar kisi
  ];
  const g = groupByDay(items, days);
  assert.deepEqual(
    g.get(days[0]!.getTime())!.map((i) => i.id),
    ["a", "b"],
  );
  assert.deepEqual(g.get(days[1]!.getTime()), []);
  assert.equal(
    [...g.values()].flat().some((i) => i.id === "c"),
    false,
  );
});
