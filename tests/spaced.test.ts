import test from "node:test";
import assert from "node:assert/strict";
import {
  INTERVAL_DAYS,
  endOfToday,
  hashQuestion,
  isDue,
  nextState,
  pickSession,
  planCardUpdates,
} from "../src/lib/spaced.ts";

const now = new Date(2026, 8, 21, 10, 0);
const days = (iso: string) => Math.round((new Date(iso).getTime() - now.getTime()) / 86400000);
const q = (text: string, answerIndex = 0) => ({
  question: text,
  options: ["a", "b", "c", "d"],
  answerIndex,
  explanation: "e",
});

test("sidik soal: abaikan huruf besar, spasi, dan tanda baca, tapi bedakan soal yang berbeda", () => {
  assert.equal(hashQuestion("Apa itu piksel?"), hashQuestion("  apa   ITU piksel "));
  assert.notEqual(hashQuestion("Apa itu piksel?"), hashQuestion("Apa itu voxel?"));
  assert.match(hashQuestion("x"), /^[0-9a-f]{8}-\d+$/);
});

test("kotak naik kalau benar (jarak 1, 3, 7, 14, 30 hari) dan kembali ke 1 kalau salah", () => {
  let s = nextState(null, false, now);
  assert.deepEqual(
    { box: s.box, wrong: s.wrong_count, hari: days(s.due_at) },
    { box: 1, wrong: 1, hari: 1 },
  );
  const seen: number[] = [];
  for (let i = 0; i < 6; i++) {
    s = nextState(s, true, now);
    seen.push(s.box);
  }
  assert.deepEqual(seen, [2, 3, 4, 5, 5, 5]); // berhenti di kotak 5
  assert.equal(days(s.due_at), 30);
  assert.equal(s.correct_count, 6);
  const back = nextState(s, false, now);
  assert.deepEqual(
    { box: back.box, hari: days(back.due_at), salah: back.wrong_count },
    { box: 1, hari: 1, salah: 2 },
  );
  assert.deepEqual([...INTERVAL_DAYS], [1, 3, 7, 14, 30]);
});

test("jatuh tempo sampai akhir hari ini; sesi diurutkan kotak rendah dulu dan dibatasi", () => {
  const at = (h: number, d = 0) => new Date(2026, 8, 21 + d, h).toISOString();
  assert.equal(isDue({ due_at: at(23) }, now), true); // nanti malam: boleh dikerjakan pagi ini
  assert.equal(isDue({ due_at: at(1, 1) }, now), false); // besok pagi: belum
  assert.equal(endOfToday(now).getDate(), 22);
  const cards = [
    { id: "a", box: 3, due_at: at(8, -2) },
    { id: "b", box: 1, due_at: at(9) },
    { id: "c", box: 1, due_at: at(8, -1) },
    { id: "d", box: 2, due_at: at(9, 3) }, // belum
  ];
  assert.deepEqual(
    pickSession(cards, now).map((c) => c.id),
    ["c", "b", "a"],
  );
  assert.equal(pickSession(cards, now, 2).length, 2);
});

test("hasil latihan jadi pembaruan kartu: yang salah masuk, yang benar hanya menaikkan kartu lama", () => {
  const existing = new Map([
    [hashQuestion("Soal lama"), { box: 2, correct_count: 1, wrong_count: 1 }],
  ]);
  const updates = planCardUpdates(
    [
      { q: q("Soal baru salah"), pickedIndex: 1 }, // salah, belum ada kartu: dibuat kotak 1
      { q: q("Soal baru benar"), pickedIndex: 0 }, // benar, belum ada kartu: dilewati
      { q: q("Soal lama"), pickedIndex: 0 }, // benar, kartu ada: naik ke kotak 3
    ],
    existing,
    now,
  );
  assert.equal(updates.length, 2);
  const byText = Object.fromEntries(updates.map((u) => [u.question.question, u.state]));
  assert.equal(byText["Soal baru salah"]!.box, 1);
  assert.equal(byText["Soal lama"]!.box, 3);
  assert.equal(byText["Soal lama"]!.correct_count, 2);
  // soal yang sama dua kali dalam satu latihan hanya menghasilkan satu pembaruan
  const dup = planCardUpdates(
    [
      { q: q("X"), pickedIndex: 1 },
      { q: q("X"), pickedIndex: 1 },
    ],
    new Map(),
    now,
  );
  assert.equal(dup.length, 1);
});
