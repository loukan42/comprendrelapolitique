/**
 * Références vers les programmes politiques publiés.
 *
 * Le site renvoie vers les documents, il ne les héberge pas et n'en résume
 * pas le contenu : voir `scripts/import/programmes.ts` pour le détail de ce
 * choix. Les positions citées, quand elles existeront, viendront de
 * `enrichissement.programme_position`, chacune avec sa citation exacte.
 */

import { createServerFn } from "@tanstack/react-start";
import { enrichissementDisponible, requete } from "./db";

export type NatureProgramme =
  "presidentiel_2027" | "legislatif_2024" | "europeen_2024" | "projet_en_cours" | "aucun";

export interface ReferenceProgramme {
  id: string;
  formation: string;
  candidat: string | null;
  titre: string | null;
  nature: NatureProgramme;
  datePublication: string | null;
  url: string | null;
  note: string | null;
}

export interface FormationProgrammes {
  formation: string;
  documents: ReferenceProgramme[];
  /** Personnes suivies pour cette formation, sans document publié. */
  enAttente: ReferenceProgramme[];
}

export const chargerProgrammes = createServerFn({ method: "GET" }).handler(
  async (): Promise<FormationProgrammes[]> => {
    if (!(await enrichissementDisponible())) return [];

    const lignes = await requete<{
      id: string;
      formation: string;
      candidat: string | null;
      titre: string | null;
      nature: NatureProgramme;
      date_publication: string | null;
      url: string | null;
      note: string | null;
    }>(
      `SELECT id, formation, candidat, titre, nature,
              date_publication::text AS date_publication, url, note
         FROM enrichissement.programme
        ORDER BY formation, nature, date_publication DESC NULLS LAST`,
    );

    const parFormation = new Map<string, FormationProgrammes>();
    for (const l of lignes) {
      const entree = parFormation.get(l.formation) ?? {
        formation: l.formation,
        documents: [],
        enAttente: [],
      };
      const ref: ReferenceProgramme = {
        id: l.id,
        formation: l.formation,
        candidat: l.candidat,
        titre: l.titre,
        nature: l.nature,
        datePublication: l.date_publication,
        url: l.url,
        note: l.note,
      };
      if (l.nature === "aucun") entree.enAttente.push(ref);
      else entree.documents.push(ref);
      parFormation.set(l.formation, entree);
    }

    // Les formations ayant publié quelque chose d'abord : la page sert à
    // trouver un document, pas à constater des absences.
    return Array.from(parFormation.values()).sort((a, b) => {
      if (a.documents.length !== b.documents.length) {
        return b.documents.length - a.documents.length;
      }
      return a.formation.localeCompare(b.formation, "fr");
    });
  },
);
