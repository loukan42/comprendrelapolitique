/**
 * Hub thématique (spécification section 9). Contrairement au wiki décrit
 * dans la spécification (fiches pédagogiques, chronologies, chiffres clés
 * rédigés), ces pages n'affichent que des faits directement dérivés des
 * données importées : aucune prose éditoriale n'est générée ici. Rédiger une
 * fiche par thème demande une vérification humaine (agent `vulgarisation`
 * du projet) qu'une génération automatique ne peut pas remplacer sans
 * risquer d'attribuer une position ou un enjeu qui ne soit pas dans les
 * données. L'attribution thématique elle-même reste le classement par
 * mots-clés provisoire de `themes.ts` (voir /methodologie).
 */

import { createServerFn } from "@tanstack/react-start";
import { requete } from "./db";
import { THEMES, themeDepuisTitre, themeParSlug } from "./themes";

export interface ThemeHub {
  slug: string;
  libelle: string;
  nombreTextes: number;
}

async function chargerTousDossiersFinaux(): Promise<
  {
    dossierUid: string;
    titre: string | null;
    scrutinUid: string;
    dateScrutin: string;
    sortCode: string | null;
    sortLibelle: string | null;
  }[]
> {
  const rows = await requete<{
    dossier_uid: string;
    titre: string | null;
    scrutin_uid: string;
    date_scrutin: string;
    sort_code: string | null;
    sort_libelle: string | null;
  }>(
    `SELECT DISTINCT ON (sd.dossier_uid)
            sd.dossier_uid, d.titre, s.uid AS scrutin_uid, s.date_scrutin, s.sort_code, s.sort_libelle
       FROM officiel.scrutin s
       JOIN officiel.scrutin_dossier sd ON sd.scrutin_uid = s.uid
       LEFT JOIN officiel.dossier d ON d.uid = sd.dossier_uid
      WHERE s.est_vote_sur_ensemble AND sd.dossier_uid IS NOT NULL
      ORDER BY sd.dossier_uid, s.suffrages_exprimes DESC`,
  );
  return rows.map((r) => ({
    dossierUid: r.dossier_uid,
    titre: r.titre,
    scrutinUid: r.scrutin_uid,
    dateScrutin: r.date_scrutin,
    sortCode: r.sort_code,
    sortLibelle: r.sort_libelle,
  }));
}

export const listerHubThemes = createServerFn({ method: "GET" }).handler(
  async (): Promise<ThemeHub[]> => {
    const dossiers = await chargerTousDossiersFinaux();
    const comptes = new Map<string, number>();
    for (const d of dossiers) {
      const theme = themeDepuisTitre(d.titre);
      if (!theme) continue;
      comptes.set(theme, (comptes.get(theme) ?? 0) + 1);
    }
    return THEMES.map((t) => ({
      slug: t.slug,
      libelle: t.libelle,
      nombreTextes: comptes.get(t.slug) ?? 0,
    })).sort((a, b) => b.nombreTextes - a.nombreTextes);
  },
);

export interface TexteTheme {
  dossierUid: string;
  titre: string | null;
  dateScrutin: string;
  sortCode: string | null;
  sortLibelle: string | null;
  voixPour: number;
  voixContre: number;
  voixAbstention: number;
}

export interface PageTheme {
  slug: string;
  libelle: string;
  textes: TexteTheme[];
}

export const chargerPageTheme = createServerFn({ method: "GET" })
  .validator((slug: unknown): string => {
    if (typeof slug !== "string" || slug.length === 0) throw new Error("thème requis");
    return slug;
  })
  .handler(async ({ data: slug }): Promise<PageTheme | null> => {
    const theme = themeParSlug(slug);
    if (!theme) return null;

    const dossiers = await chargerTousDossiersFinaux();
    const retenus = dossiers.filter((d) => themeDepuisTitre(d.titre) === slug);

    // Le décompte est attaché à chaque texte, jamais sommé sur l'ensemble du
    // thème : additionner les voix de treize lois différentes produirait un
    // « 100 % pour sur la justice » qui masque les textes sur lesquels un
    // groupe s'est divisé ou opposé. Un scrutin, un texte, un résultat.
    const voixParScrutin = new Map<
      string,
      { voixPour: number; voixContre: number; voixAbstention: number }
    >();
    if (retenus.length > 0) {
      const rows = await requete<{
        scrutin_uid: string;
        voix_pour: number;
        voix_contre: number;
        voix_abstention: number;
      }>(
        `SELECT sg.scrutin_uid,
                sum(sg.voix_pour) AS voix_pour, sum(sg.voix_contre) AS voix_contre,
                sum(sg.voix_abstention) AS voix_abstention
           FROM officiel.scrutin_groupe sg
          WHERE sg.scrutin_uid = ANY($1)
          GROUP BY sg.scrutin_uid`,
        [retenus.map((d) => d.scrutinUid)],
      );
      for (const r of rows) {
        voixParScrutin.set(r.scrutin_uid, {
          voixPour: Number(r.voix_pour),
          voixContre: Number(r.voix_contre),
          voixAbstention: Number(r.voix_abstention),
        });
      }
    }

    return {
      slug: theme.slug,
      libelle: theme.libelle,
      textes: retenus
        .map((d) => {
          const voix = voixParScrutin.get(d.scrutinUid);
          return {
            dossierUid: d.dossierUid,
            titre: d.titre,
            dateScrutin: d.dateScrutin,
            sortCode: d.sortCode,
            sortLibelle: d.sortLibelle,
            voixPour: voix?.voixPour ?? 0,
            voixContre: voix?.voixContre ?? 0,
            voixAbstention: voix?.voixAbstention ?? 0,
          };
        })
        .sort((a, b) => (a.dateScrutin < b.dateScrutin ? 1 : -1)),
    };
  });
