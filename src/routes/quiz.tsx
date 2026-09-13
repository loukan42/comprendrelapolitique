import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Group,
  Loader,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  calculerProximite,
  chargerQuestionsExpress,
  type ProximiteGroupe,
  type QuestionQuiz,
  type ReponseQuiz,
  type ReponseUtilisateur,
} from "../queries/quiz";

export const Route = createFileRoute("/quiz")({
  loader: () => chargerQuestionsExpress(),
  component: PageQuiz,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

const BOUTONS: { valeur: ReponseQuiz; libelle: string }[] = [
  { valeur: "POUR", libelle: "Pour" },
  { valeur: "CONTRE", libelle: "Contre" },
  { valeur: "ABSTENTION", libelle: "Je m'abstiens" },
  { valeur: "NSP", libelle: "Je ne sais pas / passer" },
];

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
    <Stack gap="lg" maw="var(--mesure-texte)">
      <Progress value={(index / total) * 100} size="xs" />
      <Text c="dimmed" size="sm">
        Question {index + 1} sur {total} · scrutin du{" "}
        {dateCourte.format(new Date(question.dateScrutin))}
      </Text>
      <Title order={2}>{question.dossierTitre ?? "Ce qui était soumis au vote"}</Title>
      <Text>Le vote portait sur {question.objetLibelle}</Text>
      <Group gap="sm">
        {BOUTONS.map((b) => (
          <Button
            key={b.valeur}
            variant={b.valeur === "NSP" ? "subtle" : "default"}
            onClick={() => onReponse(b.valeur)}
          >
            {b.libelle}
          </Button>
        ))}
      </Group>
    </Stack>
  );
}

function EcranResultat({ resultats }: { resultats: ProximiteGroupe[] }) {
  if (resultats.length === 0) {
    return (
      <Stack gap="md" maw="var(--mesure-texte)">
        <Title order={2}>Pas assez de réponses exploitables</Title>
        <Text c="dimmed">
          Répondez à au moins trois questions par « pour », « contre » ou « abstention » pour
          obtenir un résultat.
        </Text>
      </Stack>
    );
  }
  return (
    <Stack gap="lg" maw="var(--mesure-texte)">
      <Title order={2}>Vos réponses sont les plus proches de…</Title>
      <Table.ScrollContainer minWidth={420}>
        <Table horizontalSpacing="sm" verticalSpacing={6} withRowBorders>
          <Table.Tbody>
            {resultats.map((r) => (
              <Table.Tr key={r.organeUid}>
                <Table.Td>
                  <Anchor href={`/groupes/${r.organeUid}`}>{r.libelle ?? r.organeUid}</Anchor>
                </Table.Td>
                <Table.Td ta="right">{pourcent.format(r.proximite)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Alert variant="light" color="graphite">
        Ce résultat compare uniquement vos réponses à des votes parlementaires passés. Il ne
        constitue pas une recommandation électorale et ne tient pas compte de l&apos;ensemble des
        programmes, candidats ou enjeux futurs.
      </Alert>
    </Stack>
  );
}

function PageQuiz() {
  const questions = Route.useLoaderData();
  const [indexCourant, setIndexCourant] = useState(0);
  const [reponses, setReponses] = useState<ReponseUtilisateur[]>([]);
  const [resultats, setResultats] = useState<ProximiteGroupe[] | null>(null);
  const [enCalcul, setEnCalcul] = useState(false);

  if (questions.length === 0) {
    return (
      <Container py={80}>
        <Text c="dimmed">
          Aucun scrutin exploitable n&apos;est disponible pour construire le quiz.
        </Text>
      </Container>
    );
  }

  async function repondre(reponse: ReponseQuiz) {
    const question = questions[indexCourant];
    if (!question) return;
    const nouvelles = [...reponses, { scrutinUid: question.scrutinUid, reponse }];
    setReponses(nouvelles);
    if (indexCourant + 1 < questions.length) {
      setIndexCourant(indexCourant + 1);
      return;
    }
    setEnCalcul(true);
    const r = await calculerProximite({ data: nouvelles });
    setResultats(r);
    setEnCalcul(false);
  }

  return (
    <Container py={80}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Et vous, vous auriez voté quoi ?</Title>
          <Text mt="sm" c="dimmed">
            Cinq scrutins réels de l&apos;Assemblée nationale, choisis parmi les plus suivis.
            Répondez, puis comparez votre position à celle des groupes parlementaires.
          </Text>
          <Badge mt="xs" variant="outline" color="graphite">
            format express · 5 questions
          </Badge>
        </Box>

        {enCalcul ? (
          <Loader />
        ) : resultats ? (
          <EcranResultat resultats={resultats} />
        ) : (
          questions[indexCourant] && (
            <EcranQuestion
              question={questions[indexCourant]}
              index={indexCourant}
              total={questions.length}
              onReponse={repondre}
            />
          )
        )}
      </Stack>
    </Container>
  );
}
