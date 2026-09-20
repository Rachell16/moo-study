import test from "node:test";
import assert from "node:assert/strict";
import { defaultSelection, parseTimetable, sessionTitle } from "../src/lib/parse-timetable.ts";
import { SEMESTER_TIMETABLE } from "../src/lib/my-timetable.ts";

test("jadwal semester: 16 sesi, hari/jam/ruang/PJ terbaca, catatan dipisah", () => {
  const r = parseTimetable(SEMESTER_TIMETABLE);
  assert.equal(r.warnings.length, 0);
  assert.equal(r.sessions.length, 16);

  const by = (day: number) => r.sessions.filter((s) => s.day === day).length;
  assert.deepEqual([1, 2, 3, 4, 5].map(by), [4, 3, 4, 5, 0]);

  const first = r.sessions[0]!;
  assert.deepEqual(first, {
    day: 1,
    start: "10:00",
    end: "11:40",
    code: "KEB1316",
    name: "Sistem Multi-Agen",
    kind: "K",
    section: "1",
    room: "IPB W8 502",
    pj: "Danish",
  });

  // dua kelas berbagi satu baris jam (P/1 dan P/2 hari Senin 15:00-17:00)
  const p2 = r.sessions.find((s) => s.name === "Sistem Multi-Agen" && s.section === "2")!;
  assert.equal(p2.start, "15:00");
  assert.equal(p2.end, "17:00");
  assert.equal(p2.pj, "Raffi Putra Berlian");
  assert.equal(sessionTitle(p2), "Sistem Multi-Agen (P/2)");

  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0]!, /R\/1/);
  assert.ok(!r.sessions.some((s) => s.day === 2 && s.start === "15:00")); // kelas R/1 tidak ikut
});

test("pilihan awal: semua kuliah, praktikum hanya kelas pertama", () => {
  const r = parseTimetable(SEMESTER_TIMETABLE);
  const sel = defaultSelection(r.sessions);
  const chosen = r.sessions.filter((_, i) => sel[i]);
  assert.equal(chosen.filter((s) => s.kind === "K").length, 6);
  const p = chosen
    .filter((s) => s.kind === "P")
    .map(sessionTitle)
    .sort();
  assert.deepEqual(p, [
    "Human-AI Interaction (P/1)",
    "Pembelajaran Mesin (P/1)",
    "Sistem Multi-Agen (P/1)",
    "Sistem Tertanam dan Robotika (P/1)",
    "Visi Komputer (P/1)",
  ]);
  // tanpa bentrok jam dalam satu hari untuk pilihan awal
  for (let d = 1; d <= 5; d++) {
    const list = chosen.filter((s) => s.day === d).sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < list.length; i++)
      assert.ok(list[i]!.start >= list[i - 1]!.end, `bentrok hari ${d}: ${sessionTitle(list[i]!)}`);
  }
});

test("teks tanpa format dan tanpa hari", () => {
  const r = parseTimetable("Mata Kuliah: Kalkulus\nRuangan: A1");
  assert.equal(r.sessions.length, 0);
  assert.equal(r.warnings.length, 1);
});

test("baris jadwal: 4 minggu dari Senin 21 Sep 2026, jam lokal WIB", async () => {
  const { buildTimetableRows } = await import("../src/lib/timetable-rows.ts");
  const r = parseTimetable(SEMESTER_TIMETABLE);
  const chosen = r.sessions.filter((_, i) => defaultSelection(r.sessions)[i]);
  const rows = buildTimetableRows(chosen, {
    userId: "u1",
    monday: new Date(2026, 8, 21),
    weeks: 4,
    courseIdByCode: new Map([["KEB1316", "c-sma"]]),
  });
  assert.equal(rows.length, chosen.length * 4);
  const first = rows.find((x) => x.title === "Sistem Multi-Agen (K/1)" && x.starts_at.startsWith("2026-09-21"))!;
  assert.equal(first.starts_at, new Date(2026, 8, 21, 10, 0).toISOString());
  assert.equal(first.ends_at, new Date(2026, 8, 21, 11, 40).toISOString());
  assert.equal(first.course_id, "c-sma");
  assert.equal(first.location, "IPB W8 502");
  assert.equal(first.notes, "PJ: Danish");
  assert.equal(first.activity_type, "kuliah");
  // Kamis minggu ke-2 (baris praktikum Visi Komputer 13:00-15:00)
  const vk = rows.find((x) => x.title === "Visi Komputer (P/1)" && new Date(x.starts_at).getDate() === 1)!; // 1 Okt 2026 = Kamis
  assert.equal(vk.activity_type, "praktikum");
  assert.equal(new Date(vk.starts_at).getHours(), 13);
  assert.equal(vk.course_id, null); // kode tidak ada di peta
});
