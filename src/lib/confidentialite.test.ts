/**
 * Invariant de confidentialité du quiz.
 *
 * docs/QUIZ_METHODOLOGY.md section 1 : une réponse de quiz est une opinion
 * politique, donnée sensible au sens de l'article 9 du RGPD. Elle ne doit
 * jamais atteindre le serveur. Le calcul se fait donc dans le navigateur, à
 * partir de données publiques chargées avant toute réponse.
 *
 * Cette propriété ne se voit pas à l'usage : un site qui enverrait les
 * réponses fonctionnerait exactement pareil. Rien d'autre que ce test ne la
 * protège d'une régression, d'où sa présence ici plutôt que dans une note.
 *
 * Ce qui est vérifié : aucun module de calcul n'importe de module serveur.
 * `src/queries/` est marqué côté client par la configuration Vite, et un
 * import depuis un fichier embarqué dans le navigateur y ferait échouer le
 * build ; ce test attrape la faute plus tôt et dit pourquoi.
 */

import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const DOSSIER = new URL(".", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Modules de calcul du quiz, exécutés dans le navigateur. */
const MODULES_CLIENT = [
  "quizCalcul.ts",
  "quizPosition.ts",
  "extraitIntervention.ts",
  "qcmProgrammes.ts",
];

/**
 * Un `import type` est effacé à la compilation : il ne fait entrer aucun code
 * dans le paquet envoyé au navigateur, et emprunter un type à un module
 * serveur est donc sans conséquence. Un import de valeur, lui, embarquerait
 * le module. C'est cette distinction que le test doit faire, et pas
 * l'interdiction en bloc, sinon il pousse à recopier des types pour le
 * satisfaire.
 */
function importsDeValeur(source: string): string[] {
  return [...source.matchAll(/import\s+(type\s+)?([\s\S]*?)from\s+["']([^"']+)["']/g)]
    .filter((m) => {
      if (m[1]) return false; // import type { … }
      // `import { type X, type Y } from …` : tous les spécificateurs sont des
      // types, la déclaration est donc elle aussi effacée.
      const specificateurs = m[2] ?? "";
      const noms = specificateurs
        .replace(/[{}]/g, "")
        .split(",")
        .map((s) => s.trim());
      return !noms.every((n) => n === "" || n.startsWith("type "));
    })
    .map((m) => m[3]!);
}

test("le détecteur distingue un import de type d'un import de code", () => {
  // Sans ce test, le garde-fou pourrait ne plus rien détecter sans que rien
  // ne le signale : il passerait au vert pour de mauvaises raisons.
  const efface = [
    `import type { QuestionQuiz } from "../queries/quiz";`,
    `import { type A, type B } from "../queries/quiz";`,
  ];
  for (const s of efface) {
    assert.deepEqual(importsDeValeur(s), [], `devrait être effacé : ${s}`);
  }

  const embarque = [
    `import { chargerQuestions } from "../queries/quiz";`,
    `import { type A, chargerQuestions } from "../queries/quiz";`,
    `import chargerQuestions from "../queries/quiz";`,
  ];
  for (const s of embarque) {
    assert.deepEqual(importsDeValeur(s), ["../queries/quiz"], `devrait être détecté : ${s}`);
  }
});

test("aucun module de calcul n'importe de code serveur", async () => {
  for (const nom of MODULES_CLIENT) {
    const source = await readFile(join(DOSSIER, nom), "utf8");
    for (const chemin of importsDeValeur(source)) {
      assert.ok(
        !chemin.includes("queries/"),
        `${nom} importe du code depuis ${chemin} : les réponses du quiz ne doivent jamais atteindre le serveur`,
      );
      assert.ok(
        !chemin.includes("@tanstack/react-start"),
        `${nom} importe ${chemin}, qui expose createServerFn`,
      );
    }
  }
});

test("aucune fonction serveur ne prend de réponse de quiz en paramètre", async () => {
  const dossierQueries = join(DOSSIER, "..", "queries");
  const fichiers = (await readdir(dossierQueries)).filter((f) => f.endsWith(".ts"));

  // Les noms qui trahiraient le passage d'une réponse au serveur. Une
  // fonction serveur peut parler de questions (elle les fournit), jamais de
  // réponses (elle ne doit pas les recevoir).
  const interdits = /\b(reponses?Utilisateur|reponsesQuiz|mesReponses|answers)\b/;

  for (const f of fichiers) {
    const source = await readFile(join(dossierQueries, f), "utf8");
    assert.ok(
      !interdits.test(source),
      `queries/${f} manipule des réponses d'utilisateur, ce que la contrainte RGPD interdit`,
    );
  }
});
