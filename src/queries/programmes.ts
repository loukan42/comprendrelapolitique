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

export interface PositionProgramme {
  id: string;
  formation: string;
  candidat: string | null;
  theme: string;
  sousTheme: string | null;
  /** Citation exacte, vérifiée contre le document source. */
  extrait: string;
  resumeAffichage: string | null;
  pageOuSection: string | null;
  url: string | null;
  titreDocument: string | null;
}

export interface ComparaisonTheme {
  theme: string;
  /** Positions de chaque formation demandée, dans l'ordre demandé. */
  colonnes: (PositionProgramme[] | null)[];
}

/**
 * Comparaison de deux formations, thème par thème.
 *
 * Une formation sans position sur un thème donne une colonne vide, jamais une
 * position déduite de son orientation générale : l'absence de proposition
 * publiée est une information, la combler serait une invention.
 */
export const comparerProgrammes = createServerFn({ method: "GET" })
  .validator((formations: unknown): string[] => {
    if (!Array.isArray(formations) || formations.length !== 2) {
      throw new Error("deux formations attendues");
    }
    return formations.map((f) => {
      if (typeof f !== "string" || f.length === 0) throw new Error("formation invalide");
      return f;
    });
  })
  .handler(async ({ data: formations }): Promise<ComparaisonTheme[]> => {
    if (!(await enrichissementDisponible())) return [];

    const lignes = await requete<{
      id: string;
      formation: string;
      candidat: string | null;
      theme: string;
      sous_theme: string | null;
      extrait: string;
      resume_affichage: string | null;
      page_ou_section: string | null;
      url_ancre: string | null;
      titre: string | null;
    }>(
      `SELECT pp.id, p.formation, p.candidat, pp.theme, pp.sous_theme, pp.extrait,
              pp.resume_affichage, pp.page_ou_section, pp.url_ancre, p.titre
         FROM enrichissement.programme_position pp
         JOIN enrichissement.programme p ON p.id = pp.programme_id
        WHERE p.formation = ANY($1)
        ORDER BY pp.theme, p.formation`,
      [formations],
    );

    const themes = Array.from(new Set(lignes.map((l) => l.theme))).sort((a, b) =>
      a.localeCompare(b, "fr"),
    );

    return themes.map((theme) => ({
      theme,
      colonnes: formations.map((f) => {
        const dedans = lignes
          .filter((l) => l.theme === theme && l.formation === f)
          .map((l) => ({
            id: l.id,
            formation: l.formation,
            candidat: l.candidat,
            theme: l.theme,
            sousTheme: l.sous_theme,
            extrait: l.extrait,
            resumeAffichage: l.resume_affichage,
            pageOuSection: l.page_ou_section,
            url: l.url_ancre,
            titreDocument: l.titre,
          }));
        return dedans.length > 0 ? dedans : null;
      }),
    }));
  });

/** Formations disposant d'au moins une position citée, donc comparables. */
export const listerFormationsComparables = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    if (!(await enrichissementDisponible())) return [];
    const lignes = await requete<{ formation: string }>(
      `SELECT DISTINCT p.formation
         FROM enrichissement.programme_position pp
         JOIN enrichissement.programme p ON p.id = pp.programme_id
        ORDER BY p.formation`,
    );
    return lignes.map((l) => l.formation);
  },
);

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
