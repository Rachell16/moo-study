import test from "node:test";
import assert from "node:assert/strict";
import { cleanScheduleText, SCHEDULE_PHOTO_PROMPT } from "../src/lib/import-photo.ts";
import { parseTimetable } from "../src/lib/parse-timetable.ts";

test("teks dibungkus code fence dibersihkan", () => {
  assert.equal(cleanScheduleText("```\nhalo\n```"), "halo");
  assert.equal(cleanScheduleText("```text\nhalo\n```"), "halo");
  assert.equal(cleanScheduleText("  halo  "), "halo");
});

test("format yang diminta prompt bisa langsung dibaca parser jadwal yang sudah ada", () => {
  const sample = `*HARI SENIN*

*10:00 - 11:40*
Mata Kuliah: KEB1316 Sistem Multi-Agen (K/1)
Ruangan: IPB W8 502
PJ: Danish

*13:00 - 14:40*
Mata Kuliah: KEB1412 Visi Komputer (K/1)
Ruangan: Lab Dasar 3
PJ: -`;
  const r = parseTimetable(cleanScheduleText(sample));
  assert.equal(r.sessions.length, 2);
  assert.equal(r.sessions[0]!.code, "KEB1316");
  assert.equal(r.sessions[1]!.room, "Lab Dasar 3");
  assert.equal(r.warnings.length, 0);
});

test("prompt menjelaskan format tanpa JSON dan menyebut aturan tidak mengarang", () => {
  assert.match(SCHEDULE_PHOTO_PROMPT, /bukan JSON/);
  assert.match(SCHEDULE_PHOTO_PROMPT, /jangan mengarang/);
});
