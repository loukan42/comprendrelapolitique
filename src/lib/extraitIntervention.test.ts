/**
 * Tests de la réduction d'une explication de vote.
 *
 * Le lanceur est celui de Node (`node --test`), sans dépendance ajoutée.
 *
 * La propriété qui compte n'est pas qu'un extrait précis sorte de la
 * fonction, mais qu'il reste **du texte cité** : le jour où la règle de
 * sélection change, ces tests doivent continuer à passer, sauf celui qui
 * décrit la règle elle-même.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { extraireEssentiel } from "./extraitIntervention.ts";

const DISCOURS = [
  "Monsieur le président, mes chers collègues, nous arrivons au terme de l'examen de ce texte.",
  "Il a été enrichi en commission par plus de deux cents amendements.",
  "Nous avons entendu les inquiétudes des collectivités et des associations.",
  "Le groupe votera ce texte parce qu'il apporte des moyens concrets aux communes rurales.",
  "Nous resterons vigilants sur son application.",
].join(" ");

test("l'extrait est fait de phrases réellement présentes dans le discours", () => {
  const { extrait } = extraireEssentiel(DISCOURS);
  for (const phrase of extrait.split(/(?<=[.!?])\s+/)) {
    assert.ok(DISCOURS.includes(phrase.trim()), `phrase absente du discours d'origine : ${phrase}`);
  }
});

test("la phrase qui annonce le vote et sa raison est retenue", () => {
  const { extrait } = extraireEssentiel(DISCOURS);
  assert.match(extrait, /Le groupe votera ce texte parce qu'il apporte des moyens concrets/);
});

test("un propos court n'est pas coupé", () => {
  const court = "Nous voterons contre. Ce texte manque de moyens.";
  const { extrait, complet } = extraireEssentiel(court);
  assert.equal(complet, true);
  assert.equal(extrait, court);
});

test("les didascalies du compte rendu sont retirées", () => {
  const avec =
    "Nous voterons pour ce texte parce qu'il protège les victimes. (Applaudissements sur les bancs du groupe SOC.) " +
    "Le travail doit se poursuivre au Sénat. Nous y serons attentifs. Rien n'est acquis.";
  const { extrait } = extraireEssentiel(avec);
  assert.doesNotMatch(extrait, /Applaudissements/);
});

test("un point d'abréviation ne coupe pas la phrase et reste dans le texte", () => {
  const avec =
    "Je regrette que M. Neuder n'ait pas pu soutenir son amendement sur la coordination des soins. " +
    "Mme Leboucher l'a dit avant moi, et je partage son analyse. " +
    "Nous voterons pour ce texte parce qu'il met en valeur le rôle des sentinelles. " +
    "Il reste beaucoup à faire. Le sujet mérite mieux.";
  const { extrait } = extraireEssentiel(avec);
  assert.doesNotMatch(extrait, /\bM\s+Neuder\b/);
  if (extrait.includes("Neuder")) assert.match(extrait, /M\. Neuder/);
});

test("une coupe entre deux phrases retenues est signalée", () => {
  const { discontinu } = extraireEssentiel(DISCOURS, 1);
  // Une seule phrase retenue, prise au milieu : rien n'est recollé, donc
  // aucune discontinuité interne à signaler.
  assert.equal(discontinu, false);

  const deuxEloignees = extraireEssentiel(
    [
      "Nous voterons pour ce texte parce qu'il protège les plus fragiles.",
      "Le débat a duré sept jours.",
      "Les collectivités ont été consultées.",
      "Beaucoup reste à faire sur le financement.",
      "C'est pourquoi nous resterons vigilants sur les moyens accordés aux communes.",
    ].join(" "),
    2,
  );
  assert.equal(deuxEloignees.discontinu, true);
});

test("sans phrase caractéristique, le début du propos est retenu", () => {
  const neutre = [
    "Le texte comporte douze articles répartis en trois titres distincts.",
    "Il a été déposé au mois de mars sur le bureau de l'Assemblée nationale.",
    "La commission des lois s'en est saisie au fond dans la foulée.",
    "Le rapporteur a mené une trentaine d'auditions préparatoires.",
    "Les travaux se sont étalés sur plusieurs semaines consécutives.",
  ].join(" ");
  const { extrait } = extraireEssentiel(neutre, 2);
  assert.match(extrait, /^Le texte comporte douze articles/);
});
