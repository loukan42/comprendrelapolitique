import assert from "node:assert/strict";
import { test } from "node:test";

import {
  accordDe,
  comparer,
  formationsDe,
  matriceProximite,
  type PositionBenchmark,
  type QuestionBenchmark,
} from "./benchmarkProgrammes.ts";

function position(formation: string, echelle: number | null): PositionBenchmark {
  return {
    formation,
    candidat: null,
    echelle,
    extrait: `citation de ${formation}`,
    url: null,
    titreDocument: null,
    natureDocument: "presidentiel_2027",
  };
}

function question(id: string, positions: PositionBenchmark[], axe = true): QuestionBenchmark {
  return {
    id,
    theme: "retraites",
    intitule: id,
    axeMoins: axe ? "moins" : null,
    axePlus: axe ? "plus" : null,
    positions,
  };
}

const questions = [
  question("q1", [position("A", -2), position("B", -2), position("C", 2)]),
  question("q2", [position("A", -1), position("B", 0), position("C", 2)]),
  question("q3", [position("A", 2), position("B", -1), position("C", 1)]),
  question("q4", [position("A", 0), position("C", 0)]),
  question("q5", [position("A", null), position("B", null), position("C", null)], false),
];

test("l'écart se range en quatre degrés d'accord", () => {
  assert.equal(accordDe(0), "identique");
  assert.equal(accordDe(1), "proche");
  assert.equal(accordDe(2), "eloigne");
  assert.equal(accordDe(3), "oppose");
  assert.equal(accordDe(4), "oppose");
});

test("la proximité ne compte que les questions placées pour les deux", () => {
  const c = comparer(questions, "A", "B");
  // q1 : 0, q2 : 1, q3 : 3 ; q4 manque à B, q5 n'a pas d'axe.
  assert.equal(c.communes, 3);
  assert.equal(c.proximite, (1 + 0.75 + 0.25) / 3);
  assert.deepEqual(c.repartition, { identique: 1, proche: 1, eloigne: 0, oppose: 1 });
  assert.deepEqual(
    c.pointsCommuns.map((l) => l.question.id),
    ["q1", "q2"],
  );
  assert.deepEqual(
    c.differences.map((l) => l.question.id),
    ["q3"],
  );
  assert.equal(c.lignes.length, questions.length);
});

test("sous trois questions communes, aucun score n'est donné", () => {
  const c = comparer(questions.slice(0, 2), "A", "B");
  assert.equal(c.communes, 2);
  assert.equal(c.proximite, null);
});

test("la matrice est symétrique et vide sur sa diagonale", () => {
  const formations = formationsDe(questions);
  assert.deepEqual(
    formations.map((f) => f.formation),
    ["A", "C", "B"],
  );
  const m = matriceProximite(questions, formations);
  for (let i = 0; i < formations.length; i++) {
    assert.equal(m.proximite[i]![i], null);
    for (let j = 0; j < formations.length; j++) {
      assert.equal(m.proximite[i]![j], m.proximite[j]![i]);
      assert.equal(m.communes[i]![j], m.communes[j]![i]);
    }
  }
});
