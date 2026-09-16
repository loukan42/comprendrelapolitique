import { createServerFn } from "@tanstack/react-start";
import { baseDisponible, requete, tableDisponible } from "./db";

export interface LoiHistorique {
  uid: string;
  titre: string | null;
  dateDepot: string;
  legislature: number | null;
  procedure: string | null;
  formation: string;
  groupe: string | null;
  initiateur: string | null;
  adoptee: boolean;
  adopteePar493: boolean;
  conflit: boolean;
  url: string | null;
}

export interface FormationLois {
  formation: string;
  proposees: number;
  adoptees: number;
}

export interface AnneeLois {
  annee: number;
  proposees: number;
  adoptees: number;
}

export interface HistoriqueLois {
  debut: string;
  fin: string;
  couvertureDebut: string | null;
  couvertureComplete: boolean;
  lois: LoiHistorique[];
  formations: FormationLois[];
  annees: AnneeLois[];
}

export const chargerHistoriqueLois = createServerFn({ method: "GET" }).handler(
  async (): Promise<HistoriqueLois> => {
    const fin = new Date();
    const debut = new Date(fin);
    debut.setFullYear(fin.getFullYear() - 20);
    const debutTexte = debut.toISOString().slice(0, 10);
    const finTexte = fin.toISOString().slice(0, 10);
    if (!(await baseDisponible())) {
      return {
        debut: debutTexte,
        fin: finTexte,
        couvertureDebut: null,
        couvertureComplete: false,
        lois: [],
        formations: [],
        annees: [],
      };
    }

    const avecFormations =
      (await tableDisponible("enrichissement.formation_groupe")) &&
      (await tableDisponible("enrichissement.formation"));
    const jointureFormation = avecFormations
      ? `LEFT JOIN LATERAL (
           SELECT f.libelle
             FROM enrichissement.formation_groupe fg
             JOIN enrichissement.formation f ON f.id = fg.formation_id
            WHERE fg.organe_uid = groupe.uid
            ORDER BY fg.formation_id
            LIMIT 1
         ) formation ON true`
      : "";
    const selectFormation = avecFormations
      ? "formation.libelle AS formation"
      : "NULL::text AS formation";

    const rows = await requete<{
      uid: string;
      titre: string | null;
      titre_chemin: string | null;
      date_depot: string;
      legislature: number | null;
      procedure: string | null;
      formation: string | null;
      groupe: string | null;
      initiateur: string | null;
      acteur_initiateur: string | null;
      adoptee: boolean;
      adoptee_493: boolean;
      conflit: boolean;
    }>(
      `WITH dossiers AS (
         SELECT d.uid, d.titre, d.titre_chemin, d.legislature, d.procedure_libelle AS procedure,
                d.acteur_initiateur, MIN(a.date_acte)::date AS date_depot
           FROM officiel.dossier d
           JOIN officiel.acte_legislatif a ON a.dossier_uid = d.uid
          WHERE a.date_acte >= $1::date
            AND a.date_acte < ($2::date + interval '1 day')
            AND d.procedure_libelle ILIKE '%loi%'
         GROUP BY d.uid, d.titre, d.titre_chemin, d.legislature, d.procedure_libelle, d.acteur_initiateur
       )
       SELECT d.uid, d.titre, d.titre_chemin, d.date_depot::text, d.legislature, d.procedure,
              ${selectFormation}, groupe.libelle AS groupe,
              NULLIF(trim(concat_ws(' ', acteur.prenom, acteur.nom)), '') AS initiateur,
              d.acteur_initiateur,
              (
                NOT EXISTS (
                  SELECT 1 FROM officiel.scrutin_dossier c
                   WHERE c.methode = 'CONFLIT'
                     AND (c.dossier_uid = d.uid OR c.dossier_officiel_uid = d.uid OR c.dossier_reconstruit_uid = d.uid)
                )
                AND (
                  EXISTS (SELECT 1 FROM officiel.dossier_adopte_sans_vote sv WHERE sv.dossier_uid = d.uid)
                  OR EXISTS (
                    SELECT 1 FROM officiel.scrutin_dossier sd
                    JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
                    WHERE sd.dossier_uid = d.uid AND s.est_vote_sur_ensemble
                      AND s.type_vote_code <> 'MOC' AND s.sort_code = 'adopté'
                  )
                )
              ) AS adoptee,
              EXISTS (SELECT 1 FROM officiel.dossier_adopte_sans_vote sv WHERE sv.dossier_uid = d.uid) AS adoptee_493,
              EXISTS (
                SELECT 1 FROM officiel.scrutin_dossier c
                 WHERE c.methode = 'CONFLIT'
                   AND (c.dossier_uid = d.uid OR c.dossier_officiel_uid = d.uid OR c.dossier_reconstruit_uid = d.uid)
              ) AS conflit
         FROM dossiers d
         LEFT JOIN officiel.acteur acteur ON acteur.uid = d.acteur_initiateur
         LEFT JOIN LATERAL (
           SELECT m.organe_uid
             FROM officiel.mandat m
            WHERE m.acteur_uid = d.acteur_initiateur
              AND m.type_organe = 'GP'
              AND m.date_debut <= d.date_depot
              AND (m.date_fin IS NULL OR m.date_fin >= d.date_depot)
            ORDER BY m.date_debut DESC
            LIMIT 1
         ) mandat ON true
         LEFT JOIN officiel.organe groupe ON groupe.uid = mandat.organe_uid AND groupe.code_type = 'GP'
         ${jointureFormation}
        ORDER BY d.date_depot DESC, d.uid`,
      [debutTexte, finTexte],
    );

    const couvertureDebut =
      rows.length > 0 ? (rows.map((r) => r.date_depot).sort()[0] ?? null) : null;
    const lois = rows.map((r) => ({
      uid: r.uid,
      titre: r.titre,
      url:
        r.legislature && r.titre_chemin
          ? `https://www.assemblee-nationale.fr/dyn/${r.legislature}/dossiers/${r.titre_chemin}`
          : null,
      dateDepot: r.date_depot,
      legislature: r.legislature,
      procedure: r.procedure,
      formation: r.formation ?? r.groupe ?? "Déposant non rattaché",
      groupe: r.groupe,
      initiateur: r.initiateur,
      adoptee: r.adoptee,
      adopteePar493: r.adoptee_493,
      conflit: r.conflit,
    }));

    const formations = new Map<string, FormationLois>();
    const annees = new Map<number, AnneeLois>();
    for (const loi of lois) {
      const formation = formations.get(loi.formation) ?? {
        formation: loi.formation,
        proposees: 0,
        adoptees: 0,
      };
      formation.proposees += 1;
      if (loi.adoptee) formation.adoptees += 1;
      formations.set(loi.formation, formation);
      const annee = Number(loi.dateDepot.slice(0, 4));
      const ligne = annees.get(annee) ?? { annee, proposees: 0, adoptees: 0 };
      ligne.proposees += 1;
      if (loi.adoptee) ligne.adoptees += 1;
      annees.set(annee, ligne);
    }

    return {
      debut: debutTexte,
      fin: finTexte,
      couvertureDebut,
      couvertureComplete: couvertureDebut !== null && couvertureDebut <= debutTexte,
      lois,
      formations: [...formations.values()].sort(
        (a, b) => b.adoptees - a.adoptees || b.proposees - a.proposees,
      ),
      annees: [...annees.values()].sort((a, b) => a.annee - b.annee),
    };
  },
);
