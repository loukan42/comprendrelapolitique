/**
 * Bilan des engagements présidentiels.
 *
 * Répond à une seule question : la mesure annoncée a-t-elle été mise en
 * oeuvre ? Ni l'efficacité de la politique, ni l'opinion qu'on peut en avoir
 * ne sont évaluées. Une réforme peut être réalisée et ses résultats
 * contestés ; une politique peut produire des résultats sans avoir été
 * promise.
 *
 * Rien n'est propre à un président : la structure vaut pour n'importe quel
 * mandat.
 */

import { createServerFn } from "@tanstack/react-start";
import { tableDisponible, requete } from "./db";

export type StatutEngagement =
  "realise" | "partiellement" | "en_cours" | "non_realise" | "abandonne" | "inevaluable";

export type ConfianceEvaluation = "haute" | "moyenne" | "basse";

export interface SourceEngagement {
  titre: string;
  organisme: string;
  url: string;
  dateSource: string | null;
  institutionnelle: boolean;
}

export interface ActionEngagement {
  dateAction: string;
  description: string;
  url: string | null;
}

export interface Engagement {
  id: string;
  theme: string;
  titre: string;
  extraitProgramme: string;
  reformulation: string;
  pageProgramme: string | null;
  statut: StatutEngagement;
  confiance: ConfianceEvaluation;
  actionMenee: string | null;
  resultat: string | null;
  justification: string;
  interpretations: string | null;
  verifieLe: string;
  actions: ActionEngagement[];
  sources: SourceEngagement[];
}

export interface ActionHorsProgramme {
  id: string;
  theme: string;
  titre: string;
  dateMesure: string | null;
  contexte: string;
  decision: string;
  sources: SourceEngagement[];
}

export interface Mandat {
  id: string;
  libelle: string;
  dateDebut: string;
  dateFin: string | null;
  /** Vrai tant que le mandat court : un engagement non réalisé n'y est pas
   *  encore une promesse non tenue. */
  enCours: boolean;
  programmeTitre: string;
  programmeUrl: string;
  programmeDate: string | null;
  engagements: Engagement[];
  horsProgramme: ActionHorsProgramme[];
}

export interface BilanPresident {
  id: string;
  prenom: string;
  nom: string;
  mandats: Mandat[];
}

/**
 * Répartition des statuts, et taux calculé sur les seuls engagements
 * évaluables.
 *
 * Le taux exclut « en cours » et « impossible à évaluer ». Les inclure au
 * dénominateur ferait baisser mécaniquement le résultat d'un mandat qui
 * court, et les compter comme non tenus serait faux. Le nombre d'exclus est
 * donc rendu avec le taux, jamais caché.
 */
export interface RepartitionStatuts {
  total: number;
  parStatut: Record<StatutEngagement, number>;
  evaluables: number;
  realises: number;
  /** Null quand aucun engagement n'est évaluable : pas de taux sur rien. */
  tauxRealises: number | null;
}

export function repartir(engagements: Engagement[]): RepartitionStatuts {
  const parStatut: Record<StatutEngagement, number> = {
    realise: 0,
    partiellement: 0,
    en_cours: 0,
    non_realise: 0,
    abandonne: 0,
    inevaluable: 0,
  };
  for (const e of engagements) parStatut[e.statut] += 1;

  const evaluables =
    parStatut.realise + parStatut.partiellement + parStatut.non_realise + parStatut.abandonne;

  return {
    total: engagements.length,
    parStatut,
    evaluables,
    realises: parStatut.realise,
    tauxRealises: evaluables > 0 ? parStatut.realise / evaluables : null,
  };
}

export const chargerBilan = createServerFn({ method: "GET" })
  .validator((id: unknown): string => {
    if (typeof id !== "string" || id.length === 0) throw new Error("président requis");
    return id;
  })
  .handler(async ({ data: presidentId }): Promise<BilanPresident | null> => {
    if (!(await tableDisponible("enrichissement.engagement"))) return null;

    const [president] = await requete<{ id: string; prenom: string; nom: string }>(
      `SELECT id, prenom, nom FROM enrichissement.president WHERE id = $1`,
      [presidentId],
    );
    if (!president) return null;

    const mandats = await requete<{
      id: string;
      libelle: string;
      date_debut: string;
      date_fin: string | null;
      programme_titre: string;
      programme_url: string;
      programme_date: string | null;
    }>(
      `SELECT id, libelle, date_debut::text, date_fin::text,
              programme_titre, programme_url, programme_date::text
         FROM enrichissement.mandat_presidentiel
        WHERE president_id = $1
        ORDER BY date_debut`,
      [presidentId],
    );

    const engagements = await requete<{
      id: string;
      mandat_id: string;
      theme: string;
      titre: string;
      extrait_programme: string;
      reformulation: string;
      page_programme: string | null;
      statut: StatutEngagement;
      confiance: ConfianceEvaluation;
      action_menee: string | null;
      resultat: string | null;
      justification: string;
      interpretations: string | null;
      verifie_le: string;
    }>(
      `SELECT e.id, e.mandat_id, e.theme, e.titre, e.extrait_programme, e.reformulation,
              e.page_programme, e.statut, e.confiance, e.action_menee, e.resultat,
              e.justification, e.interpretations, e.verifie_le::text
         FROM enrichissement.engagement e
         JOIN enrichissement.mandat_presidentiel m ON m.id = e.mandat_id
        WHERE m.president_id = $1
        ORDER BY e.theme, e.titre`,
      [presidentId],
    );

    const actions = await requete<{
      engagement_id: string;
      date_action: string;
      description: string;
      url: string | null;
    }>(
      `SELECT a.engagement_id, a.date_action::text, a.description, a.url
         FROM enrichissement.engagement_action a
         JOIN enrichissement.engagement e ON e.id = a.engagement_id
         JOIN enrichissement.mandat_presidentiel m ON m.id = e.mandat_id
        WHERE m.president_id = $1
        ORDER BY a.date_action`,
      [presidentId],
    );

    const sources = await requete<{
      engagement_id: string;
      titre: string;
      organisme: string;
      url: string;
      date_source: string | null;
      institutionnelle: boolean;
    }>(
      `SELECT s.engagement_id, s.titre, s.organisme, s.url, s.date_source::text,
              s.institutionnelle
         FROM enrichissement.engagement_source s
         JOIN enrichissement.engagement e ON e.id = s.engagement_id
         JOIN enrichissement.mandat_presidentiel m ON m.id = e.mandat_id
        WHERE m.president_id = $1
        ORDER BY s.institutionnelle DESC, s.organisme`,
      [presidentId],
    );

    const hors = await requete<{
      id: string;
      mandat_id: string;
      theme: string;
      titre: string;
      date_mesure: string | null;
      contexte: string;
      decision: string;
    }>(
      `SELECT h.id, h.mandat_id, h.theme, h.titre, h.date_mesure::text, h.contexte, h.decision
         FROM enrichissement.action_hors_programme h
         JOIN enrichissement.mandat_presidentiel m ON m.id = h.mandat_id
        WHERE m.president_id = $1
        ORDER BY h.date_mesure NULLS LAST`,
      [presidentId],
    );

    const horsSources = await requete<{
      action_id: string;
      titre: string;
      organisme: string;
      url: string;
      date_source: string | null;
    }>(
      `SELECT s.action_id, s.titre, s.organisme, s.url, s.date_source::text
         FROM enrichissement.action_hors_programme_source s
         JOIN enrichissement.action_hors_programme h ON h.id = s.action_id
         JOIN enrichissement.mandat_presidentiel m ON m.id = h.mandat_id
        WHERE m.president_id = $1`,
      [presidentId],
    );

    return {
      id: president.id,
      prenom: president.prenom,
      nom: president.nom,
      mandats: mandats.map((m) => ({
        id: m.id,
        libelle: m.libelle,
        dateDebut: m.date_debut,
        dateFin: m.date_fin,
        enCours: m.date_fin === null,
        programmeTitre: m.programme_titre,
        programmeUrl: m.programme_url,
        programmeDate: m.programme_date,
        engagements: engagements
          .filter((e) => e.mandat_id === m.id)
          .map((e) => ({
            id: e.id,
            theme: e.theme,
            titre: e.titre,
            extraitProgramme: e.extrait_programme,
            reformulation: e.reformulation,
            pageProgramme: e.page_programme,
            statut: e.statut,
            confiance: e.confiance,
            actionMenee: e.action_menee,
            resultat: e.resultat,
            justification: e.justification,
            interpretations: e.interpretations,
            verifieLe: e.verifie_le,
            actions: actions
              .filter((a) => a.engagement_id === e.id)
              .map((a) => ({
                dateAction: a.date_action,
                description: a.description,
                url: a.url,
              })),
            sources: sources
              .filter((s) => s.engagement_id === e.id)
              .map((s) => ({
                titre: s.titre,
                organisme: s.organisme,
                url: s.url,
                dateSource: s.date_source,
                institutionnelle: s.institutionnelle,
              })),
          })),
        horsProgramme: hors
          .filter((h) => h.mandat_id === m.id)
          .map((h) => ({
            id: h.id,
            theme: h.theme,
            titre: h.titre,
            dateMesure: h.date_mesure,
            contexte: h.contexte,
            decision: h.decision,
            sources: horsSources
              .filter((s) => s.action_id === h.id)
              .map((s) => ({
                titre: s.titre,
                organisme: s.organisme,
                url: s.url,
                dateSource: s.date_source,
                institutionnelle: true,
              })),
          })),
      })),
    };
  });

export const listerPresidents = createServerFn({ method: "GET" }).handler(
  async (): Promise<
    { id: string; prenom: string; nom: string; mandats: number; engagements: number }[]
  > => {
    if (!(await tableDisponible("enrichissement.engagement"))) return [];
    return (
      await requete<{
        id: string;
        prenom: string;
        nom: string;
        mandats: string;
        engagements: string;
      }>(
        `SELECT p.id, p.prenom, p.nom, count(DISTINCT m.id)::text AS mandats,
                count(DISTINCT e.id)::text AS engagements
           FROM enrichissement.president p
           LEFT JOIN enrichissement.mandat_presidentiel m ON m.president_id = p.id
           LEFT JOIN enrichissement.engagement e ON e.mandat_id = m.id
          GROUP BY p.id, p.prenom, p.nom
          ORDER BY p.nom`,
      )
    ).map((p) => ({
      id: p.id,
      prenom: p.prenom,
      nom: p.nom,
      mandats: Number(p.mandats),
      engagements: Number(p.engagements),
    }));
  },
);
