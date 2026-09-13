/**
 * Fonctions serveur pour la page d'un parlementaire (spécification section
 * 15). Le groupe d'un député est celui du mandat `GP` au moment considéré :
 * jamais déduit d'un intervalle de dates recalculé (AGENTS.md section 5,
 * règle « groupe au moment du vote »), toujours lu depuis la structure de la
 * source (`officiel.vote.organe_uid`, déjà posé au moment de l'import).
 */

import { createServerFn } from "@tanstack/react-start";
import { requete, requeteUne } from "./db";

export interface GroupeAppartenance {
  organeUid: string;
  libelle: string | null;
  libelleAbrege: string | null;
  dateDebut: string;
  dateFin: string | null;
}

export interface VoteRecent {
  scrutinUid: string;
  dateScrutin: string;
  titre: string;
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT";
  estVoteSurEnsemble: boolean;
  dossierUid: string | null;
}

export interface ProximiteGroupeDepute {
  organeUid: string;
  libelle: string | null;
  legislature: number | null;
  /** `couleurAssociee` du référentiel de l'Assemblée, ou null. */
  couleur: string | null;
  accord: number;
  total: number;
}

export interface DetailDepute {
  acteur: {
    uid: string;
    civilite: string | null;
    prenom: string | null;
    nom: string;
  };
  groupes: GroupeAppartenance[];
  votesRecents: VoteRecent[];
  tauxUnite: { accord: number; total: number } | null;
  participation: { votesExprimes: number; totalScrutins: number } | null;
  proximiteGroupes: ProximiteGroupeDepute[];
}

export const chargerDepute = createServerFn({ method: "GET" })
  .validator((uid: unknown): string => {
    if (typeof uid !== "string" || uid.length === 0) throw new Error("uid de député requis");
    return uid;
  })
  .handler(async ({ data: uid }): Promise<DetailDepute | null> => {
    const acteur = await requeteUne<{
      uid: string;
      civilite: string | null;
      prenom: string | null;
      nom: string;
    }>(`SELECT uid, civilite, prenom, nom FROM officiel.acteur WHERE uid = $1`, [uid]);
    if (!acteur) return null;

    const groupesRows = await requete<{
      organe_uid: string;
      libelle: string | null;
      libelle_abrege: string | null;
      date_debut: string;
      date_fin: string | null;
    }>(
      `SELECT m.organe_uid, o.libelle, o.libelle_abrege, m.date_debut, m.date_fin
         FROM officiel.mandat m
         LEFT JOIN officiel.organe o ON o.uid = m.organe_uid
        WHERE m.acteur_uid = $1 AND m.type_organe = 'GP'
        ORDER BY m.date_debut`,
      [uid],
    );

    const votesRows = await requete<{
      scrutin_uid: string;
      date_scrutin: string;
      titre: string;
      position: VoteRecent["position"];
      est_vote_sur_ensemble: boolean;
      dossier_uid: string | null;
    }>(
      `SELECT v.scrutin_uid, s.date_scrutin, s.titre, v.position, s.est_vote_sur_ensemble,
              sd.dossier_uid
         FROM officiel.vote v
         JOIN officiel.scrutin s ON s.uid = v.scrutin_uid
         LEFT JOIN officiel.scrutin_dossier sd ON sd.scrutin_uid = s.uid
        WHERE v.acteur_uid = $1
        ORDER BY s.date_scrutin DESC
        LIMIT 30`,
      [uid],
    );

    const uniteRow = await requeteUne<{ accord: string; total: string }>(
      `SELECT
          count(*) FILTER (WHERE upper(sg.position_majoritaire) = v.position::text) AS accord,
          count(*) AS total
         FROM officiel.vote v
         JOIN officiel.scrutin_groupe sg
           ON sg.scrutin_uid = v.scrutin_uid AND sg.organe_uid = v.organe_uid
        WHERE v.acteur_uid = $1
          AND v.position IN ('POUR', 'CONTRE', 'ABSTENTION')
          AND sg.position_majoritaire IS NOT NULL`,
      [uid],
    );

    // Participation : scrutins où le député a une position enregistrée,
    // rapportés au total des scrutins tenus pendant son ou ses mandats de
    // député (type ASSEMBLEE), pas depuis le début de la législature entière
    // si son mandat a commencé ou fini en cours de route.
    const participationRow = await requeteUne<{
      votes_exprimes: string;
      total_scrutins: string;
    }>(
      `WITH mandats_an AS (
          SELECT legislature, date_debut, COALESCE(date_fin, now()) AS date_fin
            FROM officiel.mandat
           WHERE acteur_uid = $1 AND type_organe = 'ASSEMBLEE'
       )
       SELECT
          (SELECT count(*)
             FROM officiel.vote v
             JOIN officiel.scrutin s ON s.uid = v.scrutin_uid
             JOIN mandats_an m ON s.legislature = m.legislature
                              AND s.date_scrutin BETWEEN m.date_debut AND m.date_fin
            WHERE v.acteur_uid = $1) AS votes_exprimes,
          (SELECT count(*)
             FROM officiel.scrutin s
             JOIN mandats_an m ON s.legislature = m.legislature
                              AND s.date_scrutin BETWEEN m.date_debut AND m.date_fin
          ) AS total_scrutins`,
      [uid],
    );

    // Proximité avec chaque groupe (pas seulement le sien) : même méthode
    // que le quiz (docs/QUIZ_METHODOLOGY.md), appliquée aux votes réels de
    // ce parlementaire plutôt qu'aux réponses d'un visiteur.
    const proximiteRows = await requete<{
      organe_uid: string;
      libelle: string | null;
      legislature: number | null;
      couleur: string | null;
      accord: string;
      total: string;
    }>(
      `SELECT sg.organe_uid, o.libelle, o.legislature, o.couleur,
              count(*) FILTER (WHERE upper(sg.position_majoritaire) = v.position::text) AS accord,
              count(*) AS total
         FROM officiel.vote v
         JOIN officiel.scrutin_groupe sg ON sg.scrutin_uid = v.scrutin_uid
         LEFT JOIN officiel.organe o ON o.uid = sg.organe_uid
        WHERE v.acteur_uid = $1
          AND v.position IN ('POUR', 'CONTRE', 'ABSTENTION')
          AND sg.position_majoritaire IS NOT NULL
          AND sg.organe_uid IS NOT NULL
        GROUP BY sg.organe_uid, o.libelle, o.legislature, o.couleur
       HAVING count(*) >= 20`,
      [uid],
    );

    return {
      acteur: {
        uid: acteur.uid,
        civilite: acteur.civilite,
        prenom: acteur.prenom,
        nom: acteur.nom,
      },
      groupes: groupesRows.map((g) => ({
        organeUid: g.organe_uid,
        libelle: g.libelle,
        libelleAbrege: g.libelle_abrege,
        dateDebut: g.date_debut,
        dateFin: g.date_fin,
      })),
      votesRecents: votesRows.map((v) => ({
        scrutinUid: v.scrutin_uid,
        dateScrutin: v.date_scrutin,
        titre: v.titre,
        position: v.position,
        estVoteSurEnsemble: v.est_vote_sur_ensemble,
        dossierUid: v.dossier_uid,
      })),
      tauxUnite: uniteRow
        ? { accord: Number(uniteRow.accord), total: Number(uniteRow.total) }
        : null,
      participation: participationRow
        ? {
            votesExprimes: Number(participationRow.votes_exprimes),
            totalScrutins: Number(participationRow.total_scrutins),
          }
        : null,
      proximiteGroupes: proximiteRows
        .map((p) => ({
          organeUid: p.organe_uid,
          libelle: p.libelle,
          legislature: p.legislature,
          couleur: p.couleur,
          accord: Number(p.accord),
          total: Number(p.total),
        }))
        .sort((a, b) => b.accord / b.total - a.accord / a.total),
    };
  });
