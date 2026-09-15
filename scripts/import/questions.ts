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
      "Une personne majeure atteinte d'une maladie grave et incurable, en phase avancée ou terminale, et qui en souffre, doit-elle pouvoir demander une aide à mourir ?",
    description:
      "Le Parlement a adopté définitivement le 15 juillet 2026 la loi relative au droit à l'aide à mourir. Ce droit est réservé aux personnes majeures atteintes d'une affection grave et incurable qui engage le pronostic vital, en phase avancée ou terminale, qui en souffrent et peuvent exprimer une volonté libre et éclairée. Le Conseil constitutionnel l'a déclarée conforme le 14 août 2026, avec trois réserves.",
    theme: "sante",
    sousTheme: "fin de vie",
    noteEditoriale:
      "Deux lectures du même texte, retenues avec un poids réduit parce qu'elles sont corrélées. Le texte sur les soins palliatifs, voté le même jour, n'est pas retenu : soutenir les soins palliatifs ne dit rien de la position sur l'aide à mourir.",
    scrutins: [
      {
        uid: "VTANR5L17V7894",
        sens: 1,
        poids: 0.6,
        justification: "Vote sur l'ensemble du texte Fin de vie, nouvelle lecture, 30 juin 2026.",
      },
      {
        uid: "VTANR5L17V8280",
        sens: 1,
        poids: 0.6,
        justification:
          "Vote sur l'ensemble du texte Fin de vie, lecture définitive, 15 juillet 2026.",
      },
    ],
  },
  {
    id: "retention-etrangers-condamnes",
    intitule:
      "Faut-il pouvoir garder plus longtemps en centre de rétention un étranger condamné pour des faits graves, en attendant son expulsion ?",
    description:
      "La rétention administrative permet de maintenir dans un lieu fermé un étranger visé par une mesure d'éloignement, le temps d'organiser son départ. Le premier texte retenu, voté le 8 juillet 2025, allongeait la rétention de certains étrangers condamnés jusqu'à 180 ou 210 jours : le Conseil constitutionnel a censuré cet allongement le 7 août 2025. Le second est devenu la loi du 27 juillet 2026, qui porte la durée maximale à 210 jours pour certaines catégories d'étrangers ; le Conseil l'a validée avec neuf réserves.",
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
      "À Mayotte, faut-il durcir les conditions pour qu'un enfant né de parents étrangers puisse devenir français ?",
    description:
      "À Mayotte, le droit du sol obéissait déjà à une règle propre : l'un des parents devait y résider régulièrement depuis plus de trois mois à la naissance. La loi du 12 mai 2025 exige que les deux parents résident en France de manière régulière et ininterrompue depuis au moins un an, sauf si la filiation n'est établie qu'à l'égard d'un seul parent. Le Conseil constitutionnel l'a déclarée conforme, avec une réserve.",
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
    intitule: "Faut-il durcir la justice applicable aux mineurs délinquants ?",
    description:
      "Le texte porte à la fois sur la façon de juger les mineurs délinquants et sur la responsabilité de leurs parents. Le Conseil constitutionnel en a censuré les mesures principales le 19 juin 2025, dont la comparution immédiate des mineurs et le renversement du principe d'atténuation de leurs peines.",
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
      "Quand un policier ou un gendarme se sert de son arme, faut-il présumer qu'il l'a fait dans un cas autorisé par la loi, sauf preuve contraire ?",
    description:
      "Malgré son titre, le texte voté en première lecture le 7 juillet 2026 ne modifie pas la légitime défense du code pénal. Il prévoit qu'un policier ou un gendarme qui fait usage de son arme est présumé l'avoir fait dans un cas autorisé par le code de la sécurité intérieure, de façon absolument nécessaire et strictement proportionnée. Toute preuve contraire peut renverser cette présomption. Le texte a été transmis au Sénat.",
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
      "Faut-il donner à la police et à la justice de nouveaux moyens d'enquête contre les réseaux de trafic de drogue ?",
    description:
      "Le texte crée un parquet national anti-criminalité organisée et élargit les techniques d'enquête utilisables contre les réseaux de trafiquants. Le Conseil constitutionnel a censuré six de ses articles, en tout ou partie, le 12 juin 2025.",
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
      "Faut-il alléger les règles, notamment environnementales, imposées aux agriculteurs ?",
    description:
      "Le texte porte notamment sur l'usage de certains pesticides, le stockage de l'eau et l'agrandissement des élevages. Le Conseil constitutionnel a censuré le 7 août 2025 la possibilité de réautoriser par dérogation des pesticides néonicotinoïdes, dont l'acétamipride.",
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
    intitule: "Faut-il renforcer la lutte contre la fraude, aux aides sociales comme à l'impôt ?",
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
    intitule: "Faut-il augmenter le budget des armées ?",
    description:
      "Le texte révise à la hausse la loi de programmation militaire 2024-2030, qui programme les moyens des armées année par année. Les crédits eux-mêmes sont votés chaque année en loi de finances.",
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
    intitule: "Faut-il alléger les normes et les démarches administratives des entreprises ?",
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
    intitule: "Faut-il donner à la Corse une autonomie au sein de la République ?",
    description:
      "Adopté en première lecture par l'Assemblée le 23 juin 2026, le projet doterait la Corse d'un statut d'autonomie. Une loi organique pourrait habiliter la Collectivité de Corse à adapter des lois et règlements, et à fixer elle-même des normes dans ses compétences, sous le contrôle du Conseil d'État ou du Conseil constitutionnel selon leur nature. Pour entrer en vigueur, le texte doit être adopté dans les mêmes termes par le Sénat, puis approuvé par le Congrès ou par référendum.",
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
