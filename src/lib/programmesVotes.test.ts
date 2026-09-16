import assert from "node:assert/strict";
import { test } from "node:test";
import { constatPubliable } from "./programmesVotes.ts";

test("aucun écart publié sur une censure, un amendement, un conflit ou sans votes", () => {
  const base = {
    typeVote: "SPO",
    ensemble: true,
    conflit: false,
    nombreVotes: 12,
    constate: "ecart" as const,
  };
  assert.equal(constatPubliable(base), "ecart");
  for (const exception of [
    { typeVote: "MOC" },
    { ensemble: false },
    { conflit: true },
    { nombreVotes: 0 },
  ]) {
    assert.equal(constatPubliable({ ...base, ...exception }), "non_comparable");
  }
});
