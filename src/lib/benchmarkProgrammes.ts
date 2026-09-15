/**
 * Calcul du comparateur de programmes, exécuté dans le navigateur.
 *
 * Chaque question à axe porte deux pôles formulés sans jugement, et chaque
 * citation y est placée de -2 à +2, ou laissée hors axe quand elle parle
 * d'autre chose. Ce placement est une lecture du site, écrite en clair dans
 * `scripts/import/positions_programme.ts` et affichée à côté de la citation
 * qu'il résume : le lecteur peut la contester sur pièce.
 *
 * Le comparateur publie des décomptes, pas un pourcentage : sur deux
 * formations, combien de questions où leurs positions sont identiques ou
 * proches (écart 0 ou 1), éloignées (2) ou opposées (3 ou 4), sur les
 * questions où les deux ont une position placée. Un pourcentage calculé sur
 * trois à dix questions, à partir de lectures éditoriales, laissait croire à
 * une mesure (audit méthodologique du 15 septembre 2026).
 *
 * L'incertitude publiée est la sensibilité à ces lectures : un écart de 1 ou
 * de 3 change de catégorie si un placement bouge d'un cran. Les placements ne
 * sont pas un échantillon, un intervalle de confiance n'aurait pas de sens.
 *
 * `proximite` (moyenne de 1 − écart / 4) reste calculée pour les tests et
 * les contrôles ; la page ne l'affiche plus.
 */

export interface PositionBenchmark {
  formation: string;
  candidat: string | null;
  /** Place sur l'axe, de -2 à +2 ; nulle hors axe ou quand la question n'en a pas. */
  echelle: number | null;
  extrait: string;
  url: string | null;
  titreDocument: string | null;
  natureDocument: string;
}

export interface QuestionBenchmark {
  id: string;
  theme: string;
  intitule: string;
  /** Pôle à -2 de l'axe ; nul quand les réponses ne se rangent pas sur un axe. */
  axeMoins: string | null;
  /** Pôle à +2 de l'axe. */
  axePlus: string | null;
  positions: PositionBenchmark[];
}

export interface FormationBenchmark {
  formation: string;
  candidat: string | null;
}

/** Écart maximal entre deux positions : d'un pôle à l'autre. */
export const ECART_MAX = 4;
/** Nombre de questions communes en dessous duquel aucune paire n'est décomptée. */
export const MINIMUM_QUESTIONS_COMMUNES = 3;
/** Nombre de questions communes à partir duquel une case de la matrice est colorée. */
export const MINIMUM_COULEUR_MATRICE = 5;

export const ACCORDS = ["identique", "proche", "eloigne", "oppose"] as const;
export type Accord = (typeof ACCORDS)[number];

export const LIBELLE_ACCORD: Record<Accord, string> = {
  identique: "même position",
  proche: "positions proches",
  eloigne: "positions éloignées",
  oppose: "positions opposées",
};

export function accordDe(ecart: number): Accord {
  if (ecart <= 0) return "identique";
  if (ecart === 1) return "proche";
  if (ecart === 2) return "eloigne";
  return "oppose";
}

export function positionDe(q: QuestionBenchmark, formation: string): PositionBenchmark | null {
  return q.positions.find((p) => p.formation === formation) ?? null;
}

export interface LigneComparaison {
  question: QuestionBenchmark;
  a: PositionBenchmark | null;
  b: PositionBenchmark | null;
  /** Écart sur l'axe ; nul sans axe, sans position ou hors axe pour l'un des deux. */
  ecart: number | null;
}

export interface Comparaison {
  lignes: LigneComparaison[];
  /** Questions où les deux formations ont une position placée sur l'axe. */
  communes: number;
  /** Moyenne de 1 − écart / 4 ; nulle sous le minimum. Non affichée. */
  proximite: number | null;
  repartition: Record<Accord, number>;
  /** Écarts de 1 ou de 3 : ils changeraient de catégorie avec un cran de lecture. */
  fragiles: number;
  /** Écart de 0 ou 1, du plus proche au moins proche. */
  pointsCommuns: LigneComparaison[];
  /** Écart de 3 ou 4, du plus opposé au moins opposé. */
  differences: LigneComparaison[];
}

export function comparer(questions: QuestionBenchmark[], a: string, b: string): Comparaison {
  const lignes: LigneComparaison[] = questions.map((question) => {
    const pa = positionDe(question, a);
    const pb = positionDe(question, b);
    const ecart =
      question.axeMoins !== null && pa?.echelle != null && pb?.echelle != null
        ? Math.abs(pa.echelle - pb.echelle)
        : null;
    return { question, a: pa, b: pb, ecart };
  });

  const placees = lignes.filter((l): l is LigneComparaison & { ecart: number } => l.ecart !== null);
  const repartition = Object.fromEntries(ACCORDS.map((x) => [x, 0])) as Record<Accord, number>;
  for (const l of placees) repartition[accordDe(l.ecart)] += 1;

  const communes = placees.length;
  const proximite =
    communes >= MINIMUM_QUESTIONS_COMMUNES
      ? placees.reduce((somme, l) => somme + 1 - l.ecart / ECART_MAX, 0) / communes
      : null;

  return {
    lignes,
    communes,
    proximite,
    repartition,
    fragiles: placees.filter((l) => l.ecart === 1 || l.ecart === 3).length,
    pointsCommuns: placees.filter((l) => l.ecart <= 1).sort((x, y) => x.ecart - y.ecart),
    differences: placees.filter((l) => l.ecart >= 3).sort((x, y) => y.ecart - x.ecart),
  };
}

/**
 * Formations présentes dans le corpus, de la plus documentée à la moins
 * documentée. Le candidat n'est retenu que si toutes les citations de la
 * formation le nomment : sinon, des propositions du parti seraient
 * présentées comme les siennes.
 */
export function formationsDe(questions: QuestionBenchmark[]): FormationBenchmark[] {
  const compte = new Map<string, { candidats: Set<string>; sansCandidat: boolean; n: number }>();
  for (const q of questions) {
    for (const p of q.positions) {
      const connu = compte.get(p.formation) ?? {
        candidats: new Set<string>(),
        sansCandidat: false,
        n: 0,
      };
      connu.n += 1;
      if (p.candidat) connu.candidats.add(p.candidat);
      else connu.sansCandidat = true;
      compte.set(p.formation, connu);
    }
  }
  return [...compte.entries()]
    .sort((x, y) => y[1].n - x[1].n || x[0].localeCompare(y[0], "fr"))
    .map(([formation, v]) => ({
      formation,
      candidat: !v.sansCandidat && v.candidats.size === 1 ? ([...v.candidats][0] ?? null) : null,
    }));
}

export interface Matrice {
  formations: FormationBenchmark[];
  /** Moyenne de 1 − écart / 4 ; nulle sous le minimum. Non affichée. */
  proximite: (number | null)[][];
  communes: number[][];
  /** Questions où les positions sont identiques ou proches. */
  proches: number[][];
  /** Questions où les positions sont opposées. */
  opposees: number[][];
}

export function matriceProximite(
  questions: QuestionBenchmark[],
  formations: FormationBenchmark[],
): Matrice {
  const vide = () => formations.map(() => formations.map(() => 0));
  const proximite = formations.map(() => formations.map((): number | null => null));
  const communes = vide();
  const proches = vide();
  const opposees = vide();
  formations.forEach((fa, i) => {
    formations.forEach((fb, j) => {
      if (j <= i) return;
      const c = comparer(questions, fa.formation, fb.formation);
      const p = c.repartition.identique + c.repartition.proche;
      proximite[i]![j] = proximite[j]![i] = c.proximite;
      communes[i]![j] = communes[j]![i] = c.communes;
      proches[i]![j] = proches[j]![i] = p;
      opposees[i]![j] = opposees[j]![i] = c.repartition.oppose;
    });
  });
  return { formations, proximite, communes, proches, opposees };
}

/** Nom court d'une formation pour les en-têtes : le nom usuel du candidat, ou un sigle. */
export function nomCourt(f: FormationBenchmark): string {
  if (f.candidat) {
    const usuels: Record<string, string> = {
      "Marine Le Pen": "Le Pen",
      "Jean-Luc Mélenchon": "Mélenchon",
      "Édouard Philippe": "Philippe",
      "Gabriel Attal": "Attal",
      "Bruno Retailleau": "Retailleau",
      "Raphaël Glucksmann": "Glucksmann",
      "David Lisnard": "Lisnard",
      "Fabien Roussel": "Roussel",
    };
    return usuels[f.candidat] ?? f.candidat.split(" ").slice(-1)[0] ?? f.candidat;
  }
  const sigles: Record<string, string> = {
    "Parti socialiste": "PS",
    "Parti communiste français": "PCF",
    "La France insoumise": "LFI",
    "Rassemblement National": "RN",
    "Les Républicains": "LR",
    "Nouvelle Énergie": "N. Énergie",
    "Place publique": "P. publique",
  };
  return sigles[f.formation] ?? f.formation;
}

export function libelleFormation(f: FormationBenchmark): string {
  return f.candidat ? `${f.candidat} (${f.formation})` : f.formation;
}
