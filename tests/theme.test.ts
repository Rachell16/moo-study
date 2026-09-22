import test from "node:test";
import assert from "node:assert/strict";
import { nextTheme, resolveIsDark, sanitizeTheme, THEME_LABEL } from "../src/lib/theme.ts";

test("gelap ditentukan oleh pilihan, atau sistem kalau pilihannya 'system'", () => {
  assert.equal(resolveIsDark("dark", false), true);
  assert.equal(resolveIsDark("light", true), false);
  assert.equal(resolveIsDark("system", true), true);
  assert.equal(resolveIsDark("system", false), false);
});

test("siklus tombol: sistem, terang, gelap, lalu ulang", () => {
  assert.equal(nextTheme("system"), "light");
  assert.equal(nextTheme("light"), "dark");
  assert.equal(nextTheme("dark"), "system");
});

test("nilai tersimpan yang rusak kembali ke 'system'; label ada untuk semua tema", () => {
  assert.equal(sanitizeTheme("ngawur"), "system");
  assert.equal(sanitizeTheme(null), "system");
  assert.equal(sanitizeTheme("dark"), "dark");
  assert.deepEqual(Object.keys(THEME_LABEL).sort(), ["dark", "light", "system"]);
});
