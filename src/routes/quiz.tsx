import {
  Accordion,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Checkbox,
  Collapse,
  Container,
  Divider,
  Group,
  Progress,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconArrowLeft, IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarreHorizontale } from "../components/BarreHorizontale";
import classes from "../components/OptionQcm.module.css";
import {
  calculerCompatibilite,
  niveauConfiance,
  type ParametresScoring,
  type PositionConnue,
  type ReponseCalcul,
  type ReponseEchelle,
} from "../lib/quizPosition";
import { libelleTheme } from "../lib/themesProgrammes";
import { chargerBanqueQuiz, type QuestionBanque, type ScrutinQuestion } from "../queries/quiz";

export const Route = createFileRoute("/quiz")({
  loader: () => chargerBanqueQuiz(),
  head: () => ({ meta: [{ title: "Quizz Assemblée nationale · Politiquizz" }] }),
  component: PageQuiz,
});

/** Les cinq réponses graduées (docs/QUIZ_ENGINE.md section 4.3). */
const ECHELLE: { valeur: Exclude<ReponseEchelle, "NSP">; libelle: string }[] = [
  { valeur: "TOUT_A_FAIT_DACCORD", libelle: "Tout à fait d'accord" },
  { valeur: "PLUTOT_DACCORD", libelle: "Plutôt d'accord" },
  { valeur: "NI_NI", libelle: "Ni d'accord ni pas d'accord" },
  { valeur: "PLUTOT_PAS_DACCORD", libelle: "Plutôt pas d'accord" },
  { valeur: "PAS_DU_TOUT_DACCORD", libelle: "Pas du tout d'accord" },
];

function libelleReponse(r: ReponseEchelle): string {
  return r === "NSP" ? "Je ne sais pas" : (ECHELLE.find((e) => e.valeur === r)?.libelle ?? r);
}

/** Moins de questions communes que cela, et une formation n'est pas classée. */
const MINIMUM_QUESTIONS_COMMUNES = 3;

const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formaterDate(jour: string): string {
  return dateLongue.format(new Date(`${jour}T12:00:00`)).replace(/^1 /, "1er ");
}

/**
 * Lecture en mots d'une position comprise entre -1 et +1. Les seuils sont un
 * choix d'affichage, pas une donnée : la valeur exacte figure dans la
 * méthodologie, et le mot ne sert qu'à la rendre lisible.
 */
function lirePosition(position: number): string {
  if (position >= 0.5) return "votes nettement favorables";
  if (position >= 0.15) return "votes plutôt favorables";
  if (position > -0.15) return "votes partagés";
  if (position > -0.5) return "votes plutôt opposés";
  return "votes nettement opposés";
}

/** Les scrutins sur lesquels repose une question, avec leur sens. */
/**
 * Les scrutins d'une question. Pendant le quiz, sans lien vers la page du
 * texte : elle montre le vote de chaque groupe, et les groupes ne doivent
 * apparaître qu'à la fin. Le lien revient sur l'écran de résultat.
 */
function ScrutinsRetenus({
  scrutins,
  avecLien = false,
}: {
  scrutins: ScrutinQuestion[];
  avecLien?: boolean;
}) {
  return (
    <Stack gap="sm">
      {scrutins.map((s) => (
        <Box key={s.uid}>
          <Text size="sm">
            <Text span c="dimmed">
              {formaterDate(s.date)} ·{" "}
            </Text>
            {s.titre}
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            {s.sens === 1
              ? "Voter pour ce texte va dans le sens de la question."
              : "Voter contre ce texte va dans le sens de la question."}
            {avecLien && s.dossierUid && (
              <>
                {" "}
                <Anchor href={`/lois/${s.dossierUid}`} size="xs">
                  Voir le texte
                </Anchor>
              </>
            )}
          </Text>
        </Box>
      ))}
    </Stack>
  );
}

function EcranAccueil({
  nombreQuestions,
  nombreFormations,
  onCommencer,
}: {
  nombreQuestions: number;
  nombreFormations: number;
  onCommencer: () => void;
}) {
  return (
    <Stack gap="lg" maw="var(--mesure-texte)">
      <Text c="dimmed">
        {nombreQuestions} questions, chacune fondée sur de vrais scrutins de l&apos;Assemblée
        nationale. Dites si vous êtes d&apos;accord ; à la fin, vos réponses sont comparées à la
        façon dont {nombreFormations} formations politiques ont réellement voté.
      </Text>
      <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
        Le résultat compare vos réponses à des votes passés. Ce n&apos;est pas une recommandation
        électorale, et il ne tient compte ni des programmes ni des candidats.
      </Alert>
      <Text size="sm" c="dimmed">
        Vos réponses restent dans votre navigateur. Elles ne sont ni envoyées au site, ni
        conservées.
      </Text>
      <Button onClick={onCommencer} w="fit-content">
        Commencer
      </Button>
    </Stack>
  );
}

function EcranQuestion({
  question,
  index,
  total,
  reponse,
  onRepondre,
  onRetour,
}: {
  question: QuestionBanque;
  index: number;
  total: number;
  /** Réponse déjà donnée, quand l'utilisateur revient en arrière. */
  reponse: ReponseCalcul | undefined;
  onRepondre: (r: ReponseCalcul) => void;
  onRetour: () => void;
}) {
  const [important, setImportant] = useState(reponse?.important ?? false);
  const [details, setDetails] = useState(false);
  const [selection, setSelection] = useState<ReponseEchelle | null>(reponse?.reponse ?? null);

  const repondre = (valeur: ReponseEchelle) =>
    onRepondre({ questionId: question.id, reponse: valeur, important });

  return (
    <Stack gap="lg" maw={640} w="100%">
      <Box>
        <Progress value={(index / total) * 100} size={6} radius="xl" />
        <Group justify="space-between" mt="xs">
          <Text c="dimmed" size="sm">
            Question {index + 1} sur {total} · {libelleTheme(question.theme)}
          </Text>
          {index > 0 && (
            <Anchor component="button" type="button" size="sm" onClick={onRetour}>
              <Group gap={4} wrap="nowrap">
                <IconArrowLeft size={14} />
                Question précédente
              </Group>
            </Anchor>
          )}
        </Group>
      </Box>

      <Box>
        <Title order={2} fz="xl">
          {question.intitule}
        </Title>
        {question.description && (
          <Text c="dimmed" mt="sm">
            {question.description}
          </Text>
        )}
        <Anchor
          component="button"
          type="button"
          size="sm"
          mt="xs"
          onClick={() => setDetails((v) => !v)}
        >
          {details ? "Masquer les scrutins" : "En savoir plus : les scrutins retenus"}
        </Anchor>
        <Collapse expanded={details}>
          <Box mt="sm">
            <ScrutinsRetenus scrutins={question.scrutins} />
          </Box>
        </Collapse>
      </Box>

      <Checkbox
        label="Ce sujet compte particulièrement pour moi"
        description="Il pèsera double dans votre résultat."
        checked={important}
        onChange={(ev) => setImportant(ev.currentTarget.checked)}
      />

      <Stack gap="sm">
        {ECHELLE.map((e) => (
          <UnstyledButton
            key={e.valeur}
            className={`${classes["option"]} ${classes["choisissable"]} ${
              selection === e.valeur ? classes["choisie"] : ""
            }`}
            aria-pressed={selection === e.valeur}
            onClick={() => setSelection(e.valeur)}
          >
            <Text>{e.libelle}</Text>
          </UnstyledButton>
        ))}
      </Stack>

      <Divider label="ou" labelPosition="center" />
      <UnstyledButton
        className={`${classes["option"]} ${classes["choisissable"]} ${
          selection === "NSP" ? classes["choisie"] : ""
        }`}
        aria-pressed={selection === "NSP"}
        onClick={() => setSelection("NSP")}
      >
        <Text>Je ne sais pas</Text>
        <Text size="xs" c="dimmed" mt={2}>
          La question ne comptera pas dans votre résultat.
        </Text>
      </UnstyledButton>
      <Button
        disabled={selection === null}
        onClick={() => selection !== null && repondre(selection)}
      >
        {index + 1 === total ? "Voir le résultat" : "Valider et continuer"}
      </Button>
    </Stack>
  );
}

function EcranResultat({
  questions,
  reponses,
  positions,
  parametres,
  libelles,
  onRecommencer,
}: {
  questions: QuestionBanque[];
  reponses: ReponseCalcul[];
  positions: PositionConnue[];
  parametres: ParametresScoring;
  libelles: Map<string, string>;
  onRecommencer: () => void;
}) {
  const resultat = useMemo(
    () => calculerCompatibilite(reponses, positions, parametres),
    [reponses, positions, parametres],
  );
  const utiles = reponses.filter((r) => r.reponse !== "NSP").length;
  const ecartees = reponses.length - utiles;

  if (utiles < 3) {
    return (
      <Card withBorder radius="md" padding="xl" maw={640}>
        <Stack gap="md">
          <Title order={2} fz="xl">
            Pas assez de réponses pour un résultat
          </Title>
          <Text c="dimmed">
            Répondez à au moins trois questions autrement que par « je ne sais pas » pour obtenir
            une comparaison.
          </Text>
          <Button variant="default" onClick={onRecommencer} w="fit-content">
            Recommencer
          </Button>
        </Stack>
      </Card>
    );
  }

  const classees = resultat.filter((c) => c.questionsRetenues >= MINIMUM_QUESTIONS_COMMUNES);
  const peuComparables = resultat.filter((c) => c.questionsRetenues < MINIMUM_QUESTIONS_COMMUNES);

  return (
    <Stack gap={40} maw={680} w="100%">
      <Stack gap="md">
        <Title order={2}>Sur ces scrutins, vos réponses sont les plus proches des votes de…</Title>
        <Text c="dimmed" size="sm">
          {utiles} réponse{utiles > 1 ? "s" : ""} comparée{utiles > 1 ? "s" : ""}
          {ecartees > 0 &&
            `, ${ecartees} question${ecartees > 1 ? "s" : ""} écartée${ecartees > 1 ? "s" : ""} par « je ne sais pas »`}
          . Une question sur laquelle une formation a voté de façon incertaine pèse moins dans son
          score.
        </Text>
        <Stack gap="md">
          {classees.map((c) => (
            <Box key={c.formationId}>
              <BarreHorizontale
                libelle={libelles.get(c.formationId) ?? c.formationId}
                valeur={c.compatibilite}
                reference={1}
                libelleValeur={pourcent.format(c.compatibilite)}
                couleur="var(--mantine-color-dark-1)"
              />
              <Text size="xs" c="dimmed" mt={4}>
                Confiance {niveauConfiance(c.confianceMoyenne, parametres)} · sur{" "}
                {c.questionsRetenues} question{c.questionsRetenues > 1 ? "s" : ""}
              </Text>
            </Box>
          ))}
        </Stack>
        {peuComparables.length > 0 && (
          <Text size="sm" c="dimmed">
            Trop peu de questions en commun pour être classées :{" "}
            {peuComparables.map((c) => libelles.get(c.formationId) ?? c.formationId).join(", ")}.
          </Text>
        )}
        <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
          Ce résultat compare uniquement vos réponses à des votes parlementaires passés. Il ne
          constitue pas une recommandation électorale et ne tient pas compte de l&apos;ensemble des
          programmes, candidats ou enjeux futurs.{" "}
          <Anchor component={Link} to="/methodologie" c="inherit">
            Comment ce résultat est calculé
          </Anchor>
          .
        </Alert>
      </Stack>

      <Stack gap="md">
        <Title order={2}>Question par question</Title>
        <Accordion variant="separated" multiple>
          {questions.map((q) => {
            const r = reponses.find((x) => x.questionId === q.id);
            const dePositions = positions.filter((p) => p.questionId === q.id);
            return (
              <Accordion.Item key={q.id} value={q.id}>
                <Accordion.Control>
                  <Text fw={600} size="sm">
                    {q.intitule}
                  </Text>
                  <Text size="xs" c="dimmed" mt={2}>
                    Votre réponse : {r ? libelleReponse(r.reponse) : "question passée"}
                    {r?.important ? " · sujet important pour vous" : ""}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="md">
                    <Stack gap={4}>
                      {dePositions.map((p) => (
                        <Text key={p.formationId} size="sm">
                          <Text span fw={600}>
                            {libelles.get(p.formationId) ?? p.formationId}
                          </Text>{" "}
                          <Text span c="dimmed">
                            : {lirePosition(p.position)}, confiance{" "}
                            {niveauConfiance(p.confiance, parametres)}
                          </Text>
                        </Text>
                      ))}
                    </Stack>
                    <ScrutinsRetenus avecLien scrutins={q.scrutins} />
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      </Stack>

      <Group gap="md">
        <Button component="a" href="/programmes/quiz">
          Faire le quiz des programmes
        </Button>
        <Button component="a" href="/programmes/comparer" variant="default">
          Comparer les candidats
        </Button>
        <Button variant="subtle" color="gray" onClick={onRecommencer}>
          Refaire le quiz
        </Button>
      </Group>
    </Stack>
  );
}

function PageQuiz() {
  const { parametres, questions, formations, positions } = Route.useLoaderData();
  const [etape, setEtape] = useState<"accueil" | "question" | "resultat">("accueil");
  const [index, setIndex] = useState(0);
  // Les réponses vivent dans l'état de la page : elles ne sont ni envoyées ni
  // conservées (docs/QUIZ_METHODOLOGY.md section 1).
  const [reponses, setReponses] = useState<Map<string, ReponseCalcul>>(new Map());

  const libelles = useMemo(() => new Map(formations.map((f) => [f.id, f.libelle])), [formations]);

  function commencer() {
    setReponses(new Map());
    setIndex(0);
    setEtape("question");
  }

  function repondre(r: ReponseCalcul) {
    setReponses((avant) => new Map(avant).set(r.questionId, r));
    if (index + 1 < questions.length) setIndex(index + 1);
    else setEtape("resultat");
    window.scrollTo({ top: 0 });
  }

  const question = questions[index];

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Quizz Assemblée nationale</Title>
        </Box>

        {!parametres || questions.length === 0 ? (
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            La banque de questions n&apos;est pas chargée dans cet environnement. Lancer{" "}
            <code>npm run data:questions</code> puis <code>npm run data:positions</code>.
          </Alert>
        ) : etape === "accueil" ? (
          <EcranAccueil
            nombreQuestions={questions.length}
            nombreFormations={formations.length}
            onCommencer={commencer}
          />
        ) : etape === "question" && question ? (
          <EcranQuestion
            key={question.id}
            question={question}
            index={index}
            total={questions.length}
            reponse={reponses.get(question.id)}
            onRepondre={repondre}
            onRetour={() => setIndex((i) => Math.max(0, i - 1))}
          />
        ) : (
          <EcranResultat
            questions={questions}
            reponses={[...reponses.values()]}
            positions={positions}
            parametres={parametres}
            libelles={libelles}
            onRecommencer={commencer}
          />
        )}
      </Stack>
    </Container>
  );
}
