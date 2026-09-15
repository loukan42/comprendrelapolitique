import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DECALAGE,
  RANGEES,
  categorieDeScrutin,
  coder,
  decoder,
  disposer,
  TAILLE_CODE,
  type ScrutinNuage,
} from "./nuageScrutins.ts";

const exemples: ScrutinNuage[] = [
  { legislature: 15, numero: 1, jour: 0, categorie: "ensemble", adopte: true },
  { legislature: 16, numero: 4106, jour: 1900, categorie: "censure", adopte: false },
  { legislature: 17, numero: 8434, jour: 3304, categorie: "amendement", adopte: false },
  { legislature: 17, numero: 262143, jour: 4095, categorie: "autre", adopte: true },
];

test("le codage restitue chaque scrutin à l'identique", () => {
  const codes = exemples.map(coder).join("");
  assert.equal(codes.length, exemples.length * TAILLE_CODE);
  assert.deepEqual(decoder(codes), exemples);
});

test("le codage refuse une valeur qu'il ne saurait pas relire", () => {
  assert.throws(() => coder({ ...exemples[0]!, jour: 4096 }));
  assert.throws(() => coder({ ...exemples[0]!, numero: -1 }));
  assert.throws(() => decoder("ABC"));
  assert.throws(() => decoder("!!!!!!"));
});

test("la catégorie se lit dans l'intitulé, dans le bon ordre", () => {
  const cas = (objet: string, typeVoteCode = "SPO", estVoteSurEnsemble = false) =>
    categorieDeScrutin({ objet, typeVoteCode, estVoteSurEnsemble });
  assert.equal(cas("la motion de censure", "MOC"), "censure");
  assert.equal(cas("l'ensemble du projet de loi", "SPS", true), "ensemble");
  // Un amendement qui cite un article reste un amendement.
  assert.equal(cas("l'amendement n° 10 de M. X après l'article 6"), "amendement");
  assert.equal(cas("le sous-amendement n° 3 à l'amendement n° 12"), "amendement");
  assert.equal(cas("l'article 3 de la proposition de loi"), "article");
  assert.equal(cas("la motion de rejet préalable"), "motion");
  // L'intitulé du texte visé ne fait pas d'une motion un amendement.
  assert.equal(
    cas("la motion de rejet préalable du projet de loi relatif aux amendements"),
    "motion",
  );
  assert.equal(cas("la déclaration du Gouvernement (article 50-1 de la Constitution)"), "autre");
  assert.equal(cas("l'article unique de la proposition de résolution"), "autre");
  assert.equal(cas("la proposition de résolution (art. 34-1 de la Constitution)"), "autre");
});

test("chaque scrutin est placé au rang de sa législature", () => {
  const { position, taille, phase } = disposer(exemples);
  exemples.forEach((s, i) => {
    const x = position[3 * i]!;
    const y = position[3 * i + 1]!;
    const z = position[3 * i + 2]!;
    assert.ok([x, y, z].every(Number.isFinite));
    if (s.categorie === "autre") {
      assert.ok(Math.hypot(x, z) >= 1, "les autres votes gravitent autour");
    } else {
      const rang = Math.hypot(x, z - DECALAGE.z);
      const [min, max] = RANGEES[s.legislature];
      assert.ok(rang >= min - 1e-6 && rang <= max + 1e-6, `rang de la ${s.legislature}e`);
      assert.ok(z - DECALAGE.z <= 0, "l'hémicycle s'ouvre vers le lecteur");
    }
    if (s.categorie === "censure") assert.ok(y - DECALAGE.y > 0.4, "une censure flotte au-dessus");
    assert.ok(taille[i]! > 0);
    assert.ok(phase[i]! >= 0 && phase[i]! < 1);
  });
});

test("un scrutin occupe toujours la même place", () => {
  assert.deepEqual(disposer(exemples).position, disposer(exemples).position);
});
