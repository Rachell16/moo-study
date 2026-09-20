import test from "node:test";
import assert from "node:assert/strict";
import { parseTasks } from "../src/lib/parse-tasks.ts";

const now = new Date(2026, 8, 20, 15, 0); // Minggu, 20 Sep 2026
const at = (d: Date | null) =>
  d
    ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
    : null;

test("daftar tugas dari WhatsApp (nomor, karakter tak terlihat, salah ketik 'pukl', tanda ‼️)", () => {
  const text = [
    "1.\u2060 \u2060SMA LKP 4, Deadline 20/09/2026, pukl 23:59‼️‼️",
    "2.\u2060 \u2060ML LKP 5,  Deadline 20/09/2026, pukl 23:59‼️‼️",
    "3.\u2060 \u2060CV LKP 5, Deadline 22/09/2026, pukl 23:59",
  ].join("\n");
  const r = parseTasks(text, now);
  assert.equal(r.length, 3);
  assert.deepEqual(
    r.map((t) => t.title),
    ["SMA LKP 4", "ML LKP 5", "CV LKP 5"],
  );
  assert.deepEqual(
    r.map((t) => at(t.deadline)),
    ["2026-9-20 23:59", "2026-9-20 23:59", "2026-9-22 23:59"],
  );
  assert.deepEqual(
    r.map((t) => t.urgent),
    [true, true, false],
  );
  assert.ok(r.every((t) => !t.error && !t.timeGuessed));
});

test("variasi format tanggal dan jam", () => {
  const r = parseTasks(
    [
      "Laporan Robotika - 25 Sep 2026 jam 14.30",
      "Quiz HAI dl 3/10 pukul 08:00",
      "Essay besok",
      "- Presentasi ML, Jumat, jam 10",
      "Tugas Akhir 1 Oktober 2026",
      "Deadline 30-09-26 23.00 review paper",
    ].join("\n"),
    now,
  );
  assert.deepEqual(
    r.map((t) => t.title),
    ["Laporan Robotika", "Quiz HAI", "Essay", "Presentasi ML", "Tugas Akhir", "review paper"],
  );
  assert.deepEqual(
    r.map((t) => at(t.deadline)),
    [
      "2026-9-25 14:30",
      "2026-10-3 8:00",
      "2026-9-21 23:59",
      "2026-9-25 10:00",
      "2026-10-1 23:59",
      "2026-9-30 23:00",
    ],
  );
  assert.equal(r[2]!.timeGuessed, true);
});

test("baris bermasalah diberi pesan, bukan dibuang", () => {
  const r = parseTasks("Kerjakan modul\n31/02/2026 jam 10\nSMA LKP 6 deadline 99/99/2026", now);
  assert.equal(r.length, 3);
  assert.match(r[0]!.error ?? "", /Tanggal/);
  assert.match(r[1]!.error ?? "", /Nama tugas/);
  assert.match(r[2]!.error ?? "", /tidak valid/);
});

test("baris kosong dan tanpa tahun", () => {
  const r = parseTasks("\n\n  \nQuiz CV 22/09\n", now);
  assert.equal(r.length, 1);
  assert.equal(at(r[0]!.deadline), "2026-9-22 23:59");
});
