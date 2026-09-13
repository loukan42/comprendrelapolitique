/**
 * Grand quiz (spécification sections 5 à 8, méthodologie détaillée dans
 * docs/QUIZ_METHODOLOGY.md) : une quinzaine de grandes décisions réparties
 * entre les thèmes.
 *
 * Sélection des questions : les scrutins sur l'ensemble d'un texte les plus
 * suivis (suffrages exprimés), un par dossier, répartis entre les thèmes de
 * `themes.ts` (au plus deux questions par thème avant d'y revenir, pour ne
 * pas laisser un sujet dominer le quiz). Le `salience_score` décrit par
 * docs/SCORING.md n'est pas encore calculé (aucune table ne le porte) : le
 * nombre de suffrages exprimés sert de proxy provisoire, pas au score
 * d'importance définitif, et l'attribution thématique par mots-clés
 * (`themes.ts`) est provisoire elle aussi. Le libellé affiché à
 * l'utilisateur est une question vulgarisée rédigée à la main
 * (`questionsQuiz.ts`), jamais générée à la volée : la spécification
 * interdit explicitement de fabriquer une question qui déforme le scrutin
 * réel, et le texte officiel (`objet_libelle`) reste toujours affiché à côté
 * pour la traçabilité.
 *
 * Contrainte non négociable (QUIZ_METHODOLOGY.md section 1) : une réponse au
 * quiz est une opinion politique, donnée sensible au sens de l'article 9 du
 * RGPD. Ce module ne reçoit donc jamais la réponse de l'utilisateur : il
 * fournit, pour chaque question, la répartition par groupe déjà publique
 * (`officiel.scrutin_groupe`), et c'est le client qui calcule la proximité
 * (`src/lib/quizCalcul.ts`), sans jamais renvoyer les réponses au serveur.
 */

import { createServerFn } from "@tanstack/react-start";
import { requete } from "./db";
import { QUESTIONS_VULGARISEES } from "./questionsQuiz";
import { themeDepuisTitre, themeParSlug } from "./themes";

export interface RepartitionGroupe {
  organeUid: string;
  libelle: string | null;
  voixPour: number;
  voixContre: number;
  voixAbstention: number;
}

export interface QuestionQuiz {
  scrutinUid: string;
  dossierUid: string | null;
  dossierTitre: string | null;
  objetLibelle: string;
  /** Question vulgarisée, avec point d'interrogation. Voir questionsQuiz.ts. */
  question: string;
  /** Un ou deux phrases de contexte sur ce que fait réellement le texte. */
  contexte: string | null;
  dateScrutin: string;
  theme: string | null;
  themeLibelle: string | null;
  repartition: RepartitionGroupe[];
}

/**
 * Reprend la fiche rédigée à la main pour ce dossier (questionsQuiz.ts).
 * À défaut, retombe sur le libellé officiel transformé en question : moins
 * lisible, mais jamais un texte inventé au-delà de ce que dit la source.
 */
function formulerQuestion(
  dossierUid: string | null,
  objetLibelle: string,
): { question: string; contexte: string | null } {
  const fiche = dossierUid ? QUESTIONS_VULGARISEES[dossierUid] : undefined;
  if (fiche) return fiche;
  const propos = objetLibelle.replace(/\.$/, "");
  return { question: `Êtes-vous favorable à ${propos} ?`, contexte: null };
}

interface DossierFinal {
  scrutinUid: string;
  dossierUid: string | null;
  dossierTitre: string | null;
  objetLibelle: string;
  dateScrutin: string;
  suffragesExprimes: number;
}

async function chargerDossiersFinaux(): Promise<DossierFinal[]> {
  const rows = await requete<{
    scrutin_uid: string;
    dossier_uid: string | null;
    dossier_titre: string | null;
    objet_libelle: string;
    date_scrutin: string;
    suffrages_exprimes: number | null;
  }>(
    `SELECT DISTINCT ON (sd.dossier_uid)
            s.uid AS scrutin_uid, sd.dossier_uid, d.titre AS dossier_titre,
            s.objet_libelle, s.date_scrutin, s.suffrages_exprimes
       FROM officiel.scrutin s
       JOIN officiel.scrutin_dossier sd ON sd.scrutin_uid = s.uid
       LEFT JOIN officiel.dossier d ON d.uid = sd.dossier_uid
      WHERE s.est_vote_sur_ensemble AND sd.dossier_uid IS NOT NULL
      ORDER BY sd.dossier_uid, s.suffrages_exprimes DESC`,
  );
  return rows.map((r) => ({
    scrutinUid: r.scrutin_uid,
    dossierUid: r.dossier_uid,
    dossierTitre: r.dossier_titre,
    objetLibelle: r.objet_libelle,
    dateScrutin: r.date_scrutin,
    suffragesExprimes: r.suffrages_exprimes ?? 0,
  }));
}

/** Répartition par groupe des scrutins donnés : donnée publique, jamais liée à une réponse. */
async function chargerRepartitions(
  scrutinUids: string[],
): Promise<Map<string, RepartitionGroupe[]>> {
  if (scrutinUids.length === 0) return new Map();
  const rows = await requete<{
    scrutin_uid: string;
    organe_uid: string;
    libelle: string | null;
    voix_pour: number;
    voix_contre: number;
    voix_abstention: number;
  }>(
    `SELECT sg.scrutin_uid, sg.organe_uid, o.libelle, sg.voix_pour, sg.voix_contre, sg.voix_abstention
       FROM officiel.scrutin_groupe sg
       LEFT JOIN officiel.organe o ON o.uid = sg.organe_uid
      WHERE sg.scrutin_uid = ANY($1) AND sg.organe_uid IS NOT NULL`,
    [scrutinUids],
  );
  const parScrutin = new Map<string, RepartitionGroupe[]>();
  for (const r of rows) {
    const liste = parScrutin.get(r.scrutin_uid) ?? [];
    liste.push({
      organeUid: r.organe_uid,
      libelle: r.libelle,
      voixPour: r.voix_pour,
      voixContre: r.voix_contre,
      voixAbstention: r.voix_abstention,
    });
    parScrutin.set(r.scrutin_uid, liste);
  }
  return parScrutin;
}

async function assemblerQuestions(
  dossiers: (DossierFinal & { theme: string | null; themeLibelle: string | null })[],
): Promise<QuestionQuiz[]> {
  const repartitions = await chargerRepartitions(dossiers.map((d) => d.scrutinUid));
  return dossiers.map((d) => {
    const { question, contexte } = formulerQuestion(d.dossierUid, d.objetLibelle);
    return {
      scrutinUid: d.scrutinUid,
      dossierUid: d.dossierUid,
      dossierTitre: d.dossierTitre,
      objetLibelle: d.objetLibelle,
      question,
      contexte,
      dateScrutin: d.dateScrutin,
      theme: d.theme,
      themeLibelle: d.themeLibelle,
      repartition: repartitions.get(d.scrutinUid) ?? [],
    };
  });
}

/** Les 5 dossiers les plus suivis, tous thèmes confondus : pour la homepage. */
export const chargerQuestionsExpress = createServerFn({ method: "GET" }).handler(
  async (): Promise<QuestionQuiz[]> => {
    const dossiers = await chargerDossiersFinaux();
    const top5 = dossiers
      .sort((a, b) => b.suffragesExprimes - a.suffragesExprimes)
      .slice(0, 5)
      .map((d) => ({ ...d, theme: null, themeLibelle: null }));
    return assemblerQuestions(top5);
  },
);

/**
 * Répartit les dossiers entre thèmes par tours : au premier tour, un
 * dossier de chaque thème ; au second tour, un autre de chaque thème qui en
 * a un ; ainsi de suite jusqu'à `cible` questions. Un thème ne peut donc
 * dominer qu'après que tous les autres ont contribué au moins autant.
 *
 * Le dossier retenu au premier tour n'est pas toujours le plus suivi : s'il
 * existe une fiche rédigée à la main (`questionsQuiz.ts`) pour un autre
 * dossier parmi les trois plus suivis du thème, le tirage se fait au hasard
 * parmi ces dossiers déjà rédigés. Sans cela, « Refaire le quiz » posait
 * toujours exactement les mêmes 16 questions, puisque la sélection par
 * suffrages exprimés est déterministe. Un dossier sans fiche ne concourt
 * jamais à ce tirage : mieux vaut ne jamais le proposer que retomber sur la
 * reformulation générique à chaque partie.
 */
function repartirParTheme(
  dossiers: DossierFinal[],
  cible: number,
): (DossierFinal & { theme: string; themeLibelle: string })[] {
  const parTheme = new Map<string, DossierFinal[]>();
  for (const d of dossiers) {
    const theme = themeDepuisTitre(d.dossierTitre);
    if (!theme) continue;
    const liste = parTheme.get(theme) ?? [];
    liste.push(d);
    parTheme.set(theme, liste);
  }
  for (const liste of parTheme.values()) {
    liste.sort((a, b) => b.suffragesExprimes - a.suffragesExprimes);
    const candidats = liste
      .slice(0, 3)
      .map((d, i) => i)
      .filter((i) => liste[i]?.dossierUid && QUESTIONS_VULGARISEES[liste[i]!.dossierUid!]);
    if (candidats.length > 0) {
      const choisi = candidats[Math.floor(Math.random() * candidats.length)]!;
      const [tire] = liste.splice(choisi, 1);
      liste.unshift(tire!);
    }
  }

  const selection: (DossierFinal & { theme: string; themeLibelle: string })[] = [];
  for (let tour = 0; selection.length < cible; tour++) {
    let ajoute = false;
    for (const [theme, liste] of parTheme) {
      const d = liste[tour];
      if (!d) continue;
      ajoute = true;
      selection.push({ ...d, theme, themeLibelle: themeParSlug(theme)?.libelle ?? theme });
      if (selection.length >= cible) break;
    }
    if (!ajoute) break;
  }
  return selection;
}

export const chargerQuestionsGrandQuiz = createServerFn({ method: "GET" }).handler(
  async (): Promise<QuestionQuiz[]> => {
    const dossiers = await chargerDossiersFinaux();
    return assemblerQuestions(repartirParTheme(dossiers, 16));
  },
);
