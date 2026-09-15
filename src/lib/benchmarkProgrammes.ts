/**
 * Calcul du comparateur de programmes, exécuté dans le navigateur.
 *
 * Chaque question du comparateur porte un axe à deux pôles, formulés
 * neutrement (« Partir plus tôt », « Travailler plus longtemps »), et chaque
 * citation y est placée de -2 à +2. Ce placement est une lecture du site,
 * écrite en clair dans `scripts/import/positions_programme.ts` et affichée à
 * côté de la citation qu'il résume : le lecteur peut la contester sur pièce.
 *
 * La proximité de deux formations est la moyenne, sur les questions où les
 * deux ont une position placée, de 1 − écart / 4 : deux positions identiques
 * comptent 1, deux pôles opposés comptent 0. En dessous de trois questions
 * communes, aucun score n'est donné : il ne voudrait rien dire. Ce score
 * compare des citations choisies par le site ; il ne mesure pas une
 * proximité politique en général, et la page le dit.
 */

export interface PositionBenchmark {
  formation: string;
  candidat: string | null;
  /** Place sur l'axe de la question, de -2 à +2 ; nulle quand la question n'a pas d'axe. */
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
/** Nombre de questions communes en dessous duquel aucun score n'est donné. */
export const MINIMUM_QUESTIONS_COMMUNES = 3;

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
  /** Écart sur l'axe ; nul quand la question n'a pas d'axe ou qu'une position manque. */
  ecart: number | null;
}

export interface Comparaison {
  lignes: LigneComparaison[];
  /** Questions où les deux formations ont une position placée sur l'axe. */
  communes: number;
  /** Entre 0 et 1 ; nulle sous le minimum de questions communes. */
  proximite: number | null;
  repartition: Record<Accord, number>;
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
    pointsCommuns: placees.filter((l) => l.ecart <= 1).sort((x, y) => x.ecart - y.ecart),
    differences: placees.filter((l) => l.ecart >= 3).sort((x, y) => y.ecart - x.ecart),
  };
}

/**
 * Formations présentes dans le corpus, de la plus documentée à la moins
 * documentée, avec leur candidat quand un document en nomme un.
 */
export function formationsDe(questions: QuestionBenchmark[]): FormationBenchmark[] {
  const compte = new Map<string, { candidat: string | null; n: number }>();
  for (const q of questions) {
    for (const p of q.positions) {
      const connu = compte.get(p.formation);
      if (!connu) compte.set(p.formation, { candidat: p.candidat, n: 1 });
      else {
        connu.n += 1;
        if (!connu.candidat && p.candidat) connu.candidat = p.candidat;
      }
    }
  }
  return [...compte.entries()]
    .sort((x, y) => y[1].n - x[1].n || x[0].localeCompare(y[0], "fr"))
    .map(([formation, v]) => ({ formation, candidat: v.candidat }));
}

export interface Matrice {
  formations: FormationBenchmark[];
  /** proximite[i][j] entre 0 et 1 ; nulle sous le minimum de questions communes. */
  proximite: (number | null)[][];
  communes: number[][];
}

export function matriceProximite(
  questions: QuestionBenchmark[],
  formations: FormationBenchmark[],
): Matrice {
  const proximite = formations.map(() => formations.map((): number | null => null));
  const communes = formations.map(() => formations.map(() => 0));
  formations.forEach((fa, i) => {
    formations.forEach((fb, j) => {
      if (j <= i) return;
      const c = comparer(questions, fa.formation, fb.formation);
      proximite[i]![j] = c.proximite;
      proximite[j]![i] = c.proximite;
      communes[i]![j] = c.communes;
      communes[j]![i] = c.communes;
    });
  });
  return { formations, proximite, communes };
}

/** Nom court d'une formation pour les en-têtes : le nom du candidat, ou un sigle. */
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
  };
  return sigles[f.formation] ?? f.formation;
}

export function libelleFormation(f: FormationBenchmark): string {
  return f.candidat ? `${f.candidat} (${f.formation})` : f.formation;
}
