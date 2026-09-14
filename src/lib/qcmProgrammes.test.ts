import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculerResultatQcm,
  melanger,
  type OptionQcm,
  type QuestionQcm,
} from "./qcmProgrammes.ts";

function option(positionId: string, formation: string): OptionQcm {
  return {
    positionId,
    formation,
    extrait: `citation ${positionId}`,
    resumeAffichage: null,
    titreDocument: null,
    natureDocument: "projet_en_cours",
    url: null,
  };
}

const QUESTIONS: QuestionQcm[] = [
  {
    id: "q1",
    theme: "t",
    intitule: "Première",
    options: [option("a1", "A"), option("b1", "B"), option("c1", "C")],
  },
  {
    id: "q2",
    theme: "t",
    intitule: "Deuxième",
    options: [option("a2", "A"), option("b2", "B"), option("c2", "C")],
  },
  // C est absente de la troisième question.
  {
    id: "q3",
    theme: "t",
    intitule: "Troisième",
    options: [option("a3", "A"), option("b3", "B"), option("d3", "D")],
  },
];

test("le résultat rapporte chaque choix au nombre de questions où la formation figurait", () => {
  const r = calculerResultatQcm(QUESTIONS, [
    { questionId: "q1", positionId: "c1" },
    { questionId: "q2", positionId: "c2" },
    { questionId: "q3", positionId: "a3" },
  ]);
  const c = r.lignes.find((l) => l.formation === "C");
  const a = r.lignes.find((l) => l.formation === "A");
  const d = r.lignes.find((l) => l.formation === "D");
  // C a été choisie deux fois sur deux, A une fois sur trois : C passe
  // devant, alors qu'un décompte brut les mettrait presque à égalité.
  assert.deepEqual(c, { formation: "C", choisie: 2, proposee: 2, part: 1 });
  assert.deepEqual(a, { formation: "A", choisie: 1, proposee: 3, part: 1 / 3 });
  assert.deepEqual(d, { formation: "D", choisie: 0, proposee: 1, part: 0 });
  assert.equal(r.lignes[0]?.formation, "C");
  assert.equal(r.repondues, 3);
});

test("une question passée ne compte pour personne", () => {
  const r = calculerResultatQcm(QUESTIONS, [{ questionId: "q1", positionId: "a1" }]);
  assert.equal(r.repondues, 1);
  assert.equal(
    r.lignes.find((l) => l.formation === "D"),
    undefined,
  );
  assert.equal(r.lignes.find((l) => l.formation === "A")?.proposee, 1);
});

test("« aucune de ces propositions » compte la question sans choisir de formation", () => {
  const r = calculerResultatQcm(QUESTIONS, [{ questionId: "q1", positionId: null }]);
  assert.equal(r.repondues, 1);
  assert.equal(r.aucune, 1);
  for (const l of r.lignes) {
    assert.equal(l.choisie, 0);
    assert.equal(l.proposee, 1);
  }
});

test("un choix qui ne correspond à aucune option est ignoré, pas compté comme un rejet", () => {
  const r = calculerResultatQcm(QUESTIONS, [
    { questionId: "q1", positionId: "inexistante" },
    { questionId: "q9", positionId: "a1" },
  ]);
  assert.equal(r.repondues, 0);
  assert.equal(r.aucune, 0);
  assert.deepEqual(r.lignes, []);
});

test("le mélange conserve les éléments et ne modifie pas l'original", () => {
  const original = ["a", "b", "c", "d", "e"];
  let graine = 7;
  const alea = () => {
    graine = (graine * 16807) % 2147483647;
    return graine / 2147483647;
  };
  const melange = melanger(original, alea);
  assert.deepEqual([...melange].sort(), original);
  assert.deepEqual(original, ["a", "b", "c", "d", "e"]);
});

test("le mélange place chaque élément en tête avec une fréquence voisine", () => {
  // Un mélange biaisé rendrait à une formation l'avantage de la première
  // place, que le mélange est précisément là pour retirer.
  const tetes = new Map<string, number>();
  let graine = 12345;
  const alea = () => {
    graine = (graine * 16807) % 2147483647;
    return graine / 2147483647;
  };
  const tirages = 6000;
  for (let i = 0; i < tirages; i += 1) {
    const [tete] = melanger(["a", "b", "c"], alea);
    tetes.set(tete!, (tetes.get(tete!) ?? 0) + 1);
  }
  for (const n of tetes.values()) {
    assert.ok(Math.abs(n / tirages - 1 / 3) < 0.03, `fréquence de tête ${n / tirages}`);
  }
});
