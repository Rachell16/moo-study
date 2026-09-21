import test from "node:test";
import assert from "node:assert/strict";
import { parseEvent } from "../src/lib/parse-event.ts";

const now = new Date(2026, 8, 20, 15, 0); // Minggu, 20 Sep 2026 15.00
const f = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
    : null;

test("contoh dari Rachel: rapat hima hari rabu jam 12.00", () => {
  const r = parseEvent("rapat hima hari rabu jam 12.00", now)!;
  assert.equal(r.error, undefined);
  assert.equal(r.title, "Rapat Hima");
  assert.equal(f(r.start), "2026-9-23 12:00");
  assert.equal(f(r.end), "2026-9-23 13:00");
  assert.equal(r.kind, "kegiatan");
  assert.equal(r.durationGuessed, true);
});

test("rentang jam, lokasi, dan huruf besar dibiarkan", () => {
  const a = parseEvent("Rapat BEM Jumat 10.00-11.30 di Aula Fmipa", now)!;
  assert.equal(a.title, "Rapat BEM");
  assert.equal(f(a.start), "2026-9-25 10:00");
  assert.equal(f(a.end), "2026-9-25 11:30");
  assert.equal(a.location, "Aula Fmipa");
  assert.equal(a.durationGuessed, false);

  const b = parseEvent("rapat di sekre rabu 16.00", now)!;
  assert.equal(b.title, "Rapat");
  assert.equal(b.location, "sekre");
});

test("besok, hari ini, durasi 'selama', dan jenis kegiatan", () => {
  const a = parseEvent("belajar ML besok jam 19.00 selama 2 jam", now)!;
  assert.equal(a.title, "Belajar ML");
  assert.equal(f(a.start), "2026-9-21 19:00");
  assert.equal(f(a.end), "2026-9-21 21:00");
  assert.equal(a.kind, "belajar");

  const b = parseEvent("kerja kelompok hari ini 18.30", now)!;
  assert.equal(f(b.start), "2026-9-20 18:30");
  assert.equal(parseEvent("praktikum CV senin 13.00", now)!.kind, "praktikum");
});

test("tanpa hari: hari ini kalau jamnya belum lewat, kalau sudah lewat besok", () => {
  assert.equal(f(parseEvent("rapat jam 17.00", now)!.start), "2026-9-20 17:00");
  assert.equal(f(parseEvent("rapat jam 10.00", now)!.start), "2026-9-21 10:00");
});

test("nama hari yang sama dengan hari ini: hari ini kalau jamnya belum lewat, kalau sudah lewat minggu depan", () => {
  const wed = new Date(2026, 8, 23, 10, 0);
  assert.equal(f(parseEvent("rapat rabu jam 12.00", wed)!.start), "2026-9-23 12:00");
  assert.equal(f(parseEvent("rapat rabu jam 08.00", wed)!.start), "2026-9-30 8:00");
});

test("tanggal angka, nomor urut, kata pembuka, dan jam tidak ditulis", () => {
  const a = parseEvent("1. tolong jadwalkan workshop 25/09 jam 13.00 3 jam", now)!;
  assert.equal(a.title, "Workshop");
  assert.equal(f(a.start), "2026-9-25 13:00");
  assert.equal(f(a.end), "2026-9-25 16:00");
  const b = parseEvent("seminar jumat", now)!;
  assert.equal(f(b.start), "2026-9-25 9:00");
  assert.equal(b.timeGuessed, true);
});

test("pesan kalau kurang jelas, dan deteksi tugas", () => {
  assert.match(parseEvent("makan siang", now)!.error ?? "", /harinya atau jamnya/);
  assert.match(parseEvent("rapat 31/02 jam 10.00", now)!.error ?? "", /tidak valid/);
  assert.equal(parseEvent("", now), null);
  assert.equal(parseEvent("kumpul laporan SMA rabu 23.59", now)!.looksLikeTask, true);
});
