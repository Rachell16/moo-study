import test from "node:test";
import assert from "node:assert/strict";
import { defaultAliases, matchCourse } from "../src/lib/course-aliases.ts";

const mk = (id: string, name: string, code: string) => ({
  id,
  name,
  code,
  alias: defaultAliases(name).join(", "),
});
const courses = [
  mk("sma", "Sistem Multi-Agen", "KEB1316"),
  mk("ml", "Pembelajaran Mesin", "KEB1315"),
  mk("cv", "Visi Komputer", "KEB1412"),
  mk("hai", "Human-AI Interaction", "KEB1321"),
];

test("singkatan tugas dikenali (SMA, ML, CV)", () => {
  assert.equal(matchCourse("SMA LKP 4", courses)?.id, "sma");
  assert.equal(matchCourse("ML LKP 5", courses)?.id, "ml");
  assert.equal(matchCourse("CV LKP 5", courses)?.id, "cv");
  assert.equal(matchCourse("Laporan hai minggu 3", courses)?.id, "hai");
});

test("kode dan nama lengkap juga cocok, yang tidak dikenal null", () => {
  assert.equal(matchCourse("Quiz KEB1412", courses)?.id, "cv");
  assert.equal(matchCourse("Tugas Visi Komputer 2", courses)?.id, "cv");
  assert.equal(matchCourse("Belanja bulanan", courses), null);
});

test("singkatan otomatis untuk nama baru", () => {
  assert.deepEqual(defaultAliases("Basis Data Lanjut"), ["BDL"]);
});
