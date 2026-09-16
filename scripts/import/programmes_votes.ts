/**
 * Rapprochements éditoriaux entre positions de programmes et scrutins.
 *
 * Le script ne déduit pas une position politique à partir d'un vote. Chaque
 * fiche est écrite ici avec ses deux sources, son périmètre et ses limites.
 * Les compteurs affichés par le site viennent du décompte officiel par groupe
 * parlementaire (`officiel.scrutin_groupe`).
 *
 * Usage :
 *   node scripts/import/programmes_votes.ts --db <chemin-ou-URL>
 *   node scripts/import/programmes_votes.ts --db <chemin-ou-URL> --verifier
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirBase, type Db } from "./db.ts";

type Constat = "ecart" | "convergence" | "nuance";

interface RapprochementSource {
  id: string;
  positionId: string;
  scrutinUid: string;
  partiUid: string;
  partiNom: string;
  constat: Constat;
  explication: string;
  limites: string;
  sourceTexte: string;
  sourcePerimetre: string;
  perimetre: string;
  verifieLe: string;
}

/**
 * Premier corpus publié.
 *
 * Le scrutin 1243 porte sur l'ensemble du projet de loi nucléaire du 21 mars
 * 2023. Les trois partis disposent d'une position de programme qui parle
 * explicitement du nucléaire. Le rattachement est celui de la XVIe législature
 * et les compteurs sont produits à partir de la ventilation officielle par
 * groupe, pas recopiés depuis la page éditoriale du scrutin.
 */
const RAPPROCHEMENTS: RapprochementSource[] = [
  {
    id: "lfi-nucleaire-scrutin-1243",
    positionId: "lfi-nucleaire",
    scrutinUid: "VTANR5L16V1243",
    partiUid: "PO800490",
    partiNom: "La France insoumise",
    constat: "convergence",
    explication:
      "Le document cité défend la sortie du nucléaire et l'abandon des projets d'EPR. Sur le vote de l'ensemble du projet de loi qui accélère la construction de nouvelles installations nucléaires, la majorité des députés rattachés à La France insoumise a voté contre. Le sens du vote va donc dans la même direction que la proposition citée.",
    limites:
      "Un vote contre un texte ne signifie pas que chaque disposition du texte est rejetée pour la même raison. La fiche rapproche ici une proposition explicite et un vote sur l'ensemble, sans en déduire une identité de programme.",
    sourceTexte: "https://www.assemblee-nationale.fr/dyn/16/scrutins/1243",
    sourcePerimetre: "https://www.assemblee-nationale.fr/dyn/16/organes/PO800490",
    perimetre:
      "Groupe parlementaire La France insoumise à l'Assemblée nationale lors du scrutin du 21 mars 2023, dans la XVIe législature.",
    verifieLe: "2026-09-16",
  },
  {
    id: "rn-nucleaire-scrutin-1243",
    positionId: "rn-nucleaire",
    scrutinUid: "VTANR5L16V1243",
    partiUid: "PO800520",
    partiNom: "Rassemblement National",
    constat: "convergence",
    explication:
      "Le document cité propose de relancer le nucléaire. Sur le vote de l'ensemble du projet de loi qui accélère la construction de nouvelles installations nucléaires, la majorité des députés rattachés au Rassemblement National a voté pour. Le sens du vote va donc dans la même direction que la proposition citée.",
    limites:
      "Ce vote porte sur un projet de loi précis et ne permet pas de conclure que toutes les modalités du plan annoncé par le parti seraient adoptées de la même façon.",
    sourceTexte: "https://www.assemblee-nationale.fr/dyn/16/scrutins/1243",
    sourcePerimetre: "https://www.assemblee-nationale.fr/dyn/16/organes/PO800520",
    perimetre:
      "Groupe parlementaire du Rassemblement National à l'Assemblée nationale lors du scrutin du 21 mars 2023, dans la XVIe législature.",
    verifieLe: "2026-09-16",
  },
  {
    id: "lr-nucleaire-scrutin-1243",
    positionId: "lr-energie-plan",
    scrutinUid: "VTANR5L16V1243",
    partiUid: "PO800508",
    partiNom: "Les Républicains",
    constat: "convergence",
    explication:
      "Le document cité défend la reconstruction d'un parc nucléaire. Sur le vote de l'ensemble du projet de loi qui accélère la construction de nouvelles installations nucléaires, la majorité des députés rattachés aux Républicains a voté pour. Le sens du vote va donc dans la même direction que la proposition citée.",
    limites:
      "Le vote concerne le texte adopté en 2023. Il ne mesure ni le financement des renouvelables, ni les autres éléments du plan présenté dans le document du parti.",
    sourceTexte: "https://www.assemblee-nationale.fr/dyn/16/scrutins/1243",
    sourcePerimetre: "https://www.assemblee-nationale.fr/dyn/16/organes/PO800508",
    perimetre:
      "Groupe parlementaire Les Républicains à l'Assemblée nationale lors du scrutin du 21 mars 2023, dans la XVIe législature.",
    verifieLe: "2026-09-16",
  },
];

const MIGRATION = resolve("db/migrations/010_programmes_votes.sql");

function erreursDeStructure(): string[] {
  const erreurs: string[] = [];
  const ids = new Set<string>();
  for (const r of RAPPROCHEMENTS) {
    if (ids.has(r.id)) erreurs.push(`identifiant en double : ${r.id}`);
    ids.add(r.id);
    if (!/^https:\/\//.test(r.sourceTexte)) erreurs.push(`${r.id}: source du texte invalide`);
    if (!/^https:\/\//.test(r.sourcePerimetre)) {
      erreurs.push(`${r.id}: source du périmètre invalide`);
    }
    if (!r.explication.trim()) erreurs.push(`${r.id}: explication vide`);
    if (!r.limites.trim()) erreurs.push(`${r.id}: limites vides`);
  }
  return erreurs;
}

async function verifierRapprochement(db: Db, r: RapprochementSource): Promise<string[]> {
  const erreurs: string[] = [];
  const [position] = await db.query<{ id: string; url: string | null }>(
    `SELECT pp.id, COALESCE(pp.url_ancre, p.url) AS url
       FROM enrichissement.programme_position pp
       JOIN enrichissement.programme p ON p.id = pp.programme_id
      WHERE pp.id = $1`,
    [r.positionId],
  );
  if (!position) erreurs.push(`${r.id}: position absente (${r.positionId})`);
  else if (!position.url?.startsWith("https://")) erreurs.push(`${r.id}: source programme absente`);

  const [scrutin] = await db.query<{
    uid: string;
    date_scrutin: string;
    type_vote_code: string;
    est_vote_sur_ensemble: boolean;
  }>(
    `SELECT uid, date_scrutin::text, type_vote_code, est_vote_sur_ensemble
       FROM officiel.scrutin
      WHERE uid = $1`,
    [r.scrutinUid],
  );
  if (!scrutin) erreurs.push(`${r.id}: scrutin absent (${r.scrutinUid})`);
  else {
    if (scrutin.type_vote_code === "MOC")
      erreurs.push(`${r.id}: une motion de censure est interdite`);
    if (!scrutin.est_vote_sur_ensemble)
      erreurs.push(`${r.id}: le scrutin ne porte pas sur l'ensemble`);
  }

  const [parti] = await db.query<{ uid: string; libelle: string }>(
    `SELECT uid, libelle FROM officiel.organe WHERE uid = $1 AND code_type = 'GP'`,
    [r.partiUid],
  );
  if (!parti) erreurs.push(`${r.id}: groupe parlementaire absent ou non GP (${r.partiUid})`);
  else if (!parti.libelle.toLowerCase().includes(r.partiNom.toLowerCase().replace("la ", ""))) {
    erreurs.push(`${r.id}: libellé inattendu pour ${r.partiUid} (${parti.libelle})`);
  }

  const [votes] = await db.query<{ n: string }>(
    `SELECT (voix_pour + voix_contre + voix_abstention + voix_non_votant)::text AS n
       FROM officiel.scrutin_groupe
      WHERE scrutin_uid = $1 AND organe_uid = $2`,
    [r.scrutinUid, r.partiUid],
  );
  if (!votes || Number(votes.n) === 0)
    erreurs.push(`${r.id}: aucun décompte rattaché au groupe parlementaire`);
  return erreurs;
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: programmes_votes.ts --db <chemin-ou-URL> [--verifier]");
    process.exit(1);
  }
  const structure = erreursDeStructure();
  if (structure.length) {
    for (const erreur of structure) console.error(`ERREUR ${erreur}`);
    process.exit(1);
  }

  const db = await ouvrirBase(chemin);
  const verificationSeule = args.includes("--verifier");
  if (!verificationSeule) {
    await appliquerMigration(db, MIGRATION);
  } else {
    const [table] = await db.query<{ existe: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                       WHERE table_schema = 'enrichissement'
                         AND table_name = 'programme_vote') AS existe`,
    );
    if (!table?.existe) {
      console.error("ERREUR table enrichissement.programme_vote absente");
      await db.close();
      process.exit(1);
    }
  }
  const erreurs: string[] = [];
  for (const r of RAPPROCHEMENTS) erreurs.push(...(await verifierRapprochement(db, r)));
  if (erreurs.length) {
    for (const erreur of erreurs) console.error(`ERREUR ${erreur}`);
    await db.close();
    process.exit(1);
  }

  if (args.includes("--verifier")) {
    console.log(`${RAPPROCHEMENTS.length} rapprochements vérifiés`);
    await db.close();
    return;
  }

  await db.transaction(async () => {
    for (const r of RAPPROCHEMENTS) {
      await db.query(
        `INSERT INTO enrichissement.programme_vote
           (id, position_id, scrutin_uid, parti_uid, constat, explication, limites,
            source_texte, source_perimetre, perimetre, verifie_le, valide_par, publie)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true)
         ON CONFLICT (id) DO UPDATE SET
           position_id = EXCLUDED.position_id,
           scrutin_uid = EXCLUDED.scrutin_uid,
           parti_uid = EXCLUDED.parti_uid,
           constat = EXCLUDED.constat,
           explication = EXCLUDED.explication,
           limites = EXCLUDED.limites,
           source_texte = EXCLUDED.source_texte,
           source_perimetre = EXCLUDED.source_perimetre,
           perimetre = EXCLUDED.perimetre,
           verifie_le = EXCLUDED.verifie_le,
           valide_par = EXCLUDED.valide_par,
           publie = true`,
        [
          r.id,
          r.positionId,
          r.scrutinUid,
          r.partiUid,
          r.constat,
          r.explication,
          r.limites,
          r.sourceTexte,
          r.sourcePerimetre,
          r.perimetre,
          r.verifieLe,
          "corpus-programmes-votes-2026-09-16",
        ],
      );
    }
  });
  console.log(`${RAPPROCHEMENTS.length} rapprochements publiés`);
  await db.close();
}

await main();
