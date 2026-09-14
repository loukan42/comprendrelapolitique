/**
 * Tests du calcul de position et de compatibilité.
 *
 * Le test qui compte le plus est celui de l'inversion de sens : c'est la
 * seule protection contre un contresens qui afficherait la position inverse
 * d'une formation, et il est impossible de le repérer à l'œil sur un
 * résultat.
 *
 * L'exemple chiffré de docs/QUIZ_ENGINE.md section 4.5 est rejoué ici : si
 * le calcul change, le document et le code ne peuvent plus diverger en
 * silence.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  accord,
  calculerCompatibilite,
  calculerPosition,
  niveauConfiance,
  poidsTemporel,
  positionSurScrutin,
  type ParametresScoring,
  type VoteFormation,
} from "./quizPosition.ts";

const P: ParametresScoring = {
  demiVieMois: 48,
  minScrutins: 2,
  minVotes: 200,
  seuilConfianceHaute: 0.6,
  seuilConfianceMoyenne: 0.35,
  poidsSujetImportant: 2,
};

const MAINTENANT = new Date("2026-09-14T00:00:00Z");

function vote(p: Partial<VoteFormation> = {}): VoteFormation {
  return {
    scrutinUid: "S1",
    dateScrutin: new Date("2026-09-01T00:00:00Z"),
    sens: 1,
    poids: 1,
    voixPour: 50,
    voixContre: 10,
    voixAbstention: 0,
    ...p,
  };
}

test("un groupe unanime POUR sur un scrutin de sens +1 est totalement favorable", () => {
  const p = positionSurScrutin(vote({ voixPour: 60, voixContre: 0, voixAbstention: 0 }));
  assert.equal(p, 1);
});

test("le sens inverse la position sans changer les voix", () => {
  const voix = { voixPour: 8, voixContre: 55, voixAbstention: 7 };
  const direct = positionSurScrutin(vote({ ...voix, sens: 1 }))!;
  const inverse = positionSurScrutin(vote({ ...voix, sens: -1 }))!;
  assert.equal(Math.round(inverse * 1000) / 1000, -Math.round(direct * 1000) / 1000);
  // Le texte baissait la fiscalité, le groupe a voté contre : c'est une
  // position favorable à la question « faut-il taxer davantage ».
  assert.ok(inverse > 0);
});

test("l'abstention tire la position vers zéro sans être un désaccord", () => {
  const p = positionSurScrutin(vote({ voixPour: 0, voixContre: 0, voixAbstention: 40 }));
  assert.equal(p, 0);
});

test("les non-votants ne changent pas le dénominateur", () => {
  // Les non-votants ne figurent pas dans le type : ils sont exclus en amont.
  // Ce test fixe la conséquence attendue, une position inchangée.
  const sans = positionSurScrutin(vote({ voixPour: 30, voixContre: 10, voixAbstention: 0 }))!;
  assert.equal(Math.round(sans * 1000) / 1000, 0.5);
});

test("un groupe sans voix exprimée ne produit pas de position", () => {
  assert.equal(positionSurScrutin(vote({ voixPour: 0, voixContre: 0, voixAbstention: 0 })), null);
});

test("la décote temporelle vaut un demi après une demi-vie", () => {
  const ancien = new Date("2022-09-14T00:00:00Z");
  const p = poidsTemporel(ancien, MAINTENANT, 48);
  assert.ok(Math.abs(p - 0.5) < 0.01, `attendu ~0,5, obtenu ${p}`);
});

test("un vote du futur ou du jour même n'est pas décoté", () => {
  assert.equal(poidsTemporel(MAINTENANT, MAINTENANT, 48), 1);
});

test("l'exemple chiffré de QUIZ_ENGINE section 4.5 est reproduit", () => {
  const votes: VoteFormation[] = [
    {
      scrutinUid: "A",
      dateScrutin: new Date("2026-01-15T00:00:00Z"),
      sens: 1,
      poids: 1,
      voixPour: 60,
      voixContre: 5,
      voixAbstention: 5,
    },
    {
      scrutinUid: "B",
      dateScrutin: new Date("2025-06-15T00:00:00Z"),
      sens: -1,
      poids: 1,
      voixPour: 8,
      voixContre: 55,
      voixAbstention: 7,
    },
    {
      scrutinUid: "C",
      dateScrutin: new Date("2023-03-15T00:00:00Z"),
      sens: 1,
      poids: 0.5,
      voixPour: 30,
      voixContre: 30,
      voixAbstention: 10,
    },
  ];
  const r = calculerPosition(votes, P, MAINTENANT);

  // Position franchement favorable, tirée vers le bas par le scrutin C où le
  // groupe s'est coupé en deux.
  assert.ok(r.position > 0.55 && r.position < 0.7, `position hors attendu : ${r.position}`);
  // C'est la division interne, pas le manque de données, qui coûte la
  // confiance : la couverture est pleine.
  assert.equal(r.couverture, 1);
  assert.ok(r.cohesion > 0.7 && r.cohesion < 0.82, `cohésion hors attendu : ${r.cohesion}`);
  assert.ok(r.constance < 0.8, `constance hors attendu : ${r.constance}`);
  assert.equal(niveauConfiance(r.confiance, P), "moyenne");
  assert.equal(r.nScrutins, 3);
  assert.equal(r.publiable, true);
});

test("un groupe constant et uni obtient une confiance plus forte qu'un groupe divisé", () => {
  const uni = calculerPosition(
    [
      vote({ scrutinUid: "A", voixPour: 100, voixContre: 0, voixAbstention: 0 }),
      vote({ scrutinUid: "B", voixPour: 100, voixContre: 0, voixAbstention: 0 }),
    ],
    P,
    MAINTENANT,
  );
  const divise = calculerPosition(
    [
      vote({ scrutinUid: "A", voixPour: 100, voixContre: 0, voixAbstention: 0 }),
      vote({ scrutinUid: "B", voixPour: 0, voixContre: 100, voixAbstention: 0 }),
    ],
    P,
    MAINTENANT,
  );
  assert.ok(uni.confiance > divise.confiance);
  // Le groupe divisé a une position moyenne proche de zéro, qui ne veut rien
  // dire : la constance doit l'annoncer.
  assert.ok(Math.abs(divise.position) < 0.01);
  assert.ok(divise.constance < 0.1);
});

test("sous les seuils, la position n'est pas publiable", () => {
  const r = calculerPosition(
    [vote({ voixPour: 5, voixContre: 1, voixAbstention: 0 })],
    P,
    MAINTENANT,
  );
  assert.equal(r.publiable, false);
  assert.equal(r.nScrutins, 1);
});

test("les bornes tiennent pour toute entrée", () => {
  const cas: VoteFormation[][] = [
    [],
    [vote({ voixPour: 0, voixContre: 0, voixAbstention: 0 })],
    [vote({ voixPour: 1000, voixContre: 0, voixAbstention: 0, sens: -1 })],
    [vote({ dateScrutin: new Date("2017-07-01T00:00:00Z") })],
  ];
  for (const votes of cas) {
    const r = calculerPosition(votes, P, MAINTENANT);
    assert.ok(r.position >= -1 && r.position <= 1, `position hors bornes : ${r.position}`);
    assert.ok(r.confiance >= 0 && r.confiance <= 1, `confiance hors bornes : ${r.confiance}`);
    assert.ok(Number.isFinite(r.position) && Number.isFinite(r.confiance));
  }
});

test("l'accord vaut 1 quand la réponse coïncide et 0 aux extrêmes opposés", () => {
  assert.equal(accord(1, 1), 1);
  assert.equal(accord(1, -1), 0);
  assert.equal(accord(0, 0), 1);
});

test("« je ne sais pas » ne change aucune compatibilité, seulement le décompte", () => {
  const positions = [
    { questionId: "q1", formationId: "a", position: 1, confiance: 0.9 },
    { questionId: "q2", formationId: "a", position: -1, confiance: 0.9 },
  ];
  const sans = calculerCompatibilite(
    [{ questionId: "q1", reponse: "TOUT_A_FAIT_DACCORD" }],
    positions,
    P,
  );
  const avec = calculerCompatibilite(
    [
      { questionId: "q1", reponse: "TOUT_A_FAIT_DACCORD" },
      { questionId: "q2", reponse: "NSP" },
    ],
    positions,
    P,
  );
  assert.equal(sans[0]?.compatibilite, avec[0]?.compatibilite);
  assert.equal(avec[0]?.questionsRetenues, 1);
});

test("« ni d'accord ni pas d'accord » est une réponse mesurée, pas une abstention de calcul", () => {
  const positions = [{ questionId: "q1", formationId: "a", position: 0, confiance: 0.9 }];
  const r = calculerCompatibilite([{ questionId: "q1", reponse: "NI_NI" }], positions, P);
  assert.equal(r[0]?.questionsRetenues, 1);
  assert.equal(r[0]?.compatibilite, 1);
});

test("un sujet declare important pese davantage", () => {
  const positions = [
    { questionId: "q1", formationId: "a", position: 1, confiance: 0.9 },
    { questionId: "q2", formationId: "a", position: -1, confiance: 0.9 },
  ];
  const neutre = calculerCompatibilite(
    [
      { questionId: "q1", reponse: "TOUT_A_FAIT_DACCORD" },
      { questionId: "q2", reponse: "TOUT_A_FAIT_DACCORD" },
    ],
    positions,
    P,
  );
  const pondere = calculerCompatibilite(
    [
      { questionId: "q1", reponse: "TOUT_A_FAIT_DACCORD", important: true },
      { questionId: "q2", reponse: "TOUT_A_FAIT_DACCORD" },
    ],
    positions,
    P,
  );
  // q1 est celle où la formation est d'accord : la pondérer doit remonter la
  // compatibilité.
  assert.ok(pondere[0]!.compatibilite > neutre[0]!.compatibilite);
});

test("une position incertaine pese moins qu'une position sure", () => {
  const positions = [
    { questionId: "q1", formationId: "sure", position: 1, confiance: 1 },
    { questionId: "q2", formationId: "sure", position: -1, confiance: 1 },
    { questionId: "q1", formationId: "incertaine", position: 1, confiance: 1 },
    { questionId: "q2", formationId: "incertaine", position: -1, confiance: 0.1 },
  ];
  const r = calculerCompatibilite(
    [
      { questionId: "q1", reponse: "TOUT_A_FAIT_DACCORD" },
      { questionId: "q2", reponse: "TOUT_A_FAIT_DACCORD" },
    ],
    positions,
    P,
  );
  const sure = r.find((x) => x.formationId === "sure")!;
  const incertaine = r.find((x) => x.formationId === "incertaine")!;
  // Le désaccord de q2 compte moins pour « incertaine », qui remonte donc.
  assert.ok(incertaine.compatibilite > sure.compatibilite);
});
