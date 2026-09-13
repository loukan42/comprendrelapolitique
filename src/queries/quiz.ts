/**
 * Grand quiz (spécification sections 5 à 8) : une quinzaine de grandes
 * décisions réparties entre les thèmes, comparaison de la réponse de
 * l'utilisateur aux groupes parlementaires.
 *
 * Sélection des questions : les scrutins sur l'ensemble d'un texte les plus
 * suivis (suffrages exprimés), un par dossier, répartis entre les thèmes de
 * `themes.ts` (au plus deux questions par thème avant d'y revenir, pour ne
 * pas laisser un sujet dominer le quiz). Le `salience_score` décrit par
 * docs/SCORING.md n'est pas encore calculé (aucune table ne le porte) : le
 * nombre de suffrages exprimés sert de proxy provisoire, pas au score
 * d'importance définitif, et l'attribution thématique par mots-clés
 * (`themes.ts`) est provisoire elle aussi. Le libellé de chaque question est
 * celui de la source (`objet_libelle`), jamais une reformulation : la
 * spécification interdit explicitement de fabriquer une question qui
 * déforme le scrutin réel.
 *
 * La comparaison ne porte que sur les groupes parlementaires, jamais sur un
 * vote individuel déduit (AGENTS.md section 5) : chaque position de groupe
 * vient de `officiel.scrutin_groupe`, qui agrège des votes réellement
 * enregistrés.
 */

import { createServerFn } from "@tanstack/react-start";
import { requete } from "./db";
import { themeDepuisTitre, themeParSlug } from "./themes";

export interface QuestionQuiz {
  scrutinUid: string;
  dossierUid: string | null;
  dossierTitre: string | null;
  objetLibelle: string;
  dateScrutin: string;
  theme: string | null;
  themeLibelle: string | null;
}

export const REPONSES_POSSIBLES = ["POUR", "CONTRE", "ABSTENTION", "NSP"] as const;
export type ReponseQuiz = (typeof REPONSES_POSSIBLES)[number];

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

/** Les 5 dossiers les plus suivis, tous thèmes confondus : pour la homepage. */
export const chargerQuestionsExpress = createServerFn({ method: "GET" }).handler(
  async (): Promise<QuestionQuiz[]> => {
    const dossiers = await chargerDossiersFinaux();
    return dossiers
      .sort((a, b) => b.suffragesExprimes - a.suffragesExprimes)
      .slice(0, 5)
      .map((d) => ({ ...d, theme: null, themeLibelle: null }));
  },
);

/**
 * Répartit les dossiers entre thèmes par tours : au premier tour, le
 * dossier le plus suivi de chaque thème ; au second tour, le deuxième de
 * chaque thème qui en a un ; ainsi de suite jusqu'à `cible` questions. Un
 * thème ne peut donc dominer qu'après que tous les autres ont contribué au
 * moins autant.
 */
function repartirParTheme(dossiers: DossierFinal[], cible: number): QuestionQuiz[] {
  const parTheme = new Map<string, DossierFinal[]>();
  for (const d of dossiers) {
    const theme = themeDepuisTitre(d.dossierTitre);
    if (!theme) continue;
    const liste = parTheme.get(theme) ?? [];
    liste.push(d);
    parTheme.set(theme, liste);
  }
  for (const liste of parTheme.values())
    liste.sort((a, b) => b.suffragesExprimes - a.suffragesExprimes);

  const selection: QuestionQuiz[] = [];
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
    return repartirParTheme(dossiers, 16);
  },
);

export interface ReponseUtilisateur {
  scrutinUid: string;
  reponse: ReponseQuiz;
}

export interface ProximiteGroupe {
  organeUid: string;
  libelle: string | null;
  proximite: number;
  questionsRepondues: number;
}

export interface ProximiteTheme {
  theme: string;
  libelle: string;
  /** Part moyenne de l'Assemblée qui partageait la réponse de l'utilisateur, sur ce thème. */
  soutienMoyen: number;
  questions: number;
}

export interface QuestionComparee {
  scrutinUid: string;
  dossierTitre: string | null;
  objetLibelle: string;
  reponse: ReponseQuiz;
  theme: string | null;
  soutienChambre: number;
}

export interface ResultatQuiz {
  parGroupe: ProximiteGroupe[];
  parTheme: ProximiteTheme[];
  accords: QuestionComparee[];
  desaccords: QuestionComparee[];
}

const RESULTAT_VIDE: ResultatQuiz = { parGroupe: [], parTheme: [], accords: [], desaccords: [] };

export const calculerResultat = createServerFn({ method: "POST" })
  .validator((reponses: unknown): ReponseUtilisateur[] => {
    if (!Array.isArray(reponses)) throw new Error("réponses invalides");
    return reponses as ReponseUtilisateur[];
  })
  .handler(async ({ data: reponses }): Promise<ResultatQuiz> => {
    const utiles = reponses.filter((r) => r.reponse !== "NSP");
    if (utiles.length === 0) return RESULTAT_VIDE;

    const scrutinUids = utiles.map((r) => r.scrutinUid);
    const lignes = await requete<{
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

    const dossiers = await requete<{
      scrutin_uid: string;
      dossier_titre: string | null;
      objet_libelle: string;
    }>(
      `SELECT s.uid AS scrutin_uid, d.titre AS dossier_titre, s.objet_libelle
         FROM officiel.scrutin s
         LEFT JOIN officiel.scrutin_dossier sd ON sd.scrutin_uid = s.uid
         LEFT JOIN officiel.dossier d ON d.uid = sd.dossier_uid
        WHERE s.uid = ANY($1)`,
      [scrutinUids],
    );
    const dossierParScrutin = new Map(dossiers.map((d) => [d.scrutin_uid, d]));

    function partAccord(reponse: ReponseQuiz, l: (typeof lignes)[number]): number {
      const total = l.voix_pour + l.voix_contre + l.voix_abstention;
      if (total === 0) return 0;
      if (reponse === "POUR") return l.voix_pour / total;
      if (reponse === "CONTRE") return l.voix_contre / total;
      return l.voix_abstention / total;
    }

    const parGroupe = new Map<
      string,
      { libelle: string | null; sommeProximite: number; questions: number }
    >();
    const comparees: QuestionComparee[] = [];

    for (const reponse of utiles) {
      const lignesScrutin = lignes.filter((l) => l.scrutin_uid === reponse.scrutinUid);
      let soutienTotalPour = 0;
      let soutienTotalContre = 0;
      let soutienTotalAbstention = 0;

      for (const ligne of lignesScrutin) {
        const part = partAccord(reponse.reponse, ligne);
        const courant = parGroupe.get(ligne.organe_uid) ?? {
          libelle: ligne.libelle,
          sommeProximite: 0,
          questions: 0,
        };
        courant.sommeProximite += part;
        courant.questions += 1;
        parGroupe.set(ligne.organe_uid, courant);

        soutienTotalPour += ligne.voix_pour;
        soutienTotalContre += ligne.voix_contre;
        soutienTotalAbstention += ligne.voix_abstention;
      }

      const totalChambre = soutienTotalPour + soutienTotalContre + soutienTotalAbstention;
      if (totalChambre > 0) {
        const soutienChambre =
          reponse.reponse === "POUR"
            ? soutienTotalPour / totalChambre
            : reponse.reponse === "CONTRE"
              ? soutienTotalContre / totalChambre
              : soutienTotalAbstention / totalChambre;
        const d = dossierParScrutin.get(reponse.scrutinUid);
        comparees.push({
          scrutinUid: reponse.scrutinUid,
          dossierTitre: d?.dossier_titre ?? null,
          objetLibelle: d?.objet_libelle ?? "",
          reponse: reponse.reponse,
          theme: themeDepuisTitre(d?.dossier_titre ?? null),
          soutienChambre,
        });
      }
    }

    const parGroupeTrie = Array.from(parGroupe.entries())
      .map(([organeUid, v]) => ({
        organeUid,
        libelle: v.libelle,
        proximite: v.sommeProximite / v.questions,
        questionsRepondues: v.questions,
      }))
      .filter((g) => g.questionsRepondues >= Math.min(3, utiles.length))
      .sort((a, b) => b.proximite - a.proximite);

    const sommeParTheme = new Map<string, { somme: number; questions: number }>();
    for (const c of comparees) {
      if (!c.theme) continue;
      const t = sommeParTheme.get(c.theme) ?? { somme: 0, questions: 0 };
      t.somme += c.soutienChambre;
      t.questions += 1;
      sommeParTheme.set(c.theme, t);
    }
    const parTheme = Array.from(sommeParTheme.entries())
      .map(([theme, v]) => ({
        theme,
        libelle: themeParSlug(theme)?.libelle ?? theme,
        soutienMoyen: v.somme / v.questions,
        questions: v.questions,
      }))
      .sort((a, b) => b.soutienMoyen - a.soutienMoyen);

    const compareesTriees = [...comparees].sort((a, b) => b.soutienChambre - a.soutienChambre);

    return {
      parGroupe: parGroupeTrie,
      parTheme,
      accords: compareesTriees.slice(0, 3),
      desaccords: compareesTriees.slice(-3).reverse(),
    };
  });
