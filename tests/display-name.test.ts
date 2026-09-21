import test from "node:test";
import assert from "node:assert/strict";
import { displayNameOf } from "../src/lib/display-name.ts";

test("pilihan sendiri menang, lalu nama Google (nama depan), lalu awalan email", () => {
  assert.equal(
    displayNameOf({
      email: "a@b.c",
      user_metadata: { display_name: "Kak Budi", full_name: "Budi Santoso" },
    }),
    "Kak Budi",
  );
  assert.equal(
    displayNameOf({ email: "a@b.c", user_metadata: { full_name: "Rachel Rehoboth Lumbantobing" } }),
    "Rachel",
  );
  assert.equal(displayNameOf({ email: "a@b.c", user_metadata: { name: "Dinda Putri" } }), "Dinda");
  assert.equal(
    displayNameOf({ email: "racheltobing09@gmail.com", user_metadata: {} }),
    "Racheltobing",
  );
  assert.equal(displayNameOf({ email: "budi.santoso@petani.id" }), "Budi");
  assert.equal(displayNameOf({ email: "12345@x.id" }), "");
  assert.equal(displayNameOf({ email: "r.tobing@x.id" }), ""); // terlalu pendek: tidak dipakai
  assert.equal(displayNameOf({ email: "a@b.c", user_metadata: { display_name: "R" } }), "R"); // pilihan sendiri tetap dihormati
  assert.equal(displayNameOf(null), "");
});
