/**
 * Fonctions serveur pour la page loi. S'appuient sur les vues de
 * `db/migrations/001_officiel.sql` qui portent déjà les règles non
 * négociables (AGENTS.md section 5) : `dossier_adopte_sans_vote` pour le
 * 49.3, jamais un vote individuel déduit de `position_majoritaire`.
 */

import { createServerFn } from "@tanstack/react-start";
import { baseDisponible, tableDisponible, requete, requeteUne } from "./db";

export interface ActeLoi {
  uid: string;
  codeActe: string | null;
  libelleCanonique: string | null;
  libelleCourt: string | null;
  dateActe: string | null;
  profondeur: number;
}

export interface RepartitionVote {
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT";
  effectif: number;
}

export interface SiegeVote {
  organeUid: string | null;
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT";
}

export interface VoteGroupeScrutin {
  organeUid: string | null;
  libelle: string | null;
  couleur: string | null;
  voixPour: number;
  voixContre: number;
  voixAbstention: number;
  voixNonVotant: number;
}

export interface ExplicationVote {
  acteurUid: string;
  civilite: string | null;
  prenom: string | null;
  nom: string;
  groupeUid: string | null;
  groupe: string | null;
  couleur: string | null;
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT" | null;
  texte: string;
}

export interface ScrutinLoi {
  uid: string;
  dateScrutin: string;
  titre: string;
  typeVoteCode: string;
  sortCode: string | null;
  sortLibelle: string | null;
  nombreVotants: number | null;
  suffragesRequis: number | null;
  repartition: RepartitionVote[];
  sieges: SiegeVote[];
  parGroupe: VoteGroupeScrutin[];
  explicationsVote: ExplicationVote[];
}

export interface DossierEngagement {
  uid: string;
  titre: string | null;
  scrutin: ScrutinLoi | null;
}

export interface DetailLoi {
  dossier: {
    uid: string;
    titre: string | null;
    legislature: number | null;
    procedureLibelle: string | null;
    /** Titre complet du texte déposé, souvent plus explicite que le titre court. */
    titreComplet: string | null;
    /** Auteur du dépôt, quand la source le renseigne. */
    initiateur: {
      uid: string;
      civilite: string | null;
      prenom: string | null;
      nom: string;
      groupe: string | null;
    } | null;
    /** Page officielle du dossier sur assemblee-nationale.fr. */
    urlAssemblee: string | null;
    /** Page du dossier sur senat.fr, quand le texte y est passé. */
    urlSenat: string | null;
  };
  actes: ActeLoi[];
  scrutinsEnsemble: ScrutinLoi[];
  adopteSansVote: boolean;
  dossiersEngagement: DossierEngagement[];
}

async function chargerRepartition(scrutinUid: string): Promise<RepartitionVote[]> {
  const lignes = await requete<{ position: RepartitionVote["position"]; effectif: string }>(
    `SELECT position, count(*) AS effectif
       FROM officiel.vote
      WHERE scrutin_uid = $1
      GROUP BY position
      ORDER BY position`,
    [scrutinUid],
  );
  return lignes.map((l) => ({ position: l.position, effectif: Number(l.effectif) }));
}

/**
 * Un point par vote individuel réellement enregistré, pour l'hémicycle.
 *
 * Les sièges sortent déjà rangés de la gauche vers la droite de l'hémicycle,
 * selon `enrichissement.groupe_ordre`. C'est ce qui donne son sens au dessin :
 * une version antérieure rangeait les groupes par effectif décroissant, et le
 * lecteur y voyait une géographie politique qui n'existait pas, du type « la
 * droite a voté contre » alors que la couleur ne dit que le sens du vote.
 *
 * Sans la table d'ordre (base chargée sans `data:ordre-groupes`), l'ordre
 * retombe sur celui des groupes, faute de mieux, et la page reste servie.
 */
async function chargerSieges(scrutinUid: string): Promise<SiegeVote[]> {
  const avecOrdre = await tableDisponible("enrichissement.groupe_ordre");
  const lignes = await requete<{ organe_uid: string | null; position: SiegeVote["position"] }>(
    avecOrdre
      ? `SELECT v.organe_uid, v.position
           FROM officiel.vote v
           LEFT JOIN enrichissement.groupe_ordre go ON go.organe_uid = v.organe_uid
          WHERE v.scrutin_uid = $1
          ORDER BY go.rang NULLS LAST, v.organe_uid`
      : `SELECT organe_uid, position FROM officiel.vote
          WHERE scrutin_uid = $1 ORDER BY organe_uid`,
    [scrutinUid],
  );
  return lignes.map((l) => ({ organeUid: l.organe_uid, position: l.position }));
}

/**
 * Décompte par groupe parlementaire, agrégé depuis les votes individuels et
 * non depuis `officiel.scrutin_groupe`. Les deux existent, et c'est celui-ci
 * qui est retenu pour une raison : le bloc de groupe de la source porte un
 * `organe_uid` parfois absent (14 scrutins de la XVIIe listent leurs douze
 * groupes sous un même identifiant factice, voir la migration), alors que le
 * vote individuel porte le groupe au moment du vote. Le total affiché ici
 * coïncide donc toujours avec l'hémicycle, qui lit la même table.
 *
 * Le groupe d'un vote n'est jamais recalculé par intervalle de dates : il est
 * lu tel que la source l'a posé (AGENTS.md section 5, règle 1).
 */
async function chargerVotesParGroupe(scrutinUid: string): Promise<VoteGroupeScrutin[]> {
  const avecOrdre = await tableDisponible("enrichissement.groupe_ordre");
  const lignes = await requete<{
    organe_uid: string | null;
    libelle: string | null;
    couleur: string | null;
    voix_pour: string;
    voix_contre: string;
    voix_abstention: string;
    voix_non_votant: string;
  }>(
    avecOrdre
      ? `SELECT v.organe_uid, o.libelle, o.couleur,
                count(*) FILTER (WHERE v.position = 'POUR')        AS voix_pour,
                count(*) FILTER (WHERE v.position = 'CONTRE')      AS voix_contre,
                count(*) FILTER (WHERE v.position = 'ABSTENTION')  AS voix_abstention,
                count(*) FILTER (WHERE v.position = 'NON_VOTANT')  AS voix_non_votant
           FROM officiel.vote v
           LEFT JOIN officiel.organe o ON o.uid = v.organe_uid
           LEFT JOIN enrichissement.groupe_ordre go ON go.organe_uid = v.organe_uid
          WHERE v.scrutin_uid = $1
          GROUP BY v.organe_uid, o.libelle, o.couleur, go.rang
          ORDER BY go.rang NULLS LAST, count(*) DESC`
      : `SELECT v.organe_uid, o.libelle, o.couleur,
                count(*) FILTER (WHERE v.position = 'POUR')        AS voix_pour,
                count(*) FILTER (WHERE v.position = 'CONTRE')      AS voix_contre,
                count(*) FILTER (WHERE v.position = 'ABSTENTION')  AS voix_abstention,
                count(*) FILTER (WHERE v.position = 'NON_VOTANT')  AS voix_non_votant
           FROM officiel.vote v
           LEFT JOIN officiel.organe o ON o.uid = v.organe_uid
          WHERE v.scrutin_uid = $1
          GROUP BY v.organe_uid, o.libelle, o.couleur
          ORDER BY count(*) DESC`,
    [scrutinUid],
  );
  return lignes.map((l) => ({
    organeUid: l.organe_uid,
    libelle: l.libelle,
    couleur: l.couleur,
    voixPour: Number(l.voix_pour),
    voixContre: Number(l.voix_contre),
    voixAbstention: Number(l.voix_abstention),
    voixNonVotant: Number(l.voix_non_votant),
  }));
}

/**
 * Explications de vote : ce que les orateurs ont dit avant le scrutin, cité
 * tel quel.
 *
 * Le lien passe par la séance (`scrutin.seance_ref` vers
 * `debat_seance.uid`), et **uniquement quand la séance ne contient qu'une
 * seule section « Explications de vote »**. Une séance qui en compte
 * plusieurs examine plusieurs textes : rien dans les données ne dit laquelle
 * porte sur ce scrutin, et en choisir une attribuerait à un texte les
 * arguments tenus sur un autre. Mesuré sur la XVIIe législature : 108 votes
 * sur l'ensemble sont dans le cas sans ambiguïté, 35 ne le sont pas, 71
 * n'ont pas de compte rendu rattaché.
 *
 * Le groupe de l'orateur est lu depuis son propre vote sur ce scrutin
 * (`officiel.vote.organe_uid`), donc le groupe qu'il avait à cet instant.
 *
 * Aucun résumé n'est produit ici : le texte est celui du compte rendu.
 */
async function chargerExplicationsVote(scrutinUid: string): Promise<ExplicationVote[]> {
  const lignes = await requete<{
    acteur_uid: string;
    civilite: string | null;
    prenom: string | null;
    nom: string;
    groupe_uid: string | null;
    groupe: string | null;
    couleur: string | null;
    position: ExplicationVote["position"];
    texte: string;
    ordre: number;
  }>(
    `WITH seance_unique AS (
        SELECT s.seance_ref, p.id_syceron
          FROM officiel.scrutin s
          JOIN officiel.debat_point p
            ON p.seance_uid = s.seance_ref AND p.intitule ILIKE 'Explications de vote%'
         WHERE s.uid = $1
           AND (SELECT count(*) FROM officiel.debat_point p2
                 WHERE p2.seance_uid = s.seance_ref
                   AND p2.intitule ILIKE 'Explications de vote%') = 1
     )
     SELECT i.acteur_uid, a.civilite, a.prenom, a.nom,
            v.organe_uid AS groupe_uid, o.libelle AS groupe, o.couleur,
            v.position, i.texte, i.ordre_absolu_seance AS ordre
       FROM seance_unique su
       JOIN officiel.intervention i
         ON i.seance_uid = su.seance_ref AND i.point_id_syceron = su.id_syceron
       JOIN officiel.acteur a ON a.uid = i.acteur_uid
       LEFT JOIN officiel.vote v ON v.scrutin_uid = $1 AND v.acteur_uid = i.acteur_uid
       LEFT JOIN officiel.organe o ON o.uid = v.organe_uid
      WHERE i.texte IS NOT NULL
        AND length(i.texte) > 120
        AND (i.role_debat IS NULL OR i.role_debat <> 'president')
      ORDER BY i.ordre_absolu_seance`,
    [scrutinUid],
  );

  // Le compte rendu coupe une même prise de parole en plusieurs paragraphes
  // dès qu'une interruption s'intercale. Les paragraphes successifs d'un
  // même orateur sont donc recollés, dans l'ordre de la séance.
  const parOrateur = new Map<string, ExplicationVote>();
  for (const l of lignes) {
    const courant = parOrateur.get(l.acteur_uid);
    if (courant) {
      courant.texte += `\n\n${l.texte}`;
      continue;
    }
    parOrateur.set(l.acteur_uid, {
      acteurUid: l.acteur_uid,
      civilite: l.civilite,
      prenom: l.prenom,
      nom: l.nom,
      groupeUid: l.groupe_uid,
      groupe: l.groupe,
      couleur: l.couleur,
      position: l.position,
      texte: l.texte,
    });
  }
  return Array.from(parOrateur.values());
}

async function chargerScrutin(row: {
  uid: string;
  date_scrutin: string;
  titre: string;
  type_vote_code: string;
  sort_code: string | null;
  sort_libelle: string | null;
  nombre_votants: number | null;
  suffrages_requis: number | null;
}): Promise<ScrutinLoi> {
  return {
    uid: row.uid,
    dateScrutin: row.date_scrutin,
    titre: row.titre,
    typeVoteCode: row.type_vote_code,
    sortCode: row.sort_code,
    sortLibelle: row.sort_libelle,
    nombreVotants: row.nombre_votants,
    suffragesRequis: row.suffrages_requis,
    repartition: await chargerRepartition(row.uid),
    sieges: await chargerSieges(row.uid),
    parGroupe: await chargerVotesParGroupe(row.uid),
    explicationsVote: await chargerExplicationsVote(row.uid),
  };
}

export const chargerDossier = createServerFn({ method: "GET" })
  .validator((uid: unknown): string => {
    if (typeof uid !== "string" || uid.length === 0) throw new Error("uid de dossier requis");
    return uid;
  })
  .handler(async ({ data: uid }): Promise<DetailLoi | null> => {
    if (!(await baseDisponible())) return null;
    const dossier = await requeteUne<{
      uid: string;
      titre: string | null;
      legislature: number | null;
      procedure_libelle: string | null;
      titre_chemin: string | null;
      senat_chemin: string | null;
      acteur_initiateur: string | null;
    }>(
      `SELECT uid, titre, legislature, procedure_libelle, titre_chemin, senat_chemin,
              acteur_initiateur
         FROM officiel.dossier WHERE uid = $1`,
      [uid],
    );
    if (!dossier) return null;

    // Intitulé complet du texte lui-même (« proposition de loi visant à… »),
    // là où le titre du dossier est raccourci pour l'affichage. Restreint aux
    // textes de loi : les rapports rattachés au même dossier portent un titre
    // de procédure (« rapport de la commission mixte paritaire chargée de… »)
    // qui décrit une étape, pas le contenu du texte. Le plus court des textes
    // est retenu, les versions successives ajoutant des mentions de lecture.
    const titreCompletRow = await requeteUne<{ titre_principal: string | null }>(
      `SELECT titre_principal
         FROM officiel.document
        WHERE dossier_uid = $1
          AND type_document = 'texteLoi_Type'
          AND titre_principal IS NOT NULL
          AND titre_principal NOT ILIKE 'rapport%'
        ORDER BY length(titre_principal)
        LIMIT 1`,
      [uid],
    );

    // Auteur du dépôt, avec le groupe auquel il appartenait à cette date.
    // Le groupe est lu depuis le mandat qui couvre la date, jamais supposé.
    const initiateurRow = dossier.acteur_initiateur
      ? await requeteUne<{
          uid: string;
          civilite: string | null;
          prenom: string | null;
          nom: string;
          groupe: string | null;
        }>(
          `SELECT a.uid, a.civilite, a.prenom, a.nom,
                  (SELECT o.libelle
                     FROM officiel.mandat m
                     JOIN officiel.organe o ON o.uid = m.organe_uid
                    WHERE m.acteur_uid = a.uid AND m.type_organe = 'GP'
                      AND o.legislature = $2
                    ORDER BY m.date_debut DESC
                    LIMIT 1) AS groupe
             FROM officiel.acteur a
            WHERE a.uid = $1`,
          [dossier.acteur_initiateur, dossier.legislature],
        )
      : null;

    const actesRows = await requete<{
      uid: string;
      code_acte: string | null;
      libelle_canonique: string | null;
      libelle_court: string | null;
      date_acte: string | null;
      profondeur: number;
    }>(
      `SELECT uid, code_acte, libelle_canonique, libelle_court, date_acte, profondeur
         FROM officiel.acte_legislatif
        WHERE dossier_uid = $1
        ORDER BY date_acte NULLS LAST, profondeur`,
      [uid],
    );

    const scrutinsRows = await requete<{
      uid: string;
      date_scrutin: string;
      titre: string;
      type_vote_code: string;
      sort_code: string | null;
      sort_libelle: string | null;
      nombre_votants: number | null;
      suffrages_requis: number | null;
    }>(
      `SELECT s.uid, s.date_scrutin, s.titre, s.type_vote_code, s.sort_code, s.sort_libelle,
              s.nombre_votants, s.suffrages_requis
         FROM officiel.scrutin_dossier sd
         JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
        WHERE sd.dossier_uid = $1 AND s.est_vote_sur_ensemble
        ORDER BY s.date_scrutin`,
      [uid],
    );

    const adopteSansVoteRow = await requeteUne(
      `SELECT 1 FROM officiel.dossier_adopte_sans_vote WHERE dossier_uid = $1`,
      [uid],
    );
    const adopteSansVote = adopteSansVoteRow !== null;

    let dossiersEngagement: DossierEngagement[] = [];
    if (adopteSansVote) {
      const engagementRows = await requete<{
        uid: string;
        titre: string | null;
      }>(
        `SELECT DISTINCT d.uid, d.titre
           FROM officiel.dossier_lie_par_acte l
           JOIN officiel.dossier d ON d.uid = l.dossier_lie_uid
          WHERE l.dossier_uid = $1`,
        [uid],
      );
      dossiersEngagement = await Promise.all(
        engagementRows.map(async (e) => {
          const motionRow = await requeteUne<{
            uid: string;
            date_scrutin: string;
            titre: string;
            type_vote_code: string;
            sort_code: string | null;
            sort_libelle: string | null;
            nombre_votants: number | null;
            suffrages_requis: number | null;
          }>(
            `SELECT s.uid, s.date_scrutin, s.titre, s.type_vote_code, s.sort_code, s.sort_libelle,
                    s.nombre_votants, s.suffrages_requis
               FROM officiel.scrutin_dossier sd
               JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
              WHERE sd.dossier_uid = $1 AND s.type_vote_code = 'MOC'
              ORDER BY s.date_scrutin
              LIMIT 1`,
            [e.uid],
          );
          return {
            uid: e.uid,
            titre: e.titre,
            scrutin: motionRow ? await chargerScrutin(motionRow) : null,
          };
        }),
      );
    }

    return {
      dossier: {
        uid: dossier.uid,
        titre: dossier.titre,
        legislature: dossier.legislature,
        procedureLibelle: dossier.procedure_libelle,
        titreComplet: titreCompletRow?.titre_principal ?? null,
        initiateur: initiateurRow
          ? {
              uid: initiateurRow.uid,
              civilite: initiateurRow.civilite,
              prenom: initiateurRow.prenom,
              nom: initiateurRow.nom,
              groupe: initiateurRow.groupe,
            }
          : null,
        // Construite depuis `titre_chemin`, le segment d'URL que la source
        // publie elle-même. Jamais devinée à partir du titre.
        urlAssemblee:
          dossier.titre_chemin && dossier.legislature
            ? `https://www.assemblee-nationale.fr/dyn/${dossier.legislature}/dossiers/${dossier.titre_chemin}`
            : null,
        urlSenat: dossier.senat_chemin,
      },
      actes: actesRows.map((a) => ({
        uid: a.uid,
        codeActe: a.code_acte,
        libelleCanonique: a.libelle_canonique,
        libelleCourt: a.libelle_court,
        dateActe: a.date_acte,
        profondeur: a.profondeur,
      })),
      scrutinsEnsemble: await Promise.all(scrutinsRows.map(chargerScrutin)),
      adopteSansVote,
      dossiersEngagement,
    };
  });

export interface DossierListe {
  uid: string;
  titre: string | null;
  procedureLibelle: string | null;
  legislature: number | null;
}

/**
 * Recherche par titre, sur les dossiers uniquement pour l'instant (section 7
 * de la spécification vise aussi les scrutins, députés, lois : hors de ce
 * premier lot). `ILIKE` plutôt qu'un index de recherche plein texte : le
 * corpus tient en 3 000 dossiers, la latence n'est pas un problème avant de
 * justifier l'infrastructure supplémentaire.
 */
export const chercherDossiers = createServerFn({ method: "GET" })
  .validator((q: unknown): string => (typeof q === "string" ? q : ""))
  .handler(async ({ data: q }): Promise<DossierListe[]> => {
    if (!(await baseDisponible())) return [];
    const terme = q.trim();
    if (terme.length < 2) return [];
    const rows = await requete<{
      uid: string;
      titre: string | null;
      procedure_libelle: string | null;
      legislature: number | null;
    }>(
      `SELECT uid, titre, procedure_libelle, legislature
         FROM officiel.dossier
        WHERE titre ILIKE $1
        ORDER BY legislature DESC NULLS LAST, titre
        LIMIT 25`,
      [`%${terme}%`],
    );
    return rows.map((r) => ({
      uid: r.uid,
      titre: r.titre,
      procedureLibelle: r.procedure_libelle,
      legislature: r.legislature,
    }));
  });

export interface DossierRecent {
  dossierUid: string;
  titre: string | null;
  dateScrutin: string;
  sortCode: string | null;
  sortLibelle: string | null;
}

/**
 * Les votes sur l'ensemble d'un texte les plus récents, toutes législatures
 * confondues, triés par date : la liste répond à « qu'est-ce qui vient de se
 * passer », pas à une sélection par affluence.
 */
export const chargerScrutinsRecents = createServerFn({ method: "GET" }).handler(
  async (): Promise<DossierRecent[]> => {
    if (!(await baseDisponible())) return [];
    const rows = await requete<{
      dossier_uid: string;
      titre: string | null;
      date_scrutin: string;
      sort_code: string | null;
      sort_libelle: string | null;
    }>(
      `SELECT DISTINCT ON (sd.dossier_uid)
              sd.dossier_uid, d.titre, s.date_scrutin, s.sort_code, s.sort_libelle
         FROM officiel.scrutin s
         JOIN officiel.scrutin_dossier sd ON sd.scrutin_uid = s.uid
         LEFT JOIN officiel.dossier d ON d.uid = sd.dossier_uid
        WHERE s.est_vote_sur_ensemble AND sd.dossier_uid IS NOT NULL
        ORDER BY sd.dossier_uid, s.date_scrutin DESC`,
    );
    return rows
      .map((r) => ({
        dossierUid: r.dossier_uid,
        titre: r.titre,
        dateScrutin: r.date_scrutin,
        sortCode: r.sort_code,
        sortLibelle: r.sort_libelle,
      }))
      .sort((a, b) => (a.dateScrutin < b.dateScrutin ? 1 : -1))
      .slice(0, 6);
  },
);
