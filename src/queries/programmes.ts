/**
 * Références vers les programmes politiques publiés.
 *
 * Le site renvoie vers les documents, il ne les héberge pas et n'en résume
 * pas le contenu : voir `scripts/import/programmes.ts` pour le détail de ce
 * choix. Les positions citées, quand elles existeront, viendront de
 * `enrichissement.programme_position`, chacune avec sa citation exacte.
 */

import { createServerFn } from "@tanstack/react-start";
import {
  MINIMUM_FORMATIONS_PAR_QUESTION,
  type OptionQcm,
  type QuestionQcm,
} from "../lib/qcmProgrammes";
import type { QuestionBenchmark } from "../lib/benchmarkProgrammes";
import { tableDisponible, requete } from "./db";

export type NatureProgramme =
  | "presidentiel_2017"
  | "presidentiel_2027"
  | "presidentiel_2022"
  | "legislatif_2024"
  | "europeen_2024"
  | "programme_parti"
  | "prise_de_position"
  | "projet_en_cours"
  | "aucun";

/**
 * Le libellé de nature est la principale information sur un document après
 * son lien. Tous les candidats n'ont pas publié leur programme de campagne :
 * pour certains, le document cité est un programme de 2022 ou de 2024, des
 * propositions du parti ou une tribune. Présenter ces documents comme des
 * programmes 2027 tromperait le lecteur sur ce qu'il va lire.
 */
export const LIBELLE_NATURE: Record<NatureProgramme, string> = {
  presidentiel_2017: "programme de campagne 2017",
  presidentiel_2027: "programme de campagne 2027",
  presidentiel_2022: "programme présidentiel 2022",
  legislatif_2024: "programme des législatives 2024",
  europeen_2024: "programme des européennes 2024",
  programme_parti: "propositions du parti",
  prise_de_position: "tribune ou déclaration",
  projet_en_cours: "projet du parti, en cours",
  aucun: "aucun document publié",
};

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
    if (!(await tableDisponible("enrichissement.programme_position"))) return [];

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

/**
 * Questions du QCM des programmes, chacune avec ses citations.
 *
 * La fonction ne reçoit rien : les choix de l'utilisateur restent dans le
 * navigateur (docs/QUIZ_METHODOLOGY.md section 1), où `qcmProgrammes.ts` fait
 * le décompte. Seules les questions réunissant au moins trois formations sont
 * servies : entre deux propositions, le choix ne compare presque rien.
 *
 * Une base chargée avant la migration 008 n'a pas la table des questions : le
 * QCM y est vide plutôt qu'en erreur.
 */
export const chargerQcmProgrammes = createServerFn({ method: "GET" }).handler(
  async (): Promise<QuestionQcm[]> => {
    if (!(await tableDisponible("enrichissement.programme_position"))) return [];
    if (!(await tableDisponible("enrichissement.programme_question"))) return [];

    const lignes = await requete<{
      question_id: string;
      theme: string;
      intitule: string;
      contexte: string | null;
      source_contexte: string | null;
      position_id: string;
      formation: string;
      candidat: string | null;
      extrait: string;
      resume_affichage: string | null;
      titre: string | null;
      nature: string;
      url_ancre: string | null;
    }>(
      `SELECT q.id AS question_id, q.theme, q.intitule, q.contexte, q.source_contexte,
              pp.id AS position_id, p.formation, p.candidat, pp.extrait, pp.resume_affichage, p.titre, p.nature::text AS nature, pp.url_ancre
         FROM enrichissement.programme_question q
         JOIN enrichissement.programme_position pp ON pp.question_id = q.id
         JOIN enrichissement.programme p ON p.id = pp.programme_id
        ORDER BY q.ordre, p.formation`,
    );

    const questions = new Map<string, QuestionQcm>();
    for (const l of lignes) {
      const question = questions.get(l.question_id) ?? {
        id: l.question_id,
        theme: l.theme,
        intitule: l.intitule,
        contexte: l.contexte,
        sourceContexte: l.source_contexte,
        options: [] as OptionQcm[],
      };
      question.options.push({
        positionId: l.position_id,
        formation: l.formation,
        candidat: l.candidat,
        extrait: l.extrait,
        resumeAffichage: l.resume_affichage,
        titreDocument: l.titre,
        natureDocument: l.nature,
        url: l.url_ancre,
      });
      questions.set(l.question_id, question);
    }

    return [...questions.values()].filter(
      (q) => new Set(q.options.map((o) => o.formation)).size >= MINIMUM_FORMATIONS_PAR_QUESTION,
    );
  },
);

/** Formations disposant d'au moins une position citée, donc comparables. */
export const listerFormationsComparables = createServerFn({ method: "GET" }).handler(
  async (): Promise<string[]> => {
    if (!(await tableDisponible("enrichissement.programme_position"))) return [];
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
    if (!(await tableDisponible("enrichissement.programme"))) return [];

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

/**
 * Corpus du comparateur : chaque question avec ses citations et, quand la
 * question a un axe, la place de chaque citation sur cet axe. Le calcul de
 * proximité se fait dans le navigateur (`src/lib/benchmarkProgrammes.ts`),
 * sur ces seules données publiques.
 *
 * Une base chargée avant l'ajout des axes n'a pas leurs colonnes : le
 * comparateur y est vide plutôt qu'en erreur.
 */
export const chargerBenchmark = createServerFn({ method: "GET" }).handler(
  async (): Promise<QuestionBenchmark[]> => {
    if (!(await tableDisponible("enrichissement.programme_question"))) return [];
    const lignes = await requete<{
      id: string;
      theme: string;
      intitule: string;
      axe_moins: string | null;
      axe_plus: string | null;
      echelle: number | null;
      formation: string;
      candidat: string | null;
      extrait: string;
      url_ancre: string | null;
      titre: string | null;
      nature: string;
    }>(
      `SELECT q.id, q.theme, q.intitule, q.axe_moins, q.axe_plus, pp.echelle, p.formation,
              p.candidat, pp.extrait, pp.url_ancre, p.titre, p.nature::text AS nature
         FROM enrichissement.programme_question q
         JOIN enrichissement.programme_position pp ON pp.question_id = q.id
         JOIN enrichissement.programme p ON p.id = pp.programme_id
        ORDER BY q.ordre, p.formation`,
    ).catch(() => []);

    const questions = new Map<string, QuestionBenchmark>();
    for (const l of lignes) {
      const q = questions.get(l.id) ?? {
        id: l.id,
        theme: l.theme,
        intitule: l.intitule,
        axeMoins: l.axe_moins,
        axePlus: l.axe_plus,
        positions: [],
      };
      q.positions.push({
        formation: l.formation,
        candidat: l.candidat,
        echelle: l.echelle,
        extrait: l.extrait,
        url: l.url_ancre,
        titreDocument: l.titre,
        natureDocument: l.nature,
      });
      questions.set(l.id, q);
    }
    return [...questions.values()];
  },
);
