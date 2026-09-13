/**
 * Quiz express (spécification section 11) : 5 grandes décisions, comparaison
 * de la réponse de l'utilisateur aux groupes parlementaires (section 12).
 *
 * Sélection des questions : les scrutins sur l'ensemble d'un texte les plus
 * suivis (suffrages exprimés), un par dossier. Le `salience_score` décrit
 * par docs/SCORING.md n'est pas encore calculé (aucune table ne le porte) :
 * le nombre de suffrages exprimés sert de proxy provisoire, pas au score
 * d'importance définitif. Le libellé de la question est celui de la source
 * (`objet_libelle`), jamais une reformulation : la spécification interdit
 * explicitement de fabriquer une question qui déforme le scrutin réel.
 *
 * La comparaison ne porte que sur les groupes parlementaires, jamais sur un
 * vote individuel déduit (AGENTS.md section 5) : chaque position de groupe
 * vient de `officiel.scrutin_groupe`, qui agrège des votes réellement
 * enregistrés.
 */

import { createServerFn } from "@tanstack/react-start";
import { requete } from "./db";

export interface QuestionQuiz {
  scrutinUid: string;
  dossierUid: string | null;
  dossierTitre: string | null;
  objetLibelle: string;
  dateScrutin: string;
}

export const REPONSES_POSSIBLES = ["POUR", "CONTRE", "ABSTENTION", "NSP"] as const;
export type ReponseQuiz = (typeof REPONSES_POSSIBLES)[number];

export const chargerQuestionsExpress = createServerFn({ method: "GET" }).handler(
  async (): Promise<QuestionQuiz[]> => {
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
    // Le DISTINCT ON garde le scrutin le plus suivi par dossier ; ce tri
    // choisit ensuite les 5 dossiers les plus suivis parmi eux.
    return rows
      .sort((a, b) => (b.suffrages_exprimes ?? 0) - (a.suffrages_exprimes ?? 0))
      .slice(0, 5)
      .map((r) => ({
        scrutinUid: r.scrutin_uid,
        dossierUid: r.dossier_uid,
        dossierTitre: r.dossier_titre,
        objetLibelle: r.objet_libelle,
        dateScrutin: r.date_scrutin,
      }));
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

export const calculerProximite = createServerFn({ method: "POST" })
  .validator((reponses: unknown): ReponseUtilisateur[] => {
    if (!Array.isArray(reponses)) throw new Error("réponses invalides");
    return reponses as ReponseUtilisateur[];
  })
  .handler(async ({ data: reponses }): Promise<ProximiteGroupe[]> => {
    const utiles = reponses.filter((r) => r.reponse !== "NSP");
    if (utiles.length === 0) return [];

    const scrutinUids = utiles.map((r) => r.scrutinUid);
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

    const parGroupe = new Map<
      string,
      { libelle: string | null; sommeProximite: number; questions: number }
    >();

    for (const reponse of utiles) {
      const lignesScrutin = rows.filter((r) => r.scrutin_uid === reponse.scrutinUid);
      for (const ligne of lignesScrutin) {
        const total = ligne.voix_pour + ligne.voix_contre + ligne.voix_abstention;
        if (total === 0) continue;
        const partAccord =
          reponse.reponse === "POUR"
            ? ligne.voix_pour / total
            : reponse.reponse === "CONTRE"
              ? ligne.voix_contre / total
              : ligne.voix_abstention / total;

        const courant = parGroupe.get(ligne.organe_uid) ?? {
          libelle: ligne.libelle,
          sommeProximite: 0,
          questions: 0,
        };
        courant.sommeProximite += partAccord;
        courant.questions += 1;
        parGroupe.set(ligne.organe_uid, courant);
      }
    }

    return Array.from(parGroupe.entries())
      .map(([organeUid, v]) => ({
        organeUid,
        libelle: v.libelle,
        proximite: v.sommeProximite / v.questions,
        questionsRepondues: v.questions,
      }))
      .filter((g) => g.questionsRepondues >= Math.min(3, utiles.length))
      .sort((a, b) => b.proximite - a.proximite);
  });
