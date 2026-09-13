/**
 * Peuplement des formations politiques et de leur correspondance avec les
 * groupes parlementaires.
 *
 * Usage :
 *   node scripts/import/formations.ts --db data/pg16
 *   node scripts/import/formations.ts --db data/pg16 --preuve
 *
 * `--preuve` n'écrit rien : il réimprime, groupe par groupe, la répartition
 * des partis déclarés par ses membres, qui est ce sur quoi la table ci-dessous
 * s'appuie. C'est ce qui rend la correspondance relisible par quelqu'un qui
 * ne l'a pas écrite.
 *
 * Pourquoi une table écrite à la main plutôt qu'un calcul : le parti le plus
 * déclaré ne suffit pas à décider. « Ensemble » et « Ensemble ! (majorité
 * présidentielle) » sont des étiquettes de coalition, majoritaires à la fois
 * chez Renaissance, chez Les Démocrates et chez Horizons. Un rattachement au
 * parti dominant fusionnerait ces trois groupes en un seul, ce qui est faux.
 * La répartition des mandats sert donc de preuve à l'appui d'une décision,
 * pas de règle qui déciderait seule.
 *
 * Règle appliquée en cas de doute : ne pas rattacher. Un groupe sans
 * formation s'affiche sous son propre nom, ce qui est exact, là où un
 * rattachement faux affirme une filiation qui n'existe pas.
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirPGlite, type Db } from "./db.ts";

interface Formation {
  id: string;
  libelle: string;
  libelleCourt: string;
  rang: number;
  /** organe_uid des groupes rattachés, avec la preuve du rattachement. */
  groupes: { organeUid: string; preuve: string }[];
}

/**
 * Les effectifs cités en preuve sont ceux des mandats de parti (`PARPOL`)
 * déclarés par les membres du groupe, mesurés le 13 septembre 2026 sur les
 * XVe, XVIe et XVIIe législatures. `--preuve` les recalcule.
 *
 * Groupes délibérément non rattachés, et pourquoi :
 *
 * - « Non inscrit » (les trois législatures) : ce n'est pas une formation,
 *   c'est l'absence de groupe. Ses membres viennent de partout.
 * - « Agir ensemble » (XVe) : MoDem 15, LaREM 11, Ensemble 7, Horizons 4.
 *   Aucun parti ne s'en détache, et en faire l'ancêtre d'Horizons serait une
 *   reconstruction, le parti d'Édouard Philippe n'existant qu'à partir de 2021.
 * - « Les Constructifs » (XVe) : 35 membres, aucun parti déclaré.
 * - « UDI et Indépendants », « UDI, Agir et Indépendants » (XVe) : quatre
 *   organes pour deux intitulés, périmètres mouvants, pas de suite claire.
 * - « Écologie Démocratie Solidarité » (XVe) : groupe éphémère de 2020, sans
 *   continuité avec les groupes écologistes suivants.
 * - « À Droite » (XVIIe) : scission tardive, rattachement à trancher quand
 *   son périmètre sera stabilisé.
 */
const FORMATIONS: Formation[] = [
  {
    id: "lfi",
    libelle: "La France insoumise",
    libelleCourt: "LFI",
    rang: 10,
    groupes: [
      { organeUid: "PO730958", preuve: "XVe, FI : 17 membres déclarent La France Insoumise" },
      {
        organeUid: "PO800490",
        preuve: "XVIe, LFI-NUPES : 74 membres déclarent La France Insoumise",
      },
      {
        organeUid: "PO845413",
        preuve: "XVIIe, LFI-NFP : 69 membres déclarent La France Insoumise",
      },
    ],
  },
  {
    id: "pcf",
    libelle: "Parti communiste français",
    libelleCourt: "PCF",
    rang: 20,
    groupes: [
      {
        organeUid: "PO730940",
        preuve: "XVe, GDR : 18 membres déclarent le Parti communiste français",
      },
      {
        organeUid: "PO800502",
        preuve: "XVIe, GDR-NUPES : 19 membres déclarent le Parti communiste français",
      },
      {
        organeUid: "PO845514",
        preuve: "XVIIe, GDR : 11 membres déclarent le Parti communiste français",
      },
    ],
  },
  {
    id: "ecologistes",
    libelle: "Écologistes",
    libelleCourt: "Écolo",
    rang: 30,
    groupes: [
      { organeUid: "PO800526", preuve: "XVIe, Écologiste-NUPES" },
      { organeUid: "PO845439", preuve: "XVIIe, Écologiste et Social, continuité du groupe XVIe" },
    ],
  },
  {
    id: "ps",
    libelle: "Parti socialiste",
    libelleCourt: "PS",
    rang: 40,
    groupes: [
      {
        organeUid: "PO730946",
        preuve: "XVe, Nouvelle Gauche, renommé Socialistes en cours de législature",
      },
      { organeUid: "PO758835", preuve: "XVe, Socialistes et apparentés" },
      { organeUid: "PO800496", preuve: "XVIe, Socialistes et apparentés (intergroupe NUPES)" },
      {
        organeUid: "PO830170",
        preuve: "XVIe, Socialistes et apparentés, après sortie de la NUPES",
      },
      { organeUid: "PO845419", preuve: "XVIIe, Socialistes et apparentés" },
    ],
  },
  {
    id: "modem",
    libelle: "Mouvement Démocrate",
    libelleCourt: "MoDem",
    rang: 50,
    groupes: [
      { organeUid: "PO730970", preuve: "XVe, Mouvement Démocrate et apparentés" },
      { organeUid: "PO774834", preuve: "XVe, MoDem et Démocrates apparentés" },
      {
        organeUid: "PO800484",
        preuve:
          "XVIe, Démocrate (MoDem et Indépendants) : 33 membres déclarent le Mouvement Démocrate, seul parti distinctif au-delà de l'étiquette de coalition Ensemble",
      },
      {
        organeUid: "PO845454",
        preuve:
          "XVIIe, Les Démocrates : 20 membres déclarent le Mouvement Démocrate, même lecture que pour la XVIe",
      },
    ],
  },
  {
    id: "renaissance",
    libelle: "Renaissance",
    libelleCourt: "RE",
    rang: 60,
    groupes: [
      {
        organeUid: "PO730964",
        preuve: "XVe, La République en Marche : 329 membres déclarent La République en Marche",
      },
      { organeUid: "PO800538", preuve: "XVIe, Renaissance, nom du parti après 2022" },
      {
        organeUid: "PO845407",
        preuve:
          "XVIIe, Ensemble pour la République : 57 membres déclarent encore La République en Marche, premier parti hors étiquette de coalition",
      },
    ],
  },
  {
    id: "horizons",
    libelle: "Horizons",
    libelleCourt: "HOR",
    rang: 70,
    groupes: [
      { organeUid: "PO800514", preuve: "XVIe, Horizons et apparentés" },
      {
        organeUid: "PO845470",
        preuve: "XVIIe, Horizons & Indépendants : 37 membres déclarent Horizons",
      },
    ],
  },
  {
    id: "lr",
    libelle: "Les Républicains",
    libelleCourt: "LR",
    rang: 80,
    groupes: [
      { organeUid: "PO730934", preuve: "XVe, LR : 119 membres déclarent Les Républicains" },
      { organeUid: "PO800508", preuve: "XVIe, LR : 62 membres déclarent Les Républicains" },
      {
        organeUid: "PO845425",
        preuve:
          "XVIIe, Droite Républicaine : 55 membres déclarent Les Républicains. Le groupe change de nom, pas de famille",
      },
    ],
  },
  {
    id: "udr",
    libelle: "Union des droites pour la République",
    libelleCourt: "UDR",
    rang: 90,
    groupes: [
      { organeUid: "PO847173", preuve: "XVIIe, UDR" },
      {
        organeUid: "PO872880",
        preuve: "XVIIe, Union des droites pour la République, même groupe renommé",
      },
    ],
  },
  {
    id: "rn",
    libelle: "Rassemblement National",
    libelleCourt: "RN",
    rang: 100,
    groupes: [
      { organeUid: "PO800520", preuve: "XVIe, Rassemblement National" },
      { organeUid: "PO845401", preuve: "XVIIe, Rassemblement National" },
    ],
  },
  {
    id: "liot",
    libelle: "Libertés, Indépendants, Outre-mer et Territoires",
    libelleCourt: "LIOT",
    rang: 110,
    groupes: [
      {
        organeUid: "PO759900",
        preuve: "XVe, Libertés et Territoires : 15 membres déclarent Régions et peuples solidaires",
      },
      {
        organeUid: "PO800532",
        preuve: "XVIe, LIOT : 12 membres déclarent Régions et peuples solidaires",
      },
      {
        organeUid: "PO845485",
        preuve: "XVIIe, LIOT : 16 membres déclarent Régions et peuples solidaires",
      },
    ],
  },
];

const MIGRATION = resolve("db/migrations/002_enrichissement.sql");

async function imprimerPreuve(db: Db): Promise<void> {
  const lignes = await db.query<{
    legislature: number;
    groupe: string;
    organe_uid: string;
    parti: string | null;
    membres: number;
  }>(
    `WITH gp AS (
        SELECT m.acteur_uid, m.organe_uid AS gp_uid, m.date_debut,
               COALESCE(m.date_fin, now()::date) AS date_fin
          FROM officiel.mandat m WHERE m.type_organe = 'GP'
     ), pp AS (
        SELECT m.acteur_uid, m.organe_uid AS pp_uid, m.date_debut,
               COALESCE(m.date_fin, now()::date) AS date_fin
          FROM officiel.mandat m WHERE m.type_organe = 'PARPOL'
     )
     SELECT og.legislature, og.libelle AS groupe, og.uid AS organe_uid,
            op.libelle AS parti, count(DISTINCT gp.acteur_uid)::int AS membres
       FROM gp
       JOIN officiel.organe og ON og.uid = gp.gp_uid
       LEFT JOIN pp ON pp.acteur_uid = gp.acteur_uid
                   AND pp.date_debut <= gp.date_fin AND pp.date_fin >= gp.date_debut
       LEFT JOIN officiel.organe op ON op.uid = pp.pp_uid
      GROUP BY 1, 2, 3, 4
      ORDER BY og.legislature, og.libelle, membres DESC`,
  );

  const rattache = new Map<string, string>();
  for (const f of FORMATIONS) for (const g of f.groupes) rattache.set(g.organeUid, f.id);

  let courant = "";
  for (const r of lignes) {
    const cle = `${r.legislature} ${r.organe_uid}`;
    if (cle !== courant) {
      courant = cle;
      const f = rattache.get(r.organe_uid);
      console.log(`\n${r.legislature}e | ${r.groupe} (${r.organe_uid}) -> ${f ?? "non rattaché"}`);
    }
    console.log(`    ${r.parti ?? "(aucun parti déclaré)"} : ${r.membres}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: formations.ts --db <chemin> [--preuve]");
    process.exit(1);
  }

  const db = await ouvrirPGlite(chemin);

  if (args.includes("--preuve")) {
    await imprimerPreuve(db);
    await db.close();
    return;
  }

  const [etat] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.schemata
                     WHERE schema_name = 'enrichissement') AS existe`,
  );
  if (!etat?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Schéma enrichissement appliqué");
  }

  // Rejouable : on repart d'une table vide plutôt que de fusionner, pour que
  // le retrait d'un rattachement dans le fichier se propage à la base.
  await db.query(`DELETE FROM enrichissement.formation_groupe`);
  await db.query(`DELETE FROM enrichissement.formation`);

  let groupes = 0;
  for (const f of FORMATIONS) {
    await db.query(
      `INSERT INTO enrichissement.formation (id, libelle, libelle_court, rang)
       VALUES ($1, $2, $3, $4)`,
      [f.id, f.libelle, f.libelleCourt, f.rang],
    );
    for (const g of f.groupes) {
      const connu = await db.query<{ uid: string }>(
        `SELECT uid FROM officiel.organe WHERE uid = $1 AND code_type = 'GP'`,
        [g.organeUid],
      );
      if (connu.length === 0) {
        // Un identifiant absent de la base est une erreur de la table, pas
        // une donnée manquante : on le signale au lieu de l'ignorer.
        console.error(`Groupe inconnu, rattachement ignoré : ${g.organeUid} (${f.id})`);
        continue;
      }
      await db.query(
        `INSERT INTO enrichissement.formation_groupe (formation_id, organe_uid, preuve)
         VALUES ($1, $2, $3)`,
        [f.id, g.organeUid, g.preuve],
      );
      groupes += 1;
    }
  }

  const [total] = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM officiel.organe WHERE code_type = 'GP'`,
  );
  console.log(`${FORMATIONS.length} formations, ${groupes} groupes rattachés sur ${total?.n ?? 0}`);
  await db.close();
}

await main();
