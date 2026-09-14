/**
 * Requêtes de la page loi (`/lois/$id`). Code serveur uniquement : voir
 * src/lib/db.server.ts.
 *
 * La forme du résultat suit strictement les quatre gabarits de vote et le
 * gabarit de parcours décrits dans docs/SPECIFICATION.md section 6 et
 * vérifiés contre docs/DATA_MODEL.md :
 *
 *   1. scrutin sur l'ensemble du texte (`vote_ensemble`)
 *   2. adopté sans vote par engagement de responsabilité, article 49.3
 *      (`quarante_neuf_trois`)
 *   3. rattachement scrutin/dossier en conflit (`conflit`)
 *   4. aucun scrutin rattaché (`aucun_scrutin`)
 *
 * Une motion de censure (gabarit 2 du cahier des charges) n'est jamais un
 * bloc de vote de premier niveau : elle apparaît soit à l'intérieur du
 * gabarit `quarante_neuf_trois` (les motions qui ont suivi l'engagement),
 * soit potentiellement ailleurs plus tard. Elle ne réutilise jamais le
 * gabarit POUR/CONTRE/ABSTENTION/NON-VOTANT : `officiel.vote` n'enregistre
 * que les positions POUR pour ce type de scrutin (`type_vote_code = 'MOC'`),
 * et les champs CONTRE/ABSTENTION du scrutin sont structurellement à zéro.
 */

import { baseDisponible, query } from "./db.server";
import { decoderEntitesHtml } from "./entites-html";

export interface VoteIndividuel {
  acteurUid: string;
  nom: string;
  prenom: string | null;
  groupeLibelle: string;
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT";
  parDelegation: boolean;
}

export interface GroupeVote {
  organeUid: string | null;
  libelle: string;
  nombreMembres: number | null;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  nominatifComplet: boolean;
}

export interface ScrutinDetail {
  uid: string;
  titre: string;
  objetLibelle: string;
  dateScrutin: string;
  sortCode: string | null;
  sortLibelle: string | null;
  nombreVotants: number | null;
  suffragesExprimes: number | null;
  suffragesRequis: number | null;
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
  groupes: GroupeVote[];
  votes: VoteIndividuel[];
}

export interface ScrutinResume {
  uid: string;
  objetLibelle: string;
  dateScrutin: string;
  sortLibelle: string | null;
}

export interface MotionCensure {
  uid: string;
  titre: string;
  dateScrutin: string;
  nombreVotants: number;
  suffragesRequis: number | null;
  sortCode: string | null;
  votesPour: VoteIndividuel[];
}

export type BlocVote =
  | { type: "vote_ensemble"; scrutinPrincipal: ScrutinDetail; autresLectures: ScrutinResume[] }
  | {
      type: "quarante_neuf_trois";
      // Un texte de finances publiques peut être engagé par plusieurs 49.3
      // distincts (une partie, puis l'autre, une nouvelle lecture...) : un
      // seul dossier d'engagement serait un choix arbitraire parmi plusieurs
      // candidats légitimes. On les affiche tous plutôt que d'en écarter un
      // en silence (docs/DATA_MODEL.md section 6, règle générale).
      engagements: Array<{
        dossierEngagement: { uid: string; titre: string | null };
        motions: MotionCensure[];
      }>;
    }
  | {
      type: "conflit";
      dossierOfficiel: string | null;
      dossierReconstruit: string | null;
      note: string | null;
    }
  | { type: "aucun_scrutin" };

export interface ActeParcours {
  uid: string;
  codeActe: string | null;
  libelleCourt: string | null;
  libelleCanonique: string | null;
  dateActe: string | null;
  profondeur: number;
}

export interface AmendementImportant {
  uid: string;
  numeroLong: string | null;
  auteurLibelle: string | null;
  typeAuteur: string;
  sortLibelle: string | null;
  nombreCosignataires: number;
}

export interface DossierLoi {
  uid: string;
  titre: string | null;
  legislature: number | null;
  procedureLibelle: string | null;
  votes: BlocVote;
  parcours: ActeParcours[];
  amendements: AmendementImportant[];
}

function versVoteIndividuel(r: {
  acteur_uid: string;
  nom: string;
  prenom: string | null;
  groupe_libelle: string | null;
  position: string;
  par_delegation: boolean | null;
}): VoteIndividuel {
  return {
    acteurUid: r.acteur_uid,
    nom: r.nom,
    prenom: r.prenom,
    groupeLibelle: r.groupe_libelle ?? "Groupe non identifié",
    position: r.position as VoteIndividuel["position"],
    parDelegation: r.par_delegation ?? false,
  };
}

async function chargerVotes(scrutinUid: string, position?: VoteIndividuel["position"]) {
  const rows = await query<{
    acteur_uid: string;
    nom: string;
    prenom: string | null;
    groupe_libelle: string | null;
    position: string;
    par_delegation: boolean | null;
  }>(
    `SELECT v.acteur_uid, a.nom, a.prenom, o.libelle AS groupe_libelle, v.position::text AS position,
            v.par_delegation
       FROM officiel.vote v
       JOIN officiel.acteur a ON a.uid = v.acteur_uid
       LEFT JOIN officiel.organe o ON o.uid = v.organe_uid
      WHERE v.scrutin_uid = $1 ${position ? "AND v.position = $2" : ""}
      ORDER BY a.nom, a.prenom`,
    position ? [scrutinUid, position] : [scrutinUid],
  );
  return rows.map(versVoteIndividuel);
}

async function chargerGroupes(scrutinUid: string): Promise<GroupeVote[]> {
  const rows = await query<{
    organe_uid: string | null;
    libelle: string | null;
    nombre_membres: number | null;
    voix_pour: number;
    voix_contre: number;
    voix_abstention: number;
    voix_non_votant: number;
    nominatif_complet: boolean;
  }>(
    `SELECT sg.organe_uid, o.libelle, sg.nombre_membres,
            sg.voix_pour, sg.voix_contre, sg.voix_abstention, sg.voix_non_votant,
            sg.nominatif_complet
       FROM officiel.scrutin_groupe sg
       LEFT JOIN officiel.organe o ON o.uid = sg.organe_uid
      WHERE sg.scrutin_uid = $1
      ORDER BY sg.ordre`,
    [scrutinUid],
  );
  return rows.map((r) => ({
    organeUid: r.organe_uid,
    libelle: r.libelle ?? "Groupe non identifié",
    nombreMembres: r.nombre_membres,
    pour: r.voix_pour,
    contre: r.voix_contre,
    abstention: r.voix_abstention,
    nonVotant: r.voix_non_votant,
    nominatifComplet: r.nominatif_complet,
  }));
}

async function chargerScrutinDetail(scrutinUid: string): Promise<ScrutinDetail> {
  const scrutin = await query<{
    uid: string;
    titre: string;
    objet_libelle: string;
    date_scrutin: string;
    sort_code: string | null;
    sort_libelle: string | null;
    nombre_votants: number | null;
    suffrages_exprimes: number | null;
    suffrages_requis: number | null;
  }>(
    `SELECT uid, titre, objet_libelle, date_scrutin::text, sort_code, sort_libelle,
            nombre_votants, suffrages_exprimes, suffrages_requis
       FROM officiel.scrutin WHERE uid = $1`,
    [scrutinUid],
  );
  const s = scrutin[0];
  if (!s) throw new Error(`Scrutin introuvable : ${scrutinUid}`);

  const [groupes, votes] = await Promise.all([
    chargerGroupes(scrutinUid),
    chargerVotes(scrutinUid),
  ]);

  // La ventilation POUR/CONTRE/ABSTENTION/NON-VOTANT vient des décomptes par
  // groupe (`scrutin_groupe.voix_*`), déclarés comme LA vérité du décompte
  // dans docs/DATA_MODEL.md section 5, pas d'un recomptage sur `vote`, dont
  // les listes nominatives divergent parfois de ces totaux
  // (`nominatif_complet = false`).
  const totaux = groupes.reduce(
    (acc, g) => ({
      pour: acc.pour + g.pour,
      contre: acc.contre + g.contre,
      abstention: acc.abstention + g.abstention,
      nonVotant: acc.nonVotant + g.nonVotant,
    }),
    { pour: 0, contre: 0, abstention: 0, nonVotant: 0 },
  );

  return {
    uid: s.uid,
    titre: s.titre,
    objetLibelle: s.objet_libelle,
    dateScrutin: s.date_scrutin,
    sortCode: s.sort_code,
    sortLibelle: s.sort_libelle,
    nombreVotants: s.nombre_votants,
    suffragesExprimes: s.suffrages_exprimes,
    suffragesRequis: s.suffrages_requis,
    ...totaux,
    groupes,
    votes,
  };
}

/**
 * Motions de censure qui ont suivi un engagement de responsabilité.
 *
 * La source ne relie **structurellement** aucune motion à l'engagement
 * qu'elle vise : ni `officiel.acte_vote_ref`, ni `officiel.scrutin_dossier`
 * ne portent ce lien (vérifié sur l'engagement de responsabilité du
 * PLFRSS 2023, docs/DATA_SOURCES.md). Le rapprochement retenu ici est donc
 * une inférence par proximité de date et de législature, pas une donnée
 * officielle : on prend, après la dernière étape connue de l'engagement, les
 * N scrutins de motion de censure les plus proches dans le temps, où N est le
 * nombre d'actes `AN21-MOTION` déposés dans le dossier d'engagement. Vérifié
 * sur le cas connu (deux motions déposées le 16 mars 2023, votées le 20) :
 * le rapprochement retrouve exactement les deux scrutins attendus.
 */
async function chargerMotionsLieesAEngagement(
  dossierEngagementUid: string,
): Promise<MotionCensure[]> {
  const actesMotion = await query<{ date_acte: string | null }>(
    `SELECT date_acte::text FROM officiel.acte_legislatif
      WHERE dossier_uid = $1 AND code_acte LIKE 'AN21-MOTION%'`,
    [dossierEngagementUid],
  );
  if (actesMotion.length === 0) return [];

  const dossier = await query<{ legislature: number | null }>(
    `SELECT legislature FROM officiel.dossier WHERE uid = $1`,
    [dossierEngagementUid],
  );
  const legislature = dossier[0]?.legislature;
  if (legislature == null) return [];

  const dateMin = actesMotion
    .map((a) => a.date_acte)
    .filter((d): d is string => d != null)
    .sort()[0];
  if (!dateMin) return [];

  const scrutins = await query<{
    uid: string;
    titre: string;
    date_scrutin: string;
    nombre_votants: number;
    suffrages_requis: number | null;
    sort_code: string | null;
  }>(
    `SELECT uid, titre, date_scrutin::text, nombre_votants, suffrages_requis, sort_code
       FROM officiel.scrutin
      WHERE type_vote_code = 'MOC' AND legislature = $1
        AND date_scrutin >= $2::date AND date_scrutin <= $2::date + interval '30 days'
      ORDER BY date_scrutin
      LIMIT $3`,
    [legislature, dateMin, actesMotion.length],
  );

  return Promise.all(
    scrutins.map(async (s) => ({
      uid: s.uid,
      titre: s.titre,
      dateScrutin: s.date_scrutin,
      nombreVotants: s.nombre_votants,
      suffragesRequis: s.suffrages_requis,
      sortCode: s.sort_code,
      votesPour: await chargerVotes(s.uid, "POUR"),
    })),
  );
}

async function chargerBlocVote(dossierUid: string): Promise<BlocVote> {
  // Gabarit 3 en premier : un texte adopté par 49.3 n'a pas de vote sur son
  // ensemble, et chercher un scrutin avant de vérifier ce cas produirait un
  // gabarit 4 trompeur (docs/DATA_MODEL.md section 4, « Le 49.3 est un
  // concept de premier rang »).
  const sansVote = await query<{ dossier_uid: string }>(
    `SELECT dossier_uid FROM officiel.dossier_adopte_sans_vote WHERE dossier_uid = $1`,
    [dossierUid],
  );
  if (sansVote.length > 0) {
    const candidats = await query<{ uid: string; titre: string | null }>(
      `SELECT DISTINCT d.uid, d.titre
         FROM officiel.dossier_lie_par_acte l
         JOIN officiel.dossier_49_3 e ON e.dossier_uid = l.dossier_lie_uid
         JOIN officiel.dossier d ON d.uid = l.dossier_lie_uid
        WHERE l.dossier_uid = $1
        ORDER BY d.uid`,
      [dossierUid],
    );
    if (candidats.length > 0) {
      return {
        type: "quarante_neuf_trois",
        engagements: await Promise.all(
          candidats.map(async (dossierEngagement) => ({
            dossierEngagement,
            motions: await chargerMotionsLieesAEngagement(dossierEngagement.uid),
          })),
        ),
      };
    }
  }

  // Rattachement en conflit : la source officielle et le rattachement
  // reconstruit désignent deux dossiers différents pour un même scrutin. Ne
  // jamais choisir en silence (docs/DATA_MODEL.md section 6).
  const conflit = await query<{
    dossier_officiel_uid: string | null;
    dossier_reconstruit_uid: string | null;
    note: string | null;
  }>(
    `SELECT dossier_officiel_uid, dossier_reconstruit_uid, note
       FROM officiel.scrutin_dossier
      WHERE methode = 'CONFLIT' AND (dossier_officiel_uid = $1 OR dossier_reconstruit_uid = $1)
      LIMIT 1`,
    [dossierUid],
  );
  if (conflit[0]) {
    return {
      type: "conflit",
      dossierOfficiel: conflit[0].dossier_officiel_uid,
      dossierReconstruit: conflit[0].dossier_reconstruit_uid,
      note: conflit[0].note,
    };
  }

  // Gabarit 1 : un ou plusieurs scrutins sur l'ensemble du texte. Plusieurs
  // lectures peuvent chacune avoir voté l'ensemble (première lecture, texte
  // de la CMP...) : on retient la plus récente comme scrutin principal et on
  // liste les autres.
  const ensembles = await query<{
    scrutin_uid: string;
    objet_libelle: string;
    date_scrutin: string;
    sort_libelle: string | null;
  }>(
    `SELECT sd.scrutin_uid, s.objet_libelle, s.date_scrutin::text, s.sort_libelle
       FROM officiel.scrutin_dossier sd
       JOIN officiel.scrutin s ON s.uid = sd.scrutin_uid
      WHERE sd.dossier_uid = $1 AND s.est_vote_sur_ensemble AND s.type_vote_code <> 'MOC'
      ORDER BY s.date_scrutin DESC`,
    [dossierUid],
  );
  if (ensembles.length > 0) {
    const [principal, ...autres] = ensembles;
    return {
      type: "vote_ensemble",
      scrutinPrincipal: await chargerScrutinDetail(principal!.scrutin_uid),
      autresLectures: autres.map((a) => ({
        uid: a.scrutin_uid,
        objetLibelle: a.objet_libelle,
        dateScrutin: a.date_scrutin,
        sortLibelle: a.sort_libelle,
      })),
    };
  }

  // Gabarit 4 : ni scrutin sur l'ensemble, ni 49.3, ni conflit. Vote à main
  // levée ou accord tacite, non décompté nominativement dans la source.
  return { type: "aucun_scrutin" };
}

async function chargerParcours(dossierUid: string): Promise<ActeParcours[]> {
  const rows = await query<{
    uid: string;
    code_acte: string | null;
    libelle_court: string | null;
    libelle_canonique: string | null;
    date_acte: string | null;
    profondeur: number;
  }>(
    `SELECT uid, code_acte, libelle_court, libelle_canonique, date_acte::text, profondeur
       FROM officiel.acte_legislatif
      WHERE dossier_uid = $1
      ORDER BY date_acte NULLS LAST, profondeur`,
    [dossierUid],
  );
  return rows.map((r) => ({
    uid: r.uid,
    codeActe: r.code_acte,
    libelleCourt: r.libelle_court,
    libelleCanonique: r.libelle_canonique,
    dateActe: r.date_acte,
    profondeur: r.profondeur,
  }));
}

async function chargerAmendementsImportants(dossierUid: string): Promise<AmendementImportant[]> {
  const rows = await query<{
    uid: string;
    numero_long: string | null;
    auteur_libelle: string | null;
    type_auteur: string;
    sort_libelle: string | null;
    n_cosign: number;
  }>(
    `SELECT a.uid, a.numero_long, a.auteur_libelle, a.type_auteur, a.sort_libelle,
            (SELECT count(*)::int FROM officiel.amendement_cosignataire c
              WHERE c.amendement_uid = a.uid) AS n_cosign
       FROM officiel.amendement a
      WHERE a.dossier_uid = $1 AND a.sort_brut IS NOT NULL
      ORDER BY (a.sort_brut = 'Adopté') DESC, n_cosign DESC
      LIMIT 15`,
    [dossierUid],
  );
  return rows.map((r) => ({
    uid: r.uid,
    numeroLong: r.numero_long,
    auteurLibelle: decoderEntitesHtml(r.auteur_libelle),
    typeAuteur: r.type_auteur,
    sortLibelle: r.sort_libelle,
    nombreCosignataires: r.n_cosign,
  }));
}

export async function chargerDossierLoi(uid: string): Promise<DossierLoi | null> {
  if (!(await baseDisponible())) return null;
  const dossier = await query<{
    uid: string;
    titre: string | null;
    legislature: number | null;
    procedure_libelle: string | null;
  }>(`SELECT uid, titre, legislature, procedure_libelle FROM officiel.dossier WHERE uid = $1`, [
    uid,
  ]);
  const d = dossier[0];
  if (!d) return null;

  const [votes, parcours, amendements] = await Promise.all([
    chargerBlocVote(uid),
    chargerParcours(uid),
    chargerAmendementsImportants(uid),
  ]);

  return {
    uid: d.uid,
    titre: d.titre,
    legislature: d.legislature,
    procedureLibelle: d.procedure_libelle,
    votes,
    parcours,
    amendements,
  };
}
