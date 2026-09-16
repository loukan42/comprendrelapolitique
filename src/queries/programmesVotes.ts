import { createServerFn } from "@tanstack/react-start";
import { constatPubliable, type Constat } from "../lib/programmesVotes";
import type { NatureProgramme } from "./programmes";
import { requete, tableDisponible } from "./db";

export interface ComparaisonProgrammeVote {
  id: string;
  formation: string;
  candidat: string | null;
  theme: string;
  extrait: string;
  nature: NatureProgramme;
  document: string;
  sourceProgramme: string;
  dateProgramme: string | null;
  dateVote: string;
  titreVote: string;
  scrutinUid: string;
  legislature: number;
  numero: number;
  constat: Constat;
  explication: string;
  limites: string;
  sourceTexte: string;
  sourcePerimetre: string;
  perimetre: string;
  verifieLe: string;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  conflit: boolean;
  typeVote: string;
  ensemble: boolean;
}

export const chargerProgrammesVotes = createServerFn({ method: "GET" }).handler(
  async (): Promise<ComparaisonProgrammeVote[]> => {
    if (!(await tableDisponible("enrichissement.programme_vote"))) return [];
    const lignes = await requete<
      Omit<ComparaisonProgrammeVote, "constat"> & { constate: "ecart" | "convergence" | "nuance" }
    >(`
    SELECT pv.id, p.formation, p.candidat, pp.theme, pp.extrait, p.nature, p.titre AS document,
           COALESCE(pp.url_ancre, p.url) AS "sourceProgramme",
           p.date_publication::text AS "dateProgramme",
           s.date_scrutin::text AS "dateVote", s.titre AS "titreVote",
           s.uid AS "scrutinUid", s.legislature, s.numero, pv.constat AS constate,
           pv.explication, pv.limites, pv.source_texte AS "sourceTexte",
           pv.source_perimetre AS "sourcePerimetre", pv.perimetre,
           pv.verifie_le::text AS "verifieLe", s.type_vote_code AS "typeVote",
           s.est_vote_sur_ensemble AS ensemble,
           EXISTS (SELECT 1 FROM officiel.scrutin_dossier sd
                   WHERE sd.scrutin_uid = s.uid AND sd.methode = 'CONFLIT') AS conflit,
           votes.voix_pour AS pour, votes.voix_contre AS contre,
           votes.voix_abstention AS abstention,
           votes.voix_non_votant AS "nonVotant"
      FROM enrichissement.programme_vote pv
      JOIN enrichissement.programme_position pp ON pp.id = pv.position_id
      JOIN enrichissement.programme p ON p.id = pp.programme_id
      JOIN officiel.scrutin s ON s.uid = pv.scrutin_uid
      JOIN officiel.organe parti ON parti.uid = pv.parti_uid AND parti.code_type = 'GP'
      JOIN officiel.scrutin_groupe votes
        ON votes.scrutin_uid = s.uid AND votes.organe_uid = pv.parti_uid
     WHERE pv.publie AND COALESCE(pp.url_ancre, p.url) ~ '^https://'
     ORDER BY p.formation, s.date_scrutin DESC, pv.id
  `);
    return lignes.map((l) => ({
      ...l,
      constat: constatPubliable({
        typeVote: l.typeVote,
        ensemble: l.ensemble,
        conflit: l.conflit,
        nombreVotes: l.pour + l.contre + l.abstention,
        constate: l.constate,
      }),
    }));
  },
);
