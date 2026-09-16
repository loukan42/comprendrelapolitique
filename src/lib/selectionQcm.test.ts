import assert from "node:assert/strict";
import { test } from "node:test";
import { alternativesQuestion, selectionnerQuestions } from "./selectionQcm.ts";
import type { QuestionQcm } from "./qcmProgrammes.ts";

const q: QuestionQcm = {
  id: "energie-nucleaire",
  theme: "energie",
  intitule: "Question",
  options: [
    ["lfi-nucleaire", "A"],
    ["ren-nucleaire", "B"],
    ["pp-nucleaire", "C"],
  ].map(([positionId, formation]) => ({
    positionId: positionId!,
    formation: formation!,
    extrait: "Citation de test",
    resumeAffichage: null,
    titreDocument: null,
    natureDocument: "programme_parti",
    url: "https://example.org",
  })),
};

test("regrouper conserve les citations et ne compte pas les auteurs comme alternatives", () => {
  assert.equal(alternativesQuestion(q).length, 2);
  assert.equal(alternativesQuestion(q).find((a) => a.id === "developper")?.options.length, 2);
  assert.equal(selectionnerQuestions([q]).length, 1);
});

test("une opposition absente du corpus retire la question", () => {
  assert.deepEqual(selectionnerQuestions([{ ...q, options: q.options.slice(1) }]), []);
  assert.deepEqual(selectionnerQuestions([{ ...q, id: "ecole-priorite" }]), []);
});
