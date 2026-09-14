/**
 * Banque de questions du quiz, et paramètres de scoring.
 *
 * Usage :
 *   node scripts/import/questions.ts --db data/pg16
 *   node scripts/import/questions.ts --db data/pg16 --verifier
 *
 * `--verifier` n'écrit rien : il réimprime, pour chaque question, les
 * scrutins retenus avec leur objet réel tel qu'il figure dans la base, le
 * sens déclaré et le résultat. C'est le contrôle qui compte : une question
 * dont le sens est inversé affiche la position opposée d'une formation, et
 * rien dans le résultat final ne permettrait de s'en apercevoir.
 *
 * Ce que cette première banque ne couvre pas, et pourquoi.
 *
 * Sur 16 957 scrutins, 12 351 portent sur un amendement. Leur objet dit
 * « l'amendement n° 10 de M. Alexandre après l'article 6 de la proposition de
 * loi… », jamais ce que l'amendement proposait. Tant que le jeu Amendements
 * n'est pas chargé, le sens d'un vote d'amendement ne peut pas être établi
 * sans le deviner, ce qui est exclu. Les questions ci-dessous s'appuient donc
 * sur des votes sur l'ensemble d'un texte, dont l'intitulé se suffit à
 * lui-même. C'est la limite principale de cette banque, pas un choix de fond :
 * la granularité fine que permettrait un amendement budgétaire, par exemple
 * sur la fiscalité des hauts revenus, reste hors d'atteinte pour l'instant.
 */

import { resolve } from "node:path";

import { appliquerMigration, ouvrirPGlite, type Db } from "./db.ts";

interface ScrutinRetenu {
  uid: string;
  /** +1 : voter POUR va dans le sens de la question. -1 : c'est CONTRE. */
  sens: 1 | -1;
  poids?: number;
  justification: string;
}

interface QuestionSource {
  id: string;
  intitule: string;
  description?: string;
  theme: string;
  sousTheme?: string;
  noteEditoriale: string;
  scrutins: ScrutinRetenu[];
}

/**
 * Paramètres de départ. Chaque valeur est un choix défendable, pas une
 * évidence, et aucune n'est définitive : docs/QUIZ_ENGINE.md section 11 les
 * liste comme restant à trancher.
 */
const PARAMETRES = {
  demiVieMois: 48,
  minScrutins: 1,
  minVotes: 30,
  seuilConfianceHaute: 0.6,
  seuilConfianceMoyenne: 0.35,
  poidsSujetImportant: 2,
  note:
    "Jeu de départ du 14 septembre 2026. Demi-vie de 48 mois : un vote de la " +
    "législature précédente pèse environ la moitié d'un vote récent, la " +
    "législature étant l'unité réelle de changement d'une ligne politique. " +
    "minScrutins à 1 tant que la banque s'appuie sur les seuls votes sur " +
    "l'ensemble, rares par sujet ; à relever quand les amendements seront " +
    "chargés. minVotes à 30 : le seuil compte les voix d'une seule formation, " +
    "pas de la chambre. Un premier réglage à 200 écartait toutes les " +
    "positions, et surtout écartait d'abord les petits groupes, dont aucune " +
    "question ne peut réunir 200 voix : c'était un biais, pas une prudence. " +
    "L'incertitude propre aux groupes peu nombreux est portée par la " +
    "cohésion, pas par un seuil qui les fait disparaître.",
};

/**
 * Le sens de chaque scrutin a été établi sur l'intitulé du texte soumis au
 * vote, vérifiable par `--verifier`. Les textes dont l'intitulé ne dit pas
 * assez ce qu'ils font sont écartés, par exemple « Projet de loi visant à
 * offrir des réponses immédiates aux phénomènes troublant l'ordre public » :
 * on ne peut pas en déduire ce qu'approuve celui qui vote pour.
 *
 * Les lectures successives d'un même texte comptent comme un seul scrutin
 * quand elles sont retenues ensemble, avec un poids réduit : ce sont des
 * votes corrélés, et les additionner à poids plein ferait passer un seul
 * désaccord pour trois.
 */
const QUESTIONS: QuestionSource[] = [
  {
    id: "fin-de-vie",
    intitule:
      "Faut-il autoriser une personne atteinte d'une maladie grave et incurable à demander une aide à mourir ?",
    description:
      "L'Assemblée a examiné en 2026 un texte créant un droit à l'aide à mourir, encadré par des conditions d'âge, de discernement et d'état de santé.",
    theme: "sante",
    sousTheme: "fin de vie",
    noteEditoriale:
      "Deux lectures du même texte, retenues avec un poids réduit parce qu'elles sont corrélées. Le texte sur les soins palliatifs, voté le même jour, n'est pas retenu : soutenir les soins palliatifs ne dit rien de la position sur l'aide à mourir.",
    scrutins: [
      {
        uid: "VTANR5L17V7894",
        sens: 1,
        poids: 0.6,
        justification: "Vote sur l'ensemble du texte Fin de vie, 30 juin 2026.",
      },
      {
        uid: "VTANR5L17V8280",
        sens: 1,
        poids: 0.6,
        justification:
          "Vote sur l'ensemble du texte Fin de vie, lecture suivante, 15 juillet 2026.",
      },
    ],
  },
  {
    id: "retention-etrangers-condamnes",
    intitule:
      "Faut-il permettre de maintenir plus longtemps en rétention un étranger condamné pour des faits graves avant son expulsion ?",
    theme: "immigration",
    noteEditoriale:
      "Deux textes distincts, l'un sur le maintien en rétention, l'autre sur la rétention administrative et la prévention des attentats. Voter pour va dans le sens d'un allongement.",
    scrutins: [
      {
        uid: "VTANR5L17V2958",
        sens: 1,
        justification:
          "Vote sur l'ensemble de la proposition de loi visant à faciliter le maintien en rétention des personnes condamnées pour des faits d'une particulière gravité, 8 juillet 2025.",
      },
      {
        uid: "VTANR5L17V6318",
        sens: 1,
        poids: 0.8,
        justification:
          "Vote sur l'ensemble de la proposition de loi renforçant la sécurité, la rétention administrative et la prévention des risques d'attentat, première lecture, 5 mai 2026.",
      },
    ],
  },
  {
    id: "nationalite-mayotte",
    intitule:
      "Faut-il rendre plus difficile l'accès à la nationalité française pour les enfants nés à Mayotte de parents étrangers ?",
    theme: "immigration",
    noteEditoriale:
      "L'intitulé du texte annonce un renforcement des conditions d'accès : voter pour est la position favorable à un durcissement.",
    scrutins: [
      {
        uid: "VTANR5L17V1308",
        sens: 1,
        justification:
          "Vote sur l'ensemble de la proposition de loi renforçant les conditions d'accès à la nationalité française à Mayotte, texte de la commission mixte paritaire, 8 avril 2025.",
      },
    ],
  },
  {
    id: "justice-mineurs",
    intitule:
      "Faut-il juger plus sévèrement les mineurs délinquants et rendre leurs parents davantage responsables ?",
    theme: "justice",
    noteEditoriale:
      "L'intitulé annonce un renforcement de l'autorité de la justice à l'égard des mineurs et de leurs parents : voter pour va dans le sens d'une plus grande sévérité.",
    scrutins: [
      {
        uid: "VTANR5L17V1624",
        sens: 1,
        justification:
          "Vote sur l'ensemble de la proposition de loi renforçant l'autorité de la justice à l'égard des mineurs délinquants et de leurs parents, texte de la commission mixte paritaire, 13 mai 2025.",
      },
    ],
  },
  {
    id: "legitime-defense-police",
    intitule:
      "Faut-il présumer que les policiers et gendarmes qui font usage de leur arme étaient en situation de légitime défense ?",
    theme: "securite",
    noteEditoriale:
      "L'intitulé du texte est explicite sur la présomption créée : voter pour est la position favorable.",
    scrutins: [
      {
        uid: "VTANR5L17V7987",
        sens: 1,
        justification:
          "Vote sur l'ensemble du texte reconnaissant une présomption de légitime défense pour les forces de l'ordre, 7 juillet 2026.",
      },
    ],
  },
  {
    id: "narcotrafic-moyens",
    intitule:
      "Faut-il donner à la police et à la justice des moyens d'enquête plus larges pour lutter contre le trafic de drogue, même s'ils touchent aux libertés ?",
    description:
      "Le texte crée un parquet national anti-stupéfiants et élargit les techniques d'enquête utilisables contre la criminalité organisée.",
    theme: "securite",
    noteEditoriale:
      "Deux textes liés, la loi sur le narcotrafic et la loi organique créant le parquet spécialisé qui l'accompagne, avec un poids réduit sur le second qui est un texte d'organisation du premier.",
    scrutins: [
      {
        uid: "VTANR5L17V1194",
        sens: 1,
        justification:
          "Vote sur l'ensemble de la proposition de loi visant à sortir la France du piège du narcotrafic, première lecture, 1er avril 2025.",
      },
      {
        uid: "VTANR5L17V1195",
        sens: 1,
        poids: 0.5,
        justification:
          "Vote sur l'ensemble de la loi organique fixant le statut du procureur de la République anti-criminalité organisée, même jour.",
      },
    ],
  },
  {
    id: "agriculture-contraintes",
    intitule:
      "Faut-il alléger les règles environnementales et administratives qui s'imposent aux agriculteurs ?",
    theme: "environnement",
    sousTheme: "agriculture",
    noteEditoriale:
      "Un seul texte retenu. La loi d'orientation pour la souveraineté alimentaire, votée la même année, a d'abord été retenue puis écartée au contrôle : elle porte sur le renouvellement des générations en agriculture, pas sur l'allègement des règles, et l'y rattacher aurait fait dire à un vote autre chose que ce sur quoi il portait.",
    scrutins: [
      {
        uid: "VTANR5L17V2957",
        sens: 1,
        justification:
          "Vote sur l'ensemble de la proposition de loi visant à lever les contraintes à l'exercice du métier d'agriculteur, texte de la commission mixte paritaire, 8 juillet 2025.",
      },
    ],
  },
  {
    id: "fraude-sociale-fiscale",
    intitule: "Faut-il renforcer les contrôles contre la fraude aux aides sociales et à l'impôt ?",
    theme: "impots",
    noteEditoriale:
      "Le texte traite les deux fraudes dans le même mouvement : la question les mentionne donc ensemble, sans en privilégier une.",
    scrutins: [
      {
        uid: "VTANR5L17V6023",
        sens: 1,
        justification:
          "Vote sur l'ensemble du projet de loi relatif à la lutte contre les fraudes sociales et fiscales, 7 avril 2026.",
      },
    ],
  },
  {
    id: "defense-effort",
    intitule: "Faut-il augmenter l'effort financier de la France pour sa défense ?",
    theme: "defense",
    noteEditoriale:
      "Le texte actualise à la hausse la programmation militaire : voter pour est la position favorable à un effort accru.",
    scrutins: [
      {
        uid: "VTANR5L17V6736",
        sens: 1,
        justification:
          "Vote sur l'ensemble du projet de loi actualisant la programmation militaire pour 2024 à 2030, 19 mai 2026.",
      },
    ],
  },
  {
    id: "simplification-entreprises",
    intitule:
      "Faut-il alléger les normes et démarches administratives qui pèsent sur les entreprises ?",
    theme: "entreprises",
    noteEditoriale:
      "Deux lectures du projet de loi de simplification de la vie économique, retenues avec un poids réduit parce qu'elles portent sur le même texte.",
    scrutins: [
      {
        uid: "VTANR5L17V2458",
        sens: 1,
        poids: 0.6,
        justification:
          "Vote sur l'ensemble du projet de loi de simplification de la vie économique, première lecture, 17 juin 2025.",
      },
      {
        uid: "VTANR5L17V6184",
        sens: 1,
        poids: 0.6,
        justification:
          "Vote sur l'ensemble du même texte, commission mixte paritaire, 14 avril 2026.",
      },
    ],
  },
  {
    id: "corse-autonomie",
    intitule: "Faut-il accorder à la Corse un statut d'autonomie au sein de la République ?",
    theme: "institutions",
    noteEditoriale:
      "Projet de loi constitutionnelle dont l'objet est explicite : voter pour est la position favorable à l'autonomie.",
    scrutins: [
      {
        uid: "VTANR5L17V7454",
        sens: 1,
        justification:
          "Vote sur l'ensemble du projet de loi constitutionnelle pour une Corse autonome au sein de la République, 23 juin 2026.",
      },
    ],
  },
];

const MIGRATION = resolve("db/migrations/004_quiz.sql");

async function verifier(db: Db): Promise<void> {
  for (const q of QUESTIONS) {
    console.log(`\n## ${q.id} (${q.theme})`);
    console.log(`   ${q.intitule}`);
    for (const s of q.scrutins) {
      const lignes = await db.query<{
        uid: string;
        d: string;
        sort_code: string | null;
        final: boolean;
        objet: string;
        se: number | null;
      }>(
        `SELECT uid, date_scrutin::date::text AS d, sort_code,
                est_vote_sur_ensemble AS final, objet_libelle AS objet, suffrages_exprimes AS se
           FROM officiel.scrutin WHERE uid = $1`,
        [s.uid],
      );
      const l = lignes[0];
      if (!l) {
        console.log(`   !! ${s.uid} INTROUVABLE`);
        continue;
      }
      const signe = s.sens === 1 ? "POUR = favorable" : "CONTRE = favorable";
      console.log(
        `   ${l.d} ${l.final ? "final" : "     "} ${String(l.sort_code ?? "?").padEnd(7)} ` +
          `${String(l.se ?? "?").padStart(4)} voix | ${signe} | poids ${s.poids ?? 1}`,
      );
      console.log(`      ${l.objet.slice(0, 150)}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const iDb = args.indexOf("--db");
  const chemin = iDb >= 0 ? args[iDb + 1] : undefined;
  if (!chemin) {
    console.error("usage: questions.ts --db <chemin> [--verifier]");
    process.exit(1);
  }

  const db = await ouvrirPGlite(chemin);

  if (args.includes("--verifier")) {
    await verifier(db);
    await db.close();
    return;
  }

  const [tables] = await db.query<{ existe: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables
                     WHERE table_schema = 'enrichissement' AND table_name = 'question') AS existe`,
  );
  if (!tables?.existe) {
    await appliquerMigration(db, MIGRATION);
    console.log("Migration 003 appliquée");
  }

  await db.query(`UPDATE enrichissement.parametres_scoring SET actif = false WHERE actif`);
  const [param] = await db.query<{ id: number }>(
    `INSERT INTO enrichissement.parametres_scoring
       (demi_vie_mois, min_scrutins, min_votes, seuil_confiance_haute,
        seuil_confiance_moyenne, poids_sujet_important, actif, note)
     VALUES ($1, $2, $3, $4, $5, $6, true, $7) RETURNING id`,
    [
      PARAMETRES.demiVieMois,
      PARAMETRES.minScrutins,
      PARAMETRES.minVotes,
      PARAMETRES.seuilConfianceHaute,
      PARAMETRES.seuilConfianceMoyenne,
      PARAMETRES.poidsSujetImportant,
      PARAMETRES.note,
    ],
  );

  await db.query(`DELETE FROM enrichissement.question_scrutin`);
  await db.query(`DELETE FROM enrichissement.question`);

  let liens = 0;
  let ignores = 0;
  for (const q of QUESTIONS) {
    await db.query(
      `INSERT INTO enrichissement.question
         (id, intitule, description, theme, sous_theme, actif, note_editoriale)
       VALUES ($1, $2, $3, $4, $5, true, $6)`,
      [q.id, q.intitule, q.description ?? null, q.theme, q.sousTheme ?? null, q.noteEditoriale],
    );
    for (const s of q.scrutins) {
      const connu = await db.query<{ uid: string }>(
        `SELECT uid FROM officiel.scrutin WHERE uid = $1`,
        [s.uid],
      );
      if (connu.length === 0) {
        console.error(`Scrutin inconnu, lien ignoré : ${s.uid} (${q.id})`);
        ignores += 1;
        continue;
      }
      await db.query(
        `INSERT INTO enrichissement.question_scrutin
           (question_id, scrutin_uid, sens, poids, justification)
         VALUES ($1, $2, $3, $4, $5)`,
        [q.id, s.uid, s.sens, s.poids ?? 1, s.justification],
      );
      liens += 1;
    }
  }

  console.log(
    `${QUESTIONS.length} questions, ${liens} scrutins rattachés` +
      (ignores > 0 ? `, ${ignores} ignorés` : "") +
      `, paramètres #${param?.id}`,
  );
  await db.close();
}

await main();
