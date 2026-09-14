/**
 * Positions tirées des programmes, pour le comparateur et le QCM.
 *
 * Usage :
 *   node scripts/import/positions_programme.ts --db data/pg16 --verifier
 *   node scripts/import/positions_programme.ts --db data/pg16
 *
 * Les deux usages lisent la même table : un comparateur montre deux
 * formations côte à côte sur un thème, un QCM montre plusieurs formations sur
 * une même question en masquant leur origine. Le corpus doit être identique,
 * sinon les deux écrans finissent par ne plus dire la même chose.
 *
 * LA GARANTIE DE CE FICHIER.
 *
 * Chaque position est une citation, et le script la vérifie : il télécharge
 * le document source et cherche la phrase dedans. Une citation introuvable
 * n'est pas écrite en base, et le script le dit. Ce contrôle existe parce que
 * l'erreur redoutée n'est pas une faute de frappe mais une reformulation qui
 * se glisserait à la place d'une citation : elle ferait dire à un parti ce
 * qu'il n'a pas écrit, et rien dans l'affichage ne permettrait de s'en
 * apercevoir.
 *
 * La comparaison est insensible à la casse, aux accents et aux espaces
 * multiples : les programmes en ligne appliquent souvent des majuscules par
 * CSS, et le texte extrait d'une page ne reproduit pas fidèlement ses espaces.
 * Elle reste sensible aux mots, qui sont ce qui compte.
 *
 * LES QUESTIONS DU QCM.
 *
 * Une question regroupe des citations qui répondent au même sujet, une par
 * formation au plus. Le regroupement est éditorial : il est écrit ici, en
 * clair, et `--verifier` réimprime chaque question avec ses citations pour
 * qu'on puisse juger si elles se répondent vraiment. Une question qui réunit
 * moins de trois formations n'est pas servie par le QCM, parce qu'un choix
 * entre deux propositions ne compare presque rien.
 */

import { resolve } from "node:path";

import { citationPresente } from "./citations.ts";
import { appliquerMigration, ouvrirPGlite, type Db } from "./db.ts";

interface QuestionSource {
  id: string;
  theme: string;
  /** Formulation neutre : elle ne doit laisser deviner aucune réponse. */
  intitule: string;
}

interface PositionSource {
  id: string;
  programmeId: string;
  theme: string;
  sousTheme?: string;
  /** Question du QCM à laquelle la citation répond. Absente : comparateur seul. */
  questionId?: string;
  /** Citation exacte, vérifiée contre le document source. */
  extrait: string;
  /**
   * Formulation courte, affichée au-dessus de la citation et jamais sans
   * elle. Réservée aux citations longues, et limitée à ce que la citation
   * dit : rien n'y est ajouté.
   */
  resumeAffichage?: string;
  /**
   * Page ou section précise du document, quand elle existe. Ne pas y répéter
   * le titre du document : le comparateur affiche les deux côte à côte.
   */
  pageOuSection?: string;
}

/** Nombre de formations en dessous duquel une question n'entre pas dans le QCM. */
const MINIMUM_FORMATIONS = 3;

const QUESTIONS: QuestionSource[] = [
  { id: "retraites-systeme", theme: "retraites", intitule: "Que faire du système de retraite ?" },
  { id: "energie-nucleaire", theme: "energie", intitule: "Quelle place donner au nucléaire ?" },
  { id: "travail-salaires", theme: "travail", intitule: "Comment faire augmenter les salaires ?" },
  { id: "impots-patrimoine", theme: "impots", intitule: "Comment imposer les patrimoines ?" },
  { id: "impots-tva", theme: "impots", intitule: "Sur quoi baisser la TVA ?" },
  {
    id: "immigration-sejour",
    theme: "immigration",
    intitule: "À quelles conditions accorder le droit au séjour ?",
  },
  {
    id: "sante-deserts",
    theme: "sante",
    intitule: "Comment faire reculer les déserts médicaux ?",
  },
  { id: "logement", theme: "logement", intitule: "Quelle mesure pour le logement ?" },
  { id: "securite-police", theme: "securite", intitule: "Quelle mesure pour la police ?" },
];

const POSITIONS: PositionSource[] = [
  // Les positions du Parti communiste français ont été retirées le
  // 14 septembre 2026 : la page qui les portait, pcf.fr/le_programme, répond
  // 404 depuis, alors qu'elle était en ligne le matin même. Les pages encore
  // en ligne sur pcf.fr décrivent le programme sans le reproduire, ce qui ne
  // permet pas de citer. À rétablir dès qu'une URL stable du texte est
  // identifiée.

  // Retraites
  {
    id: "lfi-retraites",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "retraites",
    questionId: "retraites-systeme",
    extrait: "Rétablir la retraite à 60 ans après quarante années de cotisation",
  },
  {
    id: "rn-retraites",
    programmeId: "rn-legislatives-2024",
    theme: "retraites",
    questionId: "retraites-systeme",
    extrait:
      "Abroger la réforme des retraites de Macron et mettre en place un système de retraites progressif, qui incite les jeunes à entrer de manière précoce sur le marché du travail",
    resumeAffichage:
      "Abroger la réforme de 2023 et mettre en place un système progressif, incitant à entrer tôt sur le marché du travail",
  },
  {
    id: "ps-retraites",
    programmeId: "ps-vivre-libres",
    theme: "retraites",
    questionId: "retraites-systeme",
    extrait:
      "Après l’abrogation de la réforme Borne, convoquer une conférence sociale pour définir un nouveau système de retraite par répartition",
    resumeAffichage:
      "Abroger la réforme de 2023, puis définir un nouveau système par répartition en conférence sociale",
  },
  {
    id: "lr-seniors",
    programmeId: "lr-propositions",
    theme: "retraites",
    questionId: "retraites-systeme",
    extrait: "Libérer le travail des seniors qui ont tous leurs trimestres",
  },
  {
    id: "ren-retraite-investissement",
    programmeId: "renaissance-conventions",
    theme: "retraites",
    questionId: "retraites-systeme",
    extrait:
      "Ce plan massif s’appuiera sur le développement de la retraite par investissement et une meilleure allocation de l’épargne des Français",
    resumeAffichage: "Développer la retraite par investissement",
  },

  // Énergie
  {
    id: "lfi-nucleaire",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait: "Sortir du nucléaire : abandonner les projets d’EPR",
  },
  {
    id: "rn-nucleaire",
    programmeId: "rn-legislatives-2024",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait:
      "Lancer le plan Marie Curie de relance du nucléaire (EPR, SMR, réacteurs à neutrons rapides)",
  },
  {
    id: "lr-nucleaire",
    programmeId: "lr-propositions",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait: "Inscrire le parc nucléaire dans une trajectoire « 80 ans »",
  },
  {
    id: "ren-nucleaire",
    programmeId: "renaissance-conventions",
    theme: "energie",
    questionId: "energie-nucleaire",
    extrait:
      'Nous tiendrons l’objectif de construction de 14 EPR et lancerons un plan d’accélération "SMR 2030"',
  },
  {
    id: "lr-eolien",
    programmeId: "lr-propositions",
    theme: "energie",
    extrait: "Stopper le subventionnement de nouvelles capacités éoliennes et photovoltaïques",
  },

  // Travail
  {
    id: "lfi-smic",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "Porter immédiatement le SMIC mensuel à 1600 euros net et indexer les salaires sur l’inflation",
  },
  {
    id: "ps-smic",
    programmeId: "ps-vivre-libres",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "Réhausser le SMIC à 1 690 € net et ouvrir une conférence sociale pour augmenter les salaires au-dessus du SMIC",
  },
  {
    id: "rn-salaires",
    programmeId: "rn-legislatives-2024",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait:
      "permettre aux entreprises d’augmenter les salaires de 10 % jusqu’à trois fois le SMIC, en les exonérant de l’augmentation des cotisations patronales pendant trois à cinq ans",
    resumeAffichage:
      "Exonérer de cotisations patronales supplémentaires, pendant trois à cinq ans, les hausses de salaire de 10 % jusqu'à trois SMIC",
  },
  {
    id: "lr-zero-cotisation",
    programmeId: "lr-propositions",
    theme: "travail",
    sousTheme: "salaires",
    questionId: "travail-salaires",
    extrait: "Travailler plus et gagner plus grâce au seuil « zéro cotisation »",
  },
  {
    id: "lr-code-travail",
    programmeId: "lr-propositions",
    theme: "travail",
    extrait:
      "Refonder le code du travail sur 50 principes, rendre le reste à la négociation collective",
  },
  {
    id: "lr-chomage",
    programmeId: "lr-propositions",
    theme: "travail",
    sousTheme: "chômage",
    extrait: "Réformer l'assurance chômage pour accélérer le retour à l'emploi",
  },

  // Impôts
  {
    id: "lfi-isf",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait:
      "Rétablir et renforcer l’impôt de solidarité sur la fortune (ISF), incluant un volet climatique visant à taxer les gros pollueurs",
  },
  {
    id: "rn-iff",
    programmeId: "rn-legislatives-2024",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait:
      "Remplacer l’impôt sur la fortune immobilière (IFI) qui entrave la conservation et la transmission des patrimoines et épargne de tout effort contributif les fortunes exclusivement mobilières, par un impôt sur la fortune financière (IFF)",
    resumeAffichage:
      "Remplacer l'impôt sur la fortune immobilière par un impôt sur la fortune financière",
  },
  {
    id: "ps-zucman",
    programmeId: "ps-refaire-societe",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait:
      "Instaurer la taxe Zucman de 2 % sur le patrimoine des grandes fortunes de plus de 100 millions d’euros",
  },
  {
    id: "lr-transmission",
    programmeId: "lr-propositions",
    theme: "impots",
    questionId: "impots-patrimoine",
    extrait: "Libérer la transmission du capital productif",
  },
  {
    id: "lr-prelevements",
    programmeId: "lr-propositions",
    theme: "impots",
    extrait: "Réduire franchement les prélèvements obligatoires",
  },
  {
    id: "rn-tva-energie",
    programmeId: "rn-legislatives-2024",
    theme: "impots",
    questionId: "impots-tva",
    extrait: "Baisse de la TVA sur l'ensemble des produits énergétiques",
  },
  {
    id: "lfi-tva",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "impots",
    questionId: "impots-tva",
    extrait:
      "Réduire la TVA sur les produits de première nécessité et réinstaurer une « TVA grand luxe » pour la financer",
  },
  {
    id: "ps-tva",
    programmeId: "ps-refaire-societe",
    theme: "impots",
    questionId: "impots-tva",
    extrait:
      "Créer un « panier de lutte contre la précarité » regroupant les produits de première nécessité et soumis à un taux réduit et stable de TVA de 5,5 %",
  },
  {
    id: "ren-tva",
    programmeId: "renaissance-conventions",
    theme: "impots",
    questionId: "impots-tva",
    extrait:
      "Passer la TVA sur les véhicules électriques de 20 à 5,5% pendant 5 ans en substitution partielle de la prime",
  },

  // Immigration
  {
    id: "lfi-sejour",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "immigration",
    questionId: "immigration-sejour",
    extrait:
      "Faciliter l’accès aux visas, régulariser les travailleurs, étudiants, parents d’enfants scolarisés et instituer la carte de séjour de dix ans comme titre de séjour de référence",
    resumeAffichage:
      "Régulariser travailleurs, étudiants et parents d'enfants scolarisés, et faire de la carte de dix ans le titre de référence",
  },
  {
    id: "ps-sejour",
    programmeId: "ps-refaire-societe",
    theme: "immigration",
    questionId: "immigration-sejour",
    extrait:
      "Permettre l’obtention d’un titre de séjour à toute personne étrangère disposant d’un contrat de travail depuis au moins 6 mois",
  },
  {
    id: "rn-regularisations",
    programmeId: "rn-legislatives-2024",
    theme: "immigration",
    questionId: "immigration-sejour",
    extrait: "Suspension de toutes les régularisations de clandestins par les préfets",
  },
  {
    id: "rn-regroupement",
    programmeId: "rn-legislatives-2024",
    theme: "immigration",
    extrait:
      "Restriction du regroupement familial par le durcissement des conditions (emploi stable, ressources précisément définies, etc.)",
  },
  {
    id: "ren-immigration",
    programmeId: "renaissance-regalien",
    theme: "immigration",
    questionId: "immigration-sejour",
    extrait:
      "nous portons une immigration de travail, avec des critères précis et l’instauration d’un permis à point",
  },
  {
    id: "rn-droit-du-sol",
    programmeId: "rn-legislatives-2024",
    theme: "immigration",
    extrait: "Suppression du droit du sol",
  },

  // Santé
  {
    id: "ps-deserts",
    programmeId: "ps-etre-en-securites",
    theme: "sante",
    questionId: "sante-deserts",
    extrait: "Lutter contre les déserts médicaux en régulant l’installation des médecins libéraux",
  },
  {
    id: "lfi-deserts",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "sante",
    questionId: "sante-deserts",
    extrait: "Créer un réseau public de centres de santé pluridisciplinaires ou communautaires",
  },
  {
    id: "rn-medecine",
    programmeId: "rn-legislatives-2024",
    theme: "sante",
    questionId: "sante-deserts",
    extrait: "Augmenter le nombre d’étudiants en médecine (fin du numerus apertus)",
  },

  // Logement
  {
    id: "lfi-loyers",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "logement",
    questionId: "logement",
    extrait: "Encadrer les loyers partout sur le territoire et à la baisse dans les grandes villes",
  },
  {
    id: "lr-dpe",
    programmeId: "lr-propositions",
    theme: "logement",
    questionId: "logement",
    extrait: "Mettre fin aux interdictions de louer liées au DPE",
  },
  {
    id: "rn-logement",
    programmeId: "rn-legislatives-2024",
    theme: "logement",
    questionId: "logement",
    extrait:
      "Instaurer une priorité d’accès au logement social pour les travailleurs des secteurs prioritaires",
  },

  // Sécurité
  {
    id: "rn-police-municipale",
    programmeId: "rn-legislatives-2024",
    theme: "securite",
    questionId: "securite-police",
    extrait:
      "Rendre obligatoire la création d’une police municipale pour les communes de plus de 10 000 habitants",
  },
  {
    id: "ps-police",
    programmeId: "ps-etre-en-securites",
    theme: "securite",
    questionId: "securite-police",
    extrait: "Reconstruire une police de proximité",
  },
  {
    id: "lfi-recepisse",
    programmeId: "lfi-avenir-en-commun-pdf",
    theme: "securite",
    questionId: "securite-police",
    extrait:
      "Mettre en place le récépissé de contrôle d’identité par les forces de l’ordre pour lutter contre le contrôle au faciès",
  },
];

const MIGRATION = resolve("db/migrations/006_programmes.sql");
const MIGRATION_QUESTIONS = resolve("db/migrations/008_programme_questions.sql");

interface Controle {
  p: PositionSource;
  url: string | null;
  formation: string | null;
  trouvee: boolean;
}

async function controler(db: Db): Promise<Controle[]> {
  const resultats: Controle[] = [];
  for (const p of POSITIONS) {
    const [prog] = await db.query<{ url: string | null; formation: string }>(
      `SELECT url, formation FROM enrichissement.programme WHERE id = $1`,
      [p.programmeId],
    );
    if (!prog?.url) {
      resultats.push({ p, url: null, formation: prog?.formation ?? null, trouvee: false });
      continue;
    }
    const trouvee = await citationPresente(prog.url, p.extrait);
    resultats.push({ p, url: prog.url, formation: prog.formation, trouvee });
  }
  return resultats;
}

/**
 * Contrôles de cohérence du corpus, indépendants du réseau. Une erreur ici
 * arrête le script avant toute écriture : ce sont des fautes de saisie, pas
 * des aléas de source.
 */
function erreursDeStructure(resultats: Controle[]): string[] {
  const erreurs: string[] = [];
  const idsQuestions = new Set(QUESTIONS.map((q) => q.id));

  const ids = new Set<string>();
  for (const { p } of resultats) {
    if (ids.has(p.id)) erreurs.push(`identifiant en double : ${p.id}`);
    ids.add(p.id);
    if (p.questionId && !idsQuestions.has(p.questionId)) {
      erreurs.push(`${p.id} renvoie à une question inconnue : ${p.questionId}`);
    }
    const question = QUESTIONS.find((q) => q.id === p.questionId);
    if (question && question.theme !== p.theme) {
      erreurs.push(`${p.id} est rangée sous ${p.theme}, sa question sous ${question.theme}`);
    }
  }

  // Deux citations d'une même formation sur une même question fausseraient
  // le QCM : la formation y aurait deux chances d'être choisie.
  const vues = new Map<string, string>();
  for (const r of resultats) {
    if (!r.p.questionId || !r.formation) continue;
    const cle = `${r.p.questionId}|${r.formation}`;
    const autre = vues.get(cle);
    if (autre) {
      erreurs.push(`${r.formation} a deux citations sur ${r.p.questionId} : ${autre}, ${r.p.id}`);
    }
    vues.set(cle, r.p.id);
  }
  return erreurs;
}

/** Formations dont une citation vérifiée répond à chaque question. */
function couverture(resultats: Controle[]): Map<string, Controle[]> {
  const parQuestion = new Map<string, Controle[]>(QUESTIONS.map((q) => [q.id, []]));
  for (const r of resultats) {
    if (r.p.questionId && r.trouvee) parQuestion.get(r.p.questionId)?.push(r);
  }
  return parQuestion;
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: positions_programme.ts --db <chemin> [--verifier]");
    process.exit(1);
  }

  const db = await ouvrirPGlite(chemin);
  const [table] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement'
                       AND table_name = 'programme_position') AS existe`,
  );
  if (!table?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 006 appliquée");
  }
  // Idempotente : rejouée à chaque passage, elle ajoute la table des
  // questions aux bases créées avant elle.
  await appliquerMigration(db, MIGRATION_QUESTIONS);

  const resultats = await controler(db);
  const erreurs = erreursDeStructure(resultats);
  const parQuestion = couverture(resultats);

  if (args.includes("--verifier")) {
    for (const r of resultats) {
      const etat = r.trouvee ? "CITATION TROUVEE  " : "INTROUVABLE       ";
      console.log(`${etat} ${r.p.id.padEnd(28)} ${r.p.theme.padEnd(12)} « ${r.p.extrait} »`);
      if (!r.trouvee) console.log(`                   source : ${r.url ?? "aucune URL"}`);
    }
    const ok = resultats.filter((r) => r.trouvee).length;
    console.log(`\n${ok} citations vérifiées sur ${resultats.length}`);

    // Réimpression par question : c'est là qu'on juge si les citations
    // réunies se répondent vraiment, ce qu'aucun contrôle automatique ne sait
    // faire.
    console.log("\nQuestions du QCM");
    for (const q of QUESTIONS) {
      const dedans = parQuestion.get(q.id) ?? [];
      const servie = dedans.length >= MINIMUM_FORMATIONS ? "servie   " : "ÉCARTÉE  ";
      console.log(`\n  ${servie} ${q.intitule} (${dedans.length} formations)`);
      for (const r of dedans) console.log(`            ${r.formation} : « ${r.p.extrait} »`);
    }

    for (const e of erreurs) console.error(`ERREUR ${e}`);
    await db.close();
    return;
  }

  if (erreurs.length > 0) {
    for (const e of erreurs) console.error(`ERREUR ${e}`);
    await db.close();
    process.exit(1);
  }

  await db.transaction(async () => {
    await db.query(`DELETE FROM enrichissement.programme_position`);
    await db.query(`DELETE FROM enrichissement.programme_question`);
    for (const [ordre, q] of QUESTIONS.entries()) {
      await db.query(
        `INSERT INTO enrichissement.programme_question (id, theme, intitule, ordre)
         VALUES ($1,$2,$3,$4)`,
        [q.id, q.theme, q.intitule, ordre + 1],
      );
    }
    for (const r of resultats) {
      if (!r.trouvee) {
        console.error(`Citation introuvable dans la source, position ignorée : ${r.p.id}`);
        continue;
      }
      await db.query(
        `INSERT INTO enrichissement.programme_position
           (id, programme_id, theme, sous_theme, question_id, extrait, resume_affichage,
            page_ou_section, url_ancre)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          r.p.id,
          r.p.programmeId,
          r.p.theme,
          r.p.sousTheme ?? null,
          r.p.questionId ?? null,
          r.p.extrait,
          r.p.resumeAffichage ?? null,
          r.p.pageOuSection ?? null,
          r.url,
        ],
      );
    }
  });

  const ecrites = resultats.filter((r) => r.trouvee).length;
  const servies = [...parQuestion.values()].filter((d) => d.length >= MINIMUM_FORMATIONS).length;
  console.log(
    `${ecrites} positions écrites sur ${resultats.length}, ` +
      `${servies} questions du QCM sur ${QUESTIONS.length} réunissent au moins ${MINIMUM_FORMATIONS} formations`,
  );
  await db.close();
}

await main();
