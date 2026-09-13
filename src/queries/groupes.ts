/**
 * Fonctions serveur pour la page d'un groupe parlementaire (spécification
 * section 14). Un groupe peut réunir plusieurs partis et changer de nom :
 * cette page décrit l'organe tel qu'identifié par la source (`officiel.organe`),
 * jamais une correspondance parti/groupe qui n'existe pas encore dans le
 * modèle (spécification section 13).
 */

import { createServerFn } from "@tanstack/react-start";
import { requete, requeteUne } from "./db";

export interface MembreGroupe {
  acteurUid: string;
  civilite: string | null;
  prenom: string | null;
  nom: string;
}

export interface VoteGroupe {
  scrutinUid: string;
  dateScrutin: string;
  titre: string;
  sortLibelle: string | null;
  dossierUid: string | null;
  voixPour: number;
  voixContre: number;
  voixAbstention: number;
}

export interface DetailGroupe {
  organe: {
    uid: string;
    libelle: string | null;
    libelleAbrege: string | null;
    legislature: number | null;
  };
  membres: MembreGroupe[];
  votesEnsemble: VoteGroupe[];
  tauxUnite: { accord: number; total: number } | null;
}

export const chargerGroupe = createServerFn({ method: "GET" })
  .validator((uid: unknown): string => {
    if (typeof uid !== "string" || uid.length === 0) throw new Error("uid de groupe requis");
    return uid;
  })
  .handler(async ({ data: uid }): Promise<DetailGroupe | null> => {
    const organe = await requeteUne<{
      uid: string;
      libelle: string | null;
      libelle_abrege: string | null;
      legislature: number | null;
    }>(
      `SELECT uid, libelle, libelle_abrege, legislature FROM officiel.organe WHERE uid = $1 AND code_type = 'GP'`,
      [uid],
    );
    if (!organe) return null;

    const membresRows = await requete<{
      acteur_uid: string;
      civilite: string | null;
      prenom: string | null;
      nom: string;
    }>(
      `SELECT DISTINCT a.uid AS acteur_uid, a.civilite, a.prenom, a.nom
         FROM officiel.mandat m
         JOIN officiel.acteur a ON a.uid = m.acteur_uid
        WHERE m.organe_uid = $1 AND m.type_organe = 'GP'
        ORDER BY a.nom`,
      [uid],
    );

    const votesRows = await requete<{
      scrutin_uid: string;
      date_scrutin: string;
      titre: string;
      sort_libelle: string | null;
      dossier_uid: string | null;
      voix_pour: number;
      voix_contre: number;
      voix_abstention: number;
    }>(
      `SELECT s.uid AS scrutin_uid, s.date_scrutin, s.titre, s.sort_libelle, sd.dossier_uid,
              sg.voix_pour, sg.voix_contre, sg.voix_abstention
         FROM officiel.scrutin_groupe sg
         JOIN officiel.scrutin s ON s.uid = sg.scrutin_uid
         LEFT JOIN officiel.scrutin_dossier sd ON sd.scrutin_uid = s.uid
        WHERE sg.organe_uid = $1 AND s.est_vote_sur_ensemble
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
        WHERE v.organe_uid = $1
          AND v.position IN ('POUR', 'CONTRE', 'ABSTENTION')
          AND sg.position_majoritaire IS NOT NULL`,
      [uid],
    );

    return {
      organe: {
        uid: organe.uid,
        libelle: organe.libelle,
        libelleAbrege: organe.libelle_abrege,
        legislature: organe.legislature,
      },
      membres: membresRows.map((m) => ({
        acteurUid: m.acteur_uid,
        civilite: m.civilite,
        prenom: m.prenom,
        nom: m.nom,
      })),
      votesEnsemble: votesRows.map((v) => ({
        scrutinUid: v.scrutin_uid,
        dateScrutin: v.date_scrutin,
        titre: v.titre,
        sortLibelle: v.sort_libelle,
        dossierUid: v.dossier_uid,
        voixPour: Number(v.voix_pour),
        voixContre: Number(v.voix_contre),
        voixAbstention: Number(v.voix_abstention),
      })),
      tauxUnite: uniteRow
        ? { accord: Number(uniteRow.accord), total: Number(uniteRow.total) }
        : null,
    };
  });
