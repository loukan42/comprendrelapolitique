import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
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

const BOUTONS: { valeur: ReponseQuiz; libelle: string; icone: React.ReactNode }[] = [
  { valeur: "POUR", libelle: "Pour", icone: <IconThumbUp size={22} /> },
  { valeur: "CONTRE", libelle: "Contre", icone: <IconThumbDown size={22} /> },
  { valeur: "ABSTENTION", libelle: "Je m'abstiens", icone: <IconMinus size={22} /> },
  { valeur: "NSP", libelle: "Je ne sais pas", icone: <IconHelpCircle size={22} /> },
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
    <Card withBorder radius="md" padding="xl" maw={560} mx="auto">
      <Stack gap="lg">
        <Box>
          <Progress value={(index / total) * 100} size={6} radius="xl" />
          <Text c="dimmed" size="sm" mt="xs">
            Question {index + 1} sur {total} · scrutin du{" "}
            {dateCourte.format(new Date(question.dateScrutin))}
          </Text>
        </Box>
        <Box>
          <Title order={2} fz="xl">
            {question.dossierTitre ?? "Ce qui était soumis au vote"}
          </Title>
          <Text mt="sm" c="dimmed">
            Le vote portait sur {question.objetLibelle}
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

function BarreProximite({ groupe, meilleur }: { groupe: ProximiteGroupe; meilleur: number }) {
  return (
    <Card withBorder radius="md" padding="md">
      <Stack gap={6}>
        <Box style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Anchor href={`/groupes/${groupe.organeUid}`} fw={600} underline="hover">
            {groupe.libelle ?? groupe.organeUid}
          </Anchor>
          <Text fw={700}>{pourcent.format(groupe.proximite)}</Text>
        </Box>
        <Progress
          value={(groupe.proximite / meilleur) * 100}
          size="md"
          radius="xl"
          color="graphite"
        />
      </Stack>
    </Card>
  );
}

function EcranResultat({
  resultats,
  onRecommencer,
}: {
  resultats: ProximiteGroupe[];
  onRecommencer: () => void;
}) {
  if (resultats.length === 0) {
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
  const meilleur = resultats[0]?.proximite ?? 1;
  return (
    <Stack gap="lg" maw={560} mx="auto">
      <Title order={2}>Vos réponses sont les plus proches de…</Title>
      <Stack gap="sm">
        {resultats.map((r) => (
          <BarreProximite key={r.organeUid} groupe={r} meilleur={meilleur} />
        ))}
      </Stack>
      <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
        Ce résultat compare uniquement vos réponses à des votes parlementaires passés. Il ne
        constitue pas une recommandation électorale et ne tient pas compte de l&apos;ensemble des
        programmes, candidats ou enjeux futurs.
      </Alert>
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
  const [resultats, setResultats] = useState<ProximiteGroupe[] | null>(null);
  const [enCalcul, setEnCalcul] = useState(false);

  if (questions.length === 0) {
    return (
      <Container size="md" py={80}>
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

  function recommencer() {
    setIndexCourant(0);
    setReponses([]);
    setResultats(null);
  }

  return (
    <Container size="md" py={{ base: 40, sm: 64 }}>
      <Stack gap={40}>
        <Box maw="var(--mesure-texte)" mx="auto" ta="center">
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
          <Progress value={100} size={6} radius="xl" animated maw={560} mx="auto" w="100%" />
        ) : resultats ? (
          <EcranResultat resultats={resultats} onRecommencer={recommencer} />
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
