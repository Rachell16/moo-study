import test from "node:test";
import assert from "node:assert/strict";
import { matchBlocks, parseGradeText } from "../src/lib/parse-grades.ts";
import {
  GRADE_PHOTO_PROMPT,
  GRADE_SYSTEM_PROMPT,
  cleanScheduleText,
} from "../src/lib/import-photo.ts";

import { defaultAliases } from "../src/lib/course-aliases.ts";

const course = (id: string, name: string, code: string, alias?: string) => ({
  id,
  name,
  code,
  alias: alias ?? defaultAliases(name).join(", "),
});
const courses = [
  course("str", "Sistem Tertanam dan Robotika", "KEB1212"),
  course("sma", "Sistem Multi-Agen", "KEB1316"),
  course("ml", "Pembelajaran Mesin", "KEB1315"),
  course("hai", "Human-AI Interaction", "KEB1321"),
  course("vk", "Visi Komputer", "KEB1412", `${defaultAliases("Visi Komputer").join(", ")}, VISKOM`),
  course("ppkb", "Perancangan Produk Kecerdasan Buatan", "KEB1322"),
];

test("teks dua mata kuliah dari catatan tulisan tangan", () => {
  const text = `STR
Tugas+aktivitas 10%
UTS 15%
UAS 20%
UTSP 25%
UASP 30%

SMA
Aktifitas 5%
Projek 50%
Tugas 5%
Kuis 5%
UTS 15%
UAS 20%`;
  const blocks = parseGradeText(text);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.header, "STR");
  assert.equal(blocks[0]!.components.length, 5);
  assert.deepEqual(blocks[0]!.components[0], { name: "Tugas+aktivitas", weightPercent: 10 });
  assert.equal(
    blocks[1]!.components.reduce((s, c) => s + c.weightPercent, 0),
    100,
  );
});

test("nama komponen gabungan dengan slash, dan angka desimal", () => {
  const blocks = parseGradeText("ML\nTugas/Kuis 10%\nUTS 35.5%\nUAS 40%\nPA 15%");
  assert.deepEqual(
    blocks[0]!.components.map((c) => c.name),
    ["Tugas/Kuis", "UTS", "UAS", "PA"],
  );
  assert.equal(blocks[0]!.components[1]!.weightPercent, 35.5);
});

test("komponen tanpa header sama sekali tetap tertangkap", () => {
  const blocks = parseGradeText("Tugas 20%\nUAS 80%");
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0]!.components.length, 2);
});

test("baris kosong dan bobot tidak valid dilewati", () => {
  const blocks = parseGradeText("HAI\n\nTugas 5%\n\nKuis 0%\nUAS abc%\nLKP 30%");
  assert.deepEqual(
    blocks[0]!.components.map((c) => c.name),
    ["Tugas", "LKP"],
  );
});

test("pencocokan otomatis: singkatan dikenal, alias kustom, dan header tidak dikenal", () => {
  const text =
    "STR\nUAS 20%\n\nSMA\nUAS 20%\n\nML\nUAS 40%\n\nHAI\nUAS 20%\n\nVISKOM\nUAS 40%\n\nPPKBP\nUAS 15%";
  const matched = matchBlocks(parseGradeText(text), courses);
  assert.deepEqual(
    matched.map((b) => b.courseId),
    ["str", "sma", "ml", "hai", "vk", null], // VISKOM cocok lewat alias kustom, PPKBP tidak dikenal (beda dari PPKA/PPAI)
  );
});

test("simulasi jawaban AI mengikuti format yang diminta prompt: bisa langsung dibaca parser", () => {
  const simulatedAnswer = `STR
Tugas+aktivitas 10%
UTS 15%
UAS 20%
UTSP 25%
UASP 30%

SMA
Aktifitas 5%
Projek 50%
Tugas 5%
Kuis 5%
UTS 15%
UAS 20%`;
  const blocks = parseGradeText(cleanScheduleText(simulatedAnswer));
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0]!.header, "STR");
  assert.equal(blocks[1]!.header, "SMA");
  assert.match(GRADE_SYSTEM_PROMPT, /jangan mengarang/);
  assert.match(GRADE_PHOTO_PROMPT, /satu baris kosong/);
  assert.equal(cleanScheduleText("```\nSTR\nUAS 100%\n```"), "STR\nUAS 100%");
});
