/**
 * Import des jeux Open Data de l'Assemblée nationale vers le schéma `officiel`.
 *
 * Lit des archives déjà décompressées et charge acteurs, organes, mandats,
 * dossiers, documents, actes législatifs, scrutins et votes individuels.
 *
 * Idempotent : toutes les tables ont pour clé primaire l'identifiant de la
 * source, et l'import est un `INSERT … ON CONFLICT DO UPDATE`. Le rejouer ne
 * crée aucun doublon.
 *
 * Les pièges de format traités ici sont documentés dans docs/DATA_SOURCES.md :
 * `uid` tantôt objet tantôt chaîne, valeurs nulles encodées `{"@xsi:nil"}`,
 * collections qui ne sont pas des tableaux quand elles n'ont qu'un élément,
 * `libelleActe` qui est un objet, arbre d'actes récursif de profondeur
 * variable.
 */

import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

import type { Db } from "./db.ts";
import {
  booleen,
  cleTitreDocument,
  cleTitreScrutin,
  date,
  entier,
  estVoteSurEnsemble,
  horodatage,
  liste,
  nettoyerNil,
  texte,
} from "./normaliser.ts";

type Obj = Record<string, unknown>;

async function lireJson(chemin: string): Promise<Obj> {
  return nettoyerNil(JSON.parse(await readFile(chemin, "utf8")) as Obj);
}

async function fichiersJson(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  return (await readdir(dir)).filter((f) => f.endsWith(".json")).map((f) => join(dir, f));
}

/** Description d'une table cible pour l'insertion en masse. */
interface Cible {
  table: string;
  /** Colonnes, dans l'ordre des valeurs fournies. */
  colonnes: string[];
  /** Type SQL de chaque colonne. Nécessaire au transtypage des tableaux. */
  types: string[];
  /** Indices des colonnes formant la clé primaire, pour la déduplication. */
  cles: number[];
  /** Clause ON CONFLICT complète. */
  conflit: string;
}

/**
 * Insertion en masse par `unnest` de tableaux.
 *
 * Une insertion ligne par ligne sur 2,3 millions de votes est intenable, et
 * l'écriture naïve, un `VALUES ($1,$2),($3,$4)…` géant, se heurte à une
 * limite dure : le protocole PostgreSQL code le nombre de paramètres sur un
 * entier 16 bits signé, soit 32 767 au maximum. Mesuré sur PGlite, le
 * dépassement ne lève aucune erreur : la requête passe et toutes les suivantes
 * renvoient un résultat vide. Un échec silencieux, donc le pire des cas.
 *
 * `unnest` supprime le problème à la racine : un paramètre par colonne, quel
 * que soit le nombre de lignes. C'est aussi la forme la plus rapide, et elle se
 * comporte identiquement sur PGlite et sur un PostgreSQL de production.
 */
async function insererEnMasse(db: Db, cible: Cible, lignes: unknown[][]): Promise<number> {
  if (lignes.length === 0) return 0;

  // `ON CONFLICT DO UPDATE` refuse de toucher deux fois la même ligne dans un
  // seul ordre. La source peut répéter un identifiant d'un fichier à l'autre :
  // on garde la dernière occurrence.
  const parCle = new Map<string, unknown[]>();
  // La clé est sérialisée plutôt que concaténée : aucun séparateur ne peut
  // alors entrer en collision avec le contenu d'un identifiant.
  for (const l of lignes) parCle.set(JSON.stringify(cible.cles.map((i) => l[i])), l);
  const uniques = [...parCle.values()];

  const nbColonnes = cible.colonnes.length;

  // Tous les paramètres partent en `text[]`, et le transtypage se fait côté
  // SQL. PGlite ne sait pas sérialiser un tableau de type énuméré : il le
  // transmet en chaîne brute, et PostgreSQL répond « malformed array literal ».
  // Passer uniformément par du texte évite d'avoir à connaître quels types son
  // sérialiseur gère.
  const alias = cible.colonnes.map((_, i) => `c${i}`);
  const source = `unnest(${alias.map((_, i) => `$${i + 1}::text[]`).join(", ")}) AS u(${alias.join(", ")})`;
  const projection = alias.map((a, i) => `${a}::${cible.types[i]}`).join(", ");
  const sql =
    `INSERT INTO ${cible.table} (${cible.colonnes.join(", ")})\n` +
    `SELECT ${projection} FROM ${source}\n${cible.conflit}`;

  // Découpage pour la mémoire seulement : les tableaux sont sérialisés d'un
  // bloc et 2,3 millions de votes d'un coup chargeraient trop.
  const PAR_LOT = 20000;
  let total = 0;
  for (let i = 0; i < uniques.length; i += PAR_LOT) {
    const paquet = uniques.slice(i, i + PAR_LOT);
    const colonnes: (string | null)[][] = Array.from({ length: nbColonnes }, () => []);
    for (const l of paquet) {
      for (let c = 0; c < nbColonnes; c++) {
        const v = l[c];
        colonnes[c]!.push(v === null || v === undefined ? null : String(v));
      }
    }
    await db.query(sql, colonnes);
    total += paquet.length;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Acteurs, organes, mandats
// ---------------------------------------------------------------------------

export async function importerActeurs(
  db: Db,
  dirRacine: string,
  lotId: number,
  legislature: number,
): Promise<{ organes: number; acteurs: number; mandats: number }> {
  const organes: unknown[][] = [];
  for (const f of await fichiersJson(join(dirRacine, "organe"))) {
    const o = (await lireJson(f)).organe as Obj;
    const vie = (o.viMoDe ?? {}) as Obj;
    organes.push([
      texte(o.uid),
      texte(o.codeType) ?? "INCONNU",
      texte(o.libelle) ?? texte(o.libelleAbrege) ?? "(sans libellé)",
      texte(o.libelleAbrege),
      texte(o.libelleAbrev),
      texte(o.organeParent),
      entier(o.legislature),
      date(vie.dateDebut),
      date(vie.dateFin),
      lotId,
    ]);
  }

  const acteurs: unknown[][] = [];
  const mandats: unknown[][] = [];
  for (const f of await fichiersJson(join(dirRacine, "acteur"))) {
    const a = (await lireJson(f)).acteur as Obj;
    const uid = texte(a.uid); // objet {#text} dans ce jeu, chaîne ailleurs
    if (!uid) continue;
    const etat = (a.etatCivil ?? {}) as Obj;
    const ident = (etat.ident ?? {}) as Obj;
    const naiss = (etat.infoNaissance ?? {}) as Obj;
    const prof = (a.profession ?? {}) as Obj;

    acteurs.push([
      uid,
      texte(ident.civ),
      texte(ident.prenom),
      texte(ident.nom) ?? "(sans nom)",
      date(naiss.dateNais),
      texte(naiss.villeNais),
      texte(naiss.depNais),
      texte(naiss.paysNais),
      date(etat.dateDeces),
      texte(prof.libelleCourant),
      texte(a.uri_hatvp),
      lotId,
    ]);

    for (const m of liste<Obj>(((a.mandats ?? {}) as Obj).mandat as Obj | Obj[])) {
      const debut = date(m.dateDebut);
      const organeRef = liste<unknown>(((m.organes ?? {}) as Obj).organeRef as unknown)[0];
      const orgUid = texte(organeRef);
      if (!debut || !orgUid) continue; // un mandat sans date ni organe n'est pas exploitable
      const qualite = (m.infosQualite ?? {}) as Obj;
      mandats.push([
        texte(m.uid),
        uid,
        orgUid,
        texte(m.typeOrgane) ?? "INCONNU",
        debut,
        date(m.dateFin),
        texte(qualite.codeQualite),
        texte(qualite.libQualite),
        booleen(m.nominPrincipale),
        entier(m.legislature) ?? legislature,
        lotId,
      ]);
    }
  }

  const nOrganes = await insererEnMasse(
    db,
    {
      table: "officiel.organe",
      colonnes: [
        "uid",
        "code_type",
        "libelle",
        "libelle_abrege",
        "libelle_abrev",
        "organe_parent",
        "legislature",
        "date_debut",
        "date_fin",
        "lot_id",
      ],
      types: ["text", "text", "text", "text", "text", "text", "smallint", "date", "date", "bigint"],
      cles: [0],
      conflit: `ON CONFLICT (uid) DO UPDATE SET
        code_type = EXCLUDED.code_type, libelle = EXCLUDED.libelle,
        libelle_abrege = EXCLUDED.libelle_abrege, date_fin = EXCLUDED.date_fin,
        lot_maj_id = EXCLUDED.lot_id`,
    },
    organes,
  );

  const nActeurs = await insererEnMasse(
    db,
    {
      table: "officiel.acteur",
      colonnes: [
        "uid",
        "civilite",
        "prenom",
        "nom",
        "date_naissance",
        "ville_naissance",
        "departement_naissance",
        "pays_naissance",
        "date_deces",
        "profession",
        "uri_hatvp",
        "lot_id",
      ],
      types: [
        "text",
        "text",
        "text",
        "text",
        "date",
        "text",
        "text",
        "text",
        "date",
        "text",
        "text",
        "bigint",
      ],
      cles: [0],
      conflit: `ON CONFLICT (uid) DO UPDATE SET
        nom = EXCLUDED.nom, prenom = EXCLUDED.prenom,
        profession = EXCLUDED.profession, date_deces = EXCLUDED.date_deces,
        lot_maj_id = EXCLUDED.lot_id`,
    },
    acteurs,
  );

  const nMandats = await insererEnMasse(
    db,
    {
      table: "officiel.mandat",
      colonnes: [
        "uid",
        "acteur_uid",
        "organe_uid",
        "type_organe",
        "date_debut",
        "date_fin",
        "qualite_code",
        "qualite_libelle",
        "nomination_principale",
        "legislature",
        "lot_id",
      ],
      types: [
        "text",
        "text",
        "text",
        "text",
        "date",
        "date",
        "text",
        "text",
        "boolean",
        "smallint",
        "bigint",
      ],
      cles: [0],
      conflit: `ON CONFLICT (uid) DO UPDATE SET
        date_fin = EXCLUDED.date_fin, qualite_libelle = EXCLUDED.qualite_libelle,
        lot_maj_id = EXCLUDED.lot_id`,
    },
    mandats,
  );

  return { organes: nOrganes, acteurs: nActeurs, mandats: nMandats };
}

// ---------------------------------------------------------------------------
// Dossiers, documents, actes législatifs
// ---------------------------------------------------------------------------

interface ActeAplati {
  uid: string;
  parent: string | null;
  profondeur: number;
  codeActe: string | null;
  libelleCanonique: string | null;
  libelleCourt: string | null;
  organeUid: string | null;
  dateActe: string | null;
  voteRefs: string[];
}

/**
 * Aplatit l'arbre `actesLegislatifs`, qui est récursif et de profondeur
 * variable : les références de vote ont été constatées à trois et quatre
 * niveaux d'imbrication. Un parcours à profondeur fixe perd des données en
 * silence.
 */
export function aplatirActes(
  noeud: unknown,
  parent: string | null,
  profondeur: number,
): ActeAplati[] {
  const sortie: ActeAplati[] = [];
  if (Array.isArray(noeud)) {
    for (const n of noeud) sortie.push(...aplatirActes(n, parent, profondeur));
    return sortie;
  }
  if (typeof noeud !== "object" || noeud === null) return sortie;

  const o = noeud as Obj;
  const uid = texte(o.uid);
  if (uid && (o.codeActe !== undefined || o.dateActe !== undefined)) {
    const libelle = o.libelleActe;
    const votes = liste<unknown>(((o.voteRefs ?? {}) as Obj).voteRef as unknown)
      .map((v) => texte(v))
      .filter((v): v is string => !!v && v.startsWith("VTANR"));
    sortie.push({
      uid,
      parent,
      profondeur,
      codeActe: texte(o.codeActe),
      // libelleActe est un objet {nomCanonique, libelleCourt}, pas une chaîne.
      libelleCanonique:
        typeof libelle === "object" && libelle !== null
          ? texte((libelle as Obj).nomCanonique)
          : texte(libelle),
      libelleCourt:
        typeof libelle === "object" && libelle !== null
          ? texte((libelle as Obj).libelleCourt)
          : null,
      organeUid: texte(o.organeRef),
      dateActe: horodatage(o.dateActe),
      voteRefs: votes,
    });
    for (const [cle, v] of Object.entries(o)) {
      if (cle === "actesLegislatifs") sortie.push(...aplatirActes(v, uid, profondeur + 1));
    }
    return sortie;
  }

  for (const v of Object.values(o)) sortie.push(...aplatirActes(v, parent, profondeur));
  return sortie;
}

export async function importerDossiers(
  db: Db,
  dirRacine: string,
  lotId: number,
  legislature: number,
): Promise<{ dossiers: number; documents: number; actes: number; voteRefs: number }> {
  const dossiers: unknown[][] = [];
  const actes: unknown[][] = [];
  const voteRefs: unknown[][] = [];

  for (const f of await fichiersJson(join(dirRacine, "dossierParlementaire"))) {
    const d = (await lireJson(f)).dossierParlementaire as Obj;
    const uid = texte(d.uid);
    if (!uid) continue;
    const titre = (d.titreDossier ?? {}) as Obj;
    const proc = (d.procedureParlementaire ?? {}) as Obj;
    const init = (d.initiateur ?? {}) as Obj;
    const acteur = ((init.acteurs ?? {}) as Obj).acteur;
    const premier = liste<Obj>(acteur as Obj | Obj[])[0];

    dossiers.push([
      uid,
      entier(d.legislature) ?? legislature,
      texte(titre.titre),
      texte(titre.titreChemin),
      texte(titre.senatChemin),
      texte(proc.code),
      texte(proc.libelle),
      premier ? texte(premier.acteurRef) : null,
      lotId,
    ]);

    for (const a of aplatirActes(d.actesLegislatifs, null, 0)) {
      // Un acte est decrit par dossier : le meme uid peut porter un code
      // different ailleurs. La cle est donc (dossier, uid).
      actes.push([
        uid,
        a.uid,
        a.parent,
        a.profondeur,
        a.codeActe,
        a.libelleCanonique,
        a.libelleCourt,
        a.organeUid,
        a.dateActe,
        lotId,
      ]);
      for (const v of a.voteRefs) voteRefs.push([a.uid, v]);
    }
  }

  const documents: unknown[][] = [];
  for (const f of await fichiersJson(join(dirRacine, "document"))) {
    const doc = (await lireJson(f)).document as Obj;
    const uid = texte(doc.uid);
    const titres = (doc.titres ?? {}) as Obj;
    const titrePrincipal = texte(titres.titrePrincipal);
    if (!uid || !titrePrincipal) continue;
    const classif = (doc.classification ?? {}) as Obj;
    documents.push([
      uid,
      texte(doc.dossierRef),
      entier(doc.legislature),
      texte(doc["@xsi:type"]),
      texte(doc.denominationStructurelle),
      titrePrincipal,
      texte(titres.titrePrincipalCourt),
      texte(classif.statutAdoption),
      cleTitreDocument(titrePrincipal),
      lotId,
    ]);
  }

  const nDossiers = await insererEnMasse(
    db,
    {
      table: "officiel.dossier",
      colonnes: [
        "uid",
        "legislature",
        "titre",
        "titre_chemin",
        "senat_chemin",
        "procedure_code",
        "procedure_libelle",
        "acteur_initiateur",
        "lot_id",
      ],
      types: ["text", "smallint", "text", "text", "text", "text", "text", "text", "bigint"],
      cles: [0],
      conflit: `ON CONFLICT (uid) DO UPDATE SET
        titre = EXCLUDED.titre, procedure_libelle = EXCLUDED.procedure_libelle,
        lot_maj_id = EXCLUDED.lot_id`,
    },
    dossiers,
  );

  const nActes = await insererEnMasse(
    db,
    {
      table: "officiel.acte_legislatif",
      colonnes: [
        "dossier_uid",
        "uid",
        "acte_parent_uid",
        "profondeur",
        "code_acte",
        "libelle_canonique",
        "libelle_court",
        "organe_uid",
        "date_acte",
        "lot_id",
      ],
      types: [
        "text",
        "text",
        "text",
        "smallint",
        "text",
        "text",
        "text",
        "text",
        "timestamptz",
        "bigint",
      ],
      cles: [0, 1],
      conflit: `ON CONFLICT (dossier_uid, uid) DO UPDATE SET
        date_acte = EXCLUDED.date_acte, code_acte = EXCLUDED.code_acte`,
    },
    actes,
  );

  // Les documents référencent un dossier : ils viennent après.
  const nDocuments = await insererEnMasse(
    db,
    {
      table: "officiel.document",
      colonnes: [
        "uid",
        "dossier_uid",
        "legislature",
        "type_document",
        "denomination",
        "titre_principal",
        "titre_court",
        "statut_adoption",
        "cle_titre",
        "lot_id",
      ],
      types: ["text", "text", "smallint", "text", "text", "text", "text", "text", "text", "bigint"],
      cles: [0],
      conflit: `ON CONFLICT (uid) DO UPDATE SET
        dossier_uid = EXCLUDED.dossier_uid, titre_principal = EXCLUDED.titre_principal,
        cle_titre = EXCLUDED.cle_titre, lot_maj_id = EXCLUDED.lot_id`,
    },
    documents,
  );

  const nVoteRefs = await insererEnMasse(
    db,
    {
      table: "officiel.acte_vote_ref",
      colonnes: ["acte_uid", "scrutin_uid"],
      types: ["text", "text"],
      cles: [0, 1],
      conflit: "ON CONFLICT DO NOTHING",
    },
    voteRefs,
  );

  return { dossiers: nDossiers, documents: nDocuments, actes: nActes, voteRefs: nVoteRefs };
}

// ---------------------------------------------------------------------------
// Scrutins et votes
// ---------------------------------------------------------------------------

const CATEGORIES: Array<[string, "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT", string]> = [
  ["pours", "POUR", "pour"],
  ["contres", "CONTRE", "contre"],
  ["abstentions", "ABSTENTION", "abstentions"],
  ["nonVotants", "NON_VOTANT", "nonVotants"],
];

export async function importerScrutins(
  db: Db,
  dirScrutins: string,
  lotId: number,
): Promise<{ scrutins: number; groupes: number; votes: number; ecarts: number }> {
  const scrutins: unknown[][] = [];
  const groupes: unknown[][] = [];
  const votes: unknown[][] = [];
  let ecarts = 0;

  for (const f of await fichiersJson(dirScrutins)) {
    const s = (await lireJson(f)).scrutin as Obj;
    const uid = texte(s.uid);
    if (!uid) continue;
    const objet = (s.objet ?? {}) as Obj;
    const libelle = texte(objet.libelle) ?? "";
    const typeVote = (s.typeVote ?? {}) as Obj;
    const sort = (s.sort ?? {}) as Obj;
    const synth = (s.syntheseVote ?? {}) as Obj;
    const demandeur = (s.demandeur ?? {}) as Obj;
    const ensemble = estVoteSurEnsemble(libelle);

    scrutins.push([
      uid,
      entier(s.legislature),
      entier(s.numero),
      date(s.dateScrutin),
      texte(s.seanceRef),
      texte(s.sessionRef),
      texte(s.organeRef),
      texte(typeVote.codeTypeVote) ?? "INCONNU",
      texte(typeVote.libelleTypeVote),
      texte(sort.code),
      texte(sort.libelle),
      texte(s.titre) ?? libelle,
      libelle,
      ensemble,
      ensemble ? cleTitreScrutin(libelle) : null,
      texte(s.modePublicationDesVotes) ?? "INCONNU",
      texte(s.lieuVote), // n'existe qu'en XVIIe
      entier(synth.nombreVotants),
      entier(synth.suffragesExprimes),
      entier(synth.nbrSuffragesRequis),
      texte(demandeur.texte),
      lotId,
    ]);

    const organe = (s.ventilationVotes ?? {}) as Obj;
    const conteneur = (organe.organe ?? {}) as Obj;
    let ordre = 0;
    for (const g of liste<Obj>(((conteneur.groupes ?? {}) as Obj).groupe as Obj | Obj[])) {
      // 'PO0' n'est pas un organe : c'est l'absence d'organe. 14 scrutins de la
      // XVIIe listent ainsi leurs douze groupes sans en identifier aucun. On
      // conserve les blocs et les votes, sans inventer d'appartenance.
      const brut = texte(g.organeRef);
      const orgUid = brut === "PO0" ? null : brut;
      ordre += 1;
      const vote = (g.vote ?? {}) as Obj;
      const dv = (vote.decompteVoix ?? {}) as Obj;
      const dn = (vote.decompteNominatif ?? {}) as Obj;

      let complet = true;
      const details: string[] = [];
      for (const [cleNom, position, cleVoix] of CATEGORIES) {
        const bloc = (dn[cleNom] ?? {}) as Obj;
        const votants = liste<Obj>(bloc.votant as Obj | Obj[]);
        const attendu = entier(dv[cleVoix]) ?? 0;
        if (votants.length !== attendu) {
          complet = false;
          details.push(`${cleNom}: ${votants.length} nominatif vs ${attendu} voix`);
        }
        for (const v of votants) {
          const acteurUid = texte(v.acteurRef);
          if (!acteurUid) continue;
          votes.push([
            uid,
            acteurUid,
            orgUid,
            texte(v.mandatRef),
            position,
            booleen(v.parDelegation),
            lotId,
          ]);
        }
      }
      if (!complet) ecarts++;

      groupes.push([
        uid,
        ordre,
        orgUid,
        entier(g.nombreMembresGroupe),
        texte(vote.positionMajoritaire),
        entier(dv.pour) ?? 0,
        entier(dv.contre) ?? 0,
        entier(dv.abstentions) ?? 0,
        entier(dv.nonVotants) ?? 0,
        entier(dv.nonVotantsVolontaires) ?? 0,
        complet,
        details.length ? details.join(" ; ") : null,
      ]);
    }
  }

  const nScrutins = await insererEnMasse(
    db,
    {
      table: "officiel.scrutin",
      colonnes: [
        "uid",
        "legislature",
        "numero",
        "date_scrutin",
        "seance_ref",
        "session_ref",
        "organe_ref",
        "type_vote_code",
        "type_vote_libelle",
        "sort_code",
        "sort_libelle",
        "titre",
        "objet_libelle",
        "est_vote_sur_ensemble",
        "cle_titre",
        "mode_publication",
        "lieu_vote",
        "nombre_votants",
        "suffrages_exprimes",
        "suffrages_requis",
        "demandeur_texte",
        "lot_id",
      ],
      types: [
        "text",
        "smallint",
        "integer",
        "date",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "text",
        "boolean",
        "text",
        "text",
        "text",
        "integer",
        "integer",
        "integer",
        "text",
        "bigint",
      ],
      cles: [0],
      conflit: `ON CONFLICT (uid) DO UPDATE SET
        sort_code = EXCLUDED.sort_code, objet_libelle = EXCLUDED.objet_libelle,
        est_vote_sur_ensemble = EXCLUDED.est_vote_sur_ensemble,
        cle_titre = EXCLUDED.cle_titre, lot_maj_id = EXCLUDED.lot_id`,
    },
    scrutins,
  );

  const nGroupes = await insererEnMasse(
    db,
    {
      table: "officiel.scrutin_groupe",
      colonnes: [
        "scrutin_uid",
        "ordre",
        "organe_uid",
        "nombre_membres",
        "position_majoritaire",
        "voix_pour",
        "voix_contre",
        "voix_abstention",
        "voix_non_votant",
        "voix_non_votant_volontaire",
        "nominatif_complet",
        "ecart_constate",
      ],
      types: [
        "text",
        "smallint",
        "text",
        "integer",
        "text",
        "integer",
        "integer",
        "integer",
        "integer",
        "integer",
        "boolean",
        "text",
      ],
      cles: [0, 1],
      conflit: `ON CONFLICT (scrutin_uid, ordre) DO UPDATE SET
        voix_pour = EXCLUDED.voix_pour, voix_contre = EXCLUDED.voix_contre,
        voix_abstention = EXCLUDED.voix_abstention,
        nominatif_complet = EXCLUDED.nominatif_complet,
        ecart_constate = EXCLUDED.ecart_constate`,
    },
    groupes,
  );

  const nVotes = await insererEnMasse(
    db,
    {
      table: "officiel.vote",
      colonnes: [
        "scrutin_uid",
        "acteur_uid",
        "organe_uid",
        "mandat_uid",
        "position",
        "par_delegation",
        "lot_id",
      ],
      types: ["text", "text", "text", "text", "officiel.position_vote", "boolean", "bigint"],
      cles: [0, 1],
      conflit: `ON CONFLICT (scrutin_uid, acteur_uid) DO UPDATE SET
        position = EXCLUDED.position, organe_uid = EXCLUDED.organe_uid,
        par_delegation = EXCLUDED.par_delegation`,
    },
    votes,
  );

  return { scrutins: nScrutins, groupes: nGroupes, votes: nVotes, ecarts };
}

// ---------------------------------------------------------------------------
// Rattachement scrutin <-> dossier
// ---------------------------------------------------------------------------

/**
 * Croise le lien officiel (`acte_vote_ref`) et le lien reconstruit par
 * rapprochement de titre puis cohérence de date.
 *
 * Le rapprochement tourne partout, y compris là où le lien officiel existe :
 * c'est un contrôle croisé, pas une roue de secours. La source contient des
 * erreurs, 2 sur 556 liens vérifiés (docs/DATA_SOURCES.md section 4.3), et
 * un désaccord se conserve au lieu de se trancher.
 */
export async function rattacherScrutins(db: Db, lotId: number): Promise<Record<string, number>> {
  await db.query(`DELETE FROM officiel.scrutin_dossier WHERE lot_id = $1`, [lotId]);

  // 30 jours de marge autour de l'intervalle des actes du dossier.
  const rows = await db.query<{
    scrutin_uid: string;
    officiel: string | null;
    reconstruit: string | null;
    candidats: number;
  }>(`
    WITH officiel_lien AS (
      SELECT DISTINCT r.scrutin_uid, a.dossier_uid
      FROM officiel.acte_vote_ref r
      JOIN officiel.acte_legislatif a ON a.uid = r.acte_uid
    ),
    plage AS (
      SELECT dossier_uid, MIN(date_acte) AS debut, MAX(date_acte) AS fin
      FROM officiel.acte_legislatif WHERE date_acte IS NOT NULL
      GROUP BY dossier_uid
    ),
    candidat AS (
      SELECT s.uid AS scrutin_uid, d.dossier_uid
      FROM officiel.scrutin s
      JOIN officiel.document d ON d.cle_titre = s.cle_titre AND d.dossier_uid IS NOT NULL
      LEFT JOIN plage p ON p.dossier_uid = d.dossier_uid
      WHERE s.est_vote_sur_ensemble
        AND (p.dossier_uid IS NULL
             OR s.date_scrutin BETWEEN (p.debut - interval '30 days')::date
                                   AND (p.fin   + interval '30 days')::date)
      GROUP BY s.uid, d.dossier_uid
    ),
    resolu AS (
      SELECT scrutin_uid, MIN(dossier_uid) AS dossier_uid, COUNT(*) AS n
      FROM candidat GROUP BY scrutin_uid
    )
    SELECT s.uid AS scrutin_uid,
           o.dossier_uid AS officiel,
           CASE WHEN r.n = 1 THEN r.dossier_uid END AS reconstruit,
           COALESCE(r.n, 0)::int AS candidats
    FROM officiel.scrutin s
    LEFT JOIN officiel_lien o ON o.scrutin_uid = s.uid
    LEFT JOIN resolu r ON r.scrutin_uid = s.uid
    WHERE s.est_vote_sur_ensemble AND (o.dossier_uid IS NOT NULL OR r.n IS NOT NULL)
  `);

  const stats: Record<string, number> = {
    officiel_seul: 0,
    reconstruit_seul: 0,
    concordants: 0,
    conflits: 0,
    ambigus: 0,
  };
  const lignes: unknown[][] = [];

  for (const r of rows) {
    const { scrutin_uid, officiel, reconstruit, candidats } = r;
    if (officiel && reconstruit) {
      if (officiel === reconstruit) {
        stats.concordants!++;
        lignes.push([scrutin_uid, officiel, "OFFICIEL", officiel, reconstruit, null, lotId]);
      } else {
        stats.conflits!++;
        lignes.push([
          scrutin_uid,
          null,
          "CONFLIT",
          officiel,
          reconstruit,
          "Le lien officiel et le rapprochement par titre désignent deux dossiers différents. Aucun n'est retenu.",
          lotId,
        ]);
      }
    } else if (officiel) {
      stats.officiel_seul!++;
      if (candidats > 1) stats.ambigus!++;
      lignes.push([scrutin_uid, officiel, "OFFICIEL", officiel, null, null, lotId]);
    } else if (reconstruit) {
      stats.reconstruit_seul!++;
      lignes.push([scrutin_uid, reconstruit, "RECONSTRUIT", null, reconstruit, null, lotId]);
    }
  }

  await insererEnMasse(
    db,
    {
      table: "officiel.scrutin_dossier",
      colonnes: [
        "scrutin_uid",
        "dossier_uid",
        "methode",
        "dossier_officiel_uid",
        "dossier_reconstruit_uid",
        "note",
        "lot_id",
      ],
      types: ["text", "text", "officiel.methode_rattachement", "text", "text", "text", "bigint"],
      cles: [0],
      conflit: `ON CONFLICT (scrutin_uid) DO UPDATE SET
        dossier_uid = EXCLUDED.dossier_uid, methode = EXCLUDED.methode,
        dossier_officiel_uid = EXCLUDED.dossier_officiel_uid,
        dossier_reconstruit_uid = EXCLUDED.dossier_reconstruit_uid,
        note = EXCLUDED.note`,
    },
    lignes,
  );

  return stats;
}
