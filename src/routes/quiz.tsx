import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import {
  IconHelpCircle,
  IconInfoCircle,
  IconMinus,
  IconThumbDown,
  IconThumbUp,
} from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarreHorizontale } from "../components/BarreHorizontale";
import { PastilleGroupe } from "../components/PastilleGroupe";
import {
  calculerResultat,
  type ProximiteGroupe,
  type QuestionComparee,
  type ReponseQuiz,
  type ReponseUtilisateur,
  type ResultatQuiz,
} from "../lib/quizCalcul";
import { chargerQuestionsGrandQuiz, type QuestionQuiz } from "../queries/quiz";

export const Route = createFileRoute("/quiz")({
  loader: () => chargerQuestionsGrandQuiz(),
  component: PageQuiz,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

const BOUTONS: { valeur: ReponseQuiz; libelle: string; icone: React.ReactNode }[] = [
  { valeur: "POUR", libelle: "Pour", icone: <IconThumbUp size={22} /> },
  { valeur: "CONTRE", libelle: "Contre", icone: <IconThumbDown size={22} /> },
  { valeur: "ABSTENTION", libelle: "Je m'abstiens", icone: <IconMinus size={22} /> },
  { valeur: "NSP", libelle: "Je ne sais pas", icone: <IconHelpCircle size={22} /> },
];

/**
 * Indicateur « groupe le plus proche » mis à jour après chaque réponse,
 * pas seulement affiché en fin de parcours : voir l'écran de résultat pour
 * le disclaimer complet, répété une fois la réponse la plus proche connue.
 * Affiche « ? » tant que le calcul n'a pas assez de réponses exploitables
 * (même seuil que calculerResultat : au moins trois).
 */
function IndicateurEnDirect({ groupeTop }: { groupeTop: ProximiteGroupe | null }) {
  return (
    <Box maw={560} mx="auto" w="100%">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: "0.04em" }}>
        Groupe le plus proche :{" "}
        <Text span c="var(--mantine-color-text)">
          {groupeTop
            ? `${groupeTop.libelle ?? groupeTop.organeUid} (${pourcent.format(groupeTop.proximite)})`
            : "?"}
        </Text>
      </Text>
    </Box>
  );
}

function EcranQuestion({
  question,
  index,
  total,
  onReponse,
}: {
  question: QuestionQuiz;
  index: number;
  total: number;
  onReponse: (r: ReponseQuiz) => void;
}) {
  return (
    <Card withBorder radius="md" padding="xl" maw={560} mx="auto">
      <Stack gap="lg">
        <Box>
          <Progress value={(index / total) * 100} size={6} radius="xl" />
          <Text c="dimmed" size="sm" mt="xs">
            Question {index + 1} sur {total}
            {question.themeLibelle && <> · {question.themeLibelle}</>} · scrutin du{" "}
            {dateCourte.format(new Date(question.dateScrutin))}
          </Text>
        </Box>
        <Box>
          <Title order={2} fz="xl">
            {question.question}
          </Title>
          {question.contexte && <Text mt="sm">{question.contexte}</Text>}
          <Text mt="sm" c="dimmed" size="sm">
            Texte réellement soumis au vote : {question.dossierTitre ?? question.objetLibelle}.
          </Text>
        </Box>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {BOUTONS.map((b) => (
            <Button
              key={b.valeur}
              size="md"
              variant={b.valeur === "NSP" ? "subtle" : "light"}
              color="graphite"
              leftSection={b.icone}
              onClick={() => onReponse(b.valeur)}
              justify="flex-start"
            >
              {b.libelle}
            </Button>
          ))}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}

/**
 * Le résultat d'une question se lit groupe par groupe. Dire « x % des
 * votants de l'Assemblée ont voté comme vous » agrège des groupes qui se
 * sont opposés sur le texte, et transforme un désaccord politique en un
 * pourcentage sans titulaire.
 */
function BlocQuestionComparee({ question }: { question: QuestionComparee }) {
  const proches = question.groupes.filter((g) => g.accord >= 0.5);
  const opposes = question.groupes.filter((g) => g.accord < 0.5).reverse();
  return (
    <Card withBorder radius="md" padding="md">
      <Text fw={600}>{question.question}</Text>
      <Text c="dimmed" size="sm" mt={4}>
        Vous avez répondu «&nbsp;
        {question.reponse === "POUR"
          ? "pour"
          : question.reponse === "CONTRE"
            ? "contre"
            : "abstention"}
        &nbsp;».
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" mt="md">
        <Box>
          <Text size="sm" fw={600}>
            Ont voté comme vous
          </Text>
          {proches.length === 0 ? (
            <Text size="sm" c="dimmed" mt={4}>
              Aucun groupe, majoritairement.
            </Text>
          ) : (
            <Stack gap={2} mt={4}>
              {proches.map((g) => (
                <Group key={g.organeUid} gap={6} wrap="nowrap">
                  <PastilleGroupe couleur={g.couleur} />
                  <Text size="sm" c="dimmed">
                    {g.libelle ?? g.organeUid} · {pourcent.format(g.accord)}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Box>
        <Box>
          <Text size="sm" fw={600}>
            Ont voté autrement
          </Text>
          {opposes.length === 0 ? (
            <Text size="sm" c="dimmed" mt={4}>
              Aucun groupe, majoritairement.
            </Text>
          ) : (
            <Stack gap={2} mt={4}>
              {opposes.map((g) => (
                <Group key={g.organeUid} gap={6} wrap="nowrap">
                  <PastilleGroupe couleur={g.couleur} />
                  <Text size="sm" c="dimmed">
                    {g.libelle ?? g.organeUid} · {pourcent.format(g.accord)}
                  </Text>
                </Group>
              ))}
            </Stack>
          )}
        </Box>
      </SimpleGrid>
    </Card>
  );
}

function EcranResultat({
  resultat,
  onRecommencer,
}: {
  resultat: ResultatQuiz;
  onRecommencer: () => void;
}) {
  if (resultat.parGroupe.length === 0) {
    return (
      <Card withBorder radius="md" padding="xl" maw={560} mx="auto">
        <Stack gap="md">
          <Title order={2} fz="xl">
            Pas assez de réponses exploitables
          </Title>
          <Text c="dimmed">
            Répondez à au moins trois questions par « pour », « contre » ou « abstention » pour
            obtenir un résultat.
          </Text>
          <Button variant="default" onClick={onRecommencer} w="fit-content">
            Recommencer
          </Button>
        </Stack>
      </Card>
    );
  }
  return (
    <Stack gap={40} maw={640} mx="auto">
      <Stack gap="md">
        <Title order={2}>Vos réponses sont les plus proches de…</Title>
        <Stack gap="sm">
          {resultat.parGroupe.map((g) => (
            <BarreHorizontale
              key={g.organeUid}
              libelle={g.libelle ?? g.organeUid}
              href={`/groupes/${g.organeUid}`}
              valeur={g.proximite}
              reference={1}
              libelleValeur={pourcent.format(g.proximite)}
              couleur={g.couleur}
            />
          ))}
        </Stack>
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

      {resultat.questions.length > 0 && (
        <Stack gap="md">
          <Box>
            <Title order={2}>Question par question</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Pour chaque texte, les groupes qui ont voté dans votre sens et ceux qui ont voté
              autrement. Le pourcentage est la part des voix du groupe allée dans le même sens que
              votre réponse.
            </Text>
          </Box>
          <Stack gap="sm">
            {resultat.questions.map((q) => (
              <BlocQuestionComparee key={q.scrutinUid} question={q} />
            ))}
          </Stack>
        </Stack>
      )}

      <Button variant="default" onClick={onRecommencer} w="fit-content">
        Refaire le quiz
      </Button>
    </Stack>
  );
}

function PageQuiz() {
  const questions = Route.useLoaderData();
  const [indexCourant, setIndexCourant] = useState(0);
  const [reponses, setReponses] = useState<ReponseUtilisateur[]>([]);
  const [resultat, setResultat] = useState<ResultatQuiz | null>(null);

  // Recalculé après chaque réponse pour l'indicateur « en direct » : le
  // même calcul local que le résultat final (rien ne quitte le navigateur),
  // juste rejoué sur les réponses données jusqu'ici.
  const resultatEnDirect = useMemo(
    () => calculerResultat(questions, reponses),
    [questions, reponses],
  );

  if (questions.length === 0) {
    return (
      <Container size="md" py={80}>
        <Text c="dimmed">
          Aucun scrutin exploitable n&apos;est disponible pour construire le quiz.
        </Text>
      </Container>
    );
  }

  function repondre(reponse: ReponseQuiz) {
    const question = questions[indexCourant];
    if (!question) return;
    const nouvelles = [...reponses, { scrutinUid: question.scrutinUid, reponse }];
    setReponses(nouvelles);
    if (indexCourant + 1 < questions.length) {
      setIndexCourant(indexCourant + 1);
      return;
    }
    // Calcul entièrement local : les réponses ne quittent jamais le
    // navigateur (docs/QUIZ_METHODOLOGY.md section 1).
    setResultat(calculerResultat(questions, nouvelles));
  }

  function recommencer() {
    setIndexCourant(0);
    setReponses([]);
    setResultat(null);
  }

  return (
    <Container size="md" py={{ base: 40, sm: 64 }}>
      <Stack gap={40}>
        <Box maw="var(--mesure-texte)" mx="auto" ta="center">
          <Title order={1}>Et vous, vous auriez voté quoi ?</Title>
          <Text mt="sm" c="dimmed">
            {questions.length} scrutins réels de l&apos;Assemblée nationale, répartis entre les
            grands thèmes. Répondez, puis comparez votre position à celle des groupes
            parlementaires.
          </Text>
          <Badge mt="xs" variant="outline" color="graphite">
            grand quiz · {questions.length} questions
          </Badge>
        </Box>

        {resultat ? (
          <EcranResultat resultat={resultat} onRecommencer={recommencer} />
        ) : (
          questions[indexCourant] && (
            <>
              <IndicateurEnDirect groupeTop={resultatEnDirect.parGroupe[0] ?? null} />
              <EcranQuestion
                question={questions[indexCourant]}
                index={indexCourant}
                total={questions.length}
                onReponse={repondre}
              />
            </>
          )
        )}
      </Stack>
    </Container>
  );
}
