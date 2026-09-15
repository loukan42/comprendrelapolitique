import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Progress,
  Stack,
  Table,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconArrowRight, IconExternalLink, IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarreHorizontale } from "../../components/BarreHorizontale";
import classes from "../../components/OptionQcm.module.css";
import {
  calculerResultatQcm,
  melanger,
  MINIMUM_REPONDUES,
  type ChoixQcm,
  type OptionQcm,
  type QuestionQcm,
} from "../../lib/qcmProgrammes";
import { libelleTheme } from "../../lib/themesProgrammes";
import {
  chargerQcmProgrammes,
  LIBELLE_NATURE,
  type NatureProgramme,
} from "../../queries/programmes";

export const Route = createFileRoute("/programmes/quiz")({
  loader: () => chargerQcmProgrammes(),
  head: () => ({ meta: [{ title: "Le quiz des programmes · Comprendre la Politique" }] }),
  component: PageQcm,
});

const LETTRES = "ABCDEFGH";

function libelleNature(nature: string): string {
  return LIBELLE_NATURE[nature as NatureProgramme] ?? nature;
}

/** Qui porte une proposition : le candidat, quand le document en nomme un. */
function auteur(option: OptionQcm): string {
  return option.candidat ? `${option.candidat} (${option.formation})` : option.formation;
}

/**
 * Libellé de chaque formation pour le décompte, avec son candidat. Le
 * décompte reste fait par formation : une formation citée dans deux
 * documents ne doit pas compter deux fois.
 */
function libellesFormations(questions: QuestionQcm[]): Map<string, string> {
  const libelles = new Map<string, string>();
  for (const q of questions) {
    for (const o of q.options) {
      const connu = libelles.get(o.formation);
      if (connu === undefined || (o.candidat && connu === o.formation)) {
        libelles.set(o.formation, auteur(o));
      }
    }
  }
  return libelles;
}

/**
 * Une proposition. Avant le choix, elle ne montre que ce que la formation a
 * écrit ; après, elle dit qui l'a écrit, dans quel document et de quelle
 * nature est ce document.
 *
 * Seule la citation est affichée, dans le même style pour toutes les
 * propositions. Le résumé court (`resumeAffichage`) n'existe que pour les
 * citations longues : l'afficher en gras au-dessus de certaines propositions
 * seulement attirerait l'oeil sur elles avant toute lecture, ce qui est un
 * biais de présentation. Le comparateur, qui montre les formations côte à
 * côte et à découvert, continue de l'afficher.
 */
function Proposition({
  option,
  lettre,
  revelee,
  choisie,
  onChoisir,
}: {
  option: OptionQcm;
  lettre: string;
  revelee: boolean;
  choisie: boolean;
  onChoisir: () => void;
}) {
  const contenu = (
    <>
      <Group gap="xs" wrap="nowrap" align="baseline">
        <Text fw={700} c="dimmed" size="sm">
          {lettre}
        </Text>
        {revelee && (
          <Text fw={700} size="sm">
            {auteur(option)}
          </Text>
        )}
        {revelee && choisie && (
          <Badge variant="outline" size="sm">
            votre choix
          </Badge>
        )}
      </Group>
      <Text mt={6} fs="italic">
        «&nbsp;{option.extrait}&nbsp;»
      </Text>
      {revelee && (
        <Text size="xs" c="dimmed" mt={6}>
          {option.url ? (
            <Anchor href={option.url} target="_blank" rel="noreferrer" size="xs">
              <Group gap={4} wrap="nowrap" component="span">
                {option.titreDocument ?? "Document source"}
                <IconExternalLink size={12} />
              </Group>
            </Anchor>
          ) : (
            (option.titreDocument ?? "Document source")
          )}{" "}
          · {libelleNature(option.natureDocument)}
        </Text>
      )}
    </>
  );

  if (revelee) {
    return (
      <Box className={`${classes["option"]} ${choisie ? classes["choisie"] : ""}`}>{contenu}</Box>
    );
  }
  return (
    <UnstyledButton
      className={`${classes["option"]} ${classes["choisissable"]} ${choisie ? classes["choisie"] : ""}`}
      aria-pressed={choisie}
      onClick={onChoisir}
      aria-label={`Proposition ${lettre}`}
    >
      {contenu}
    </UnstyledButton>
  );
}

function EcranQuestion({
  question,
  index,
  total,
  choix,
  onChoisir,
  onPasser,
  onSuivante,
}: {
  question: QuestionQcm;
  index: number;
  total: number;
  /** Absent tant que l'utilisateur n'a pas choisi. */
  choix: ChoixQcm | undefined;
  onChoisir: (positionId: string | null) => void;
  onPasser: () => void;
  onSuivante: () => void;
}) {
  const repondu = choix !== undefined;
  const derniere = index + 1 === total;

  return (
    <Stack gap="lg" maw={640} mx="auto" w="100%">
      <Box>
        <Progress value={(index / total) * 100} size={6} radius="xl" />
        <Text c="dimmed" size="sm" mt="xs">
          Question {index + 1} sur {total} · {libelleTheme(question.theme)}
        </Text>
      </Box>

      <Title order={2} fz="xl">
        {question.intitule}
      </Title>

      {question.contexte && (
        <Text size="sm">
          {question.contexte}{" "}
          {question.sourceContexte && (
            <Anchor href={question.sourceContexte} target="_blank" rel="noreferrer" size="sm">
              Source
            </Anchor>
          )}
        </Text>
      )}

      <Text size="sm" c="dimmed">
        Choisissez la proposition la plus proche de votre avis. Les auteurs ne sont révélés
        qu&apos;à la fin du quiz.
      </Text>

      <Stack gap="sm">
        {question.options.map((o, i) => (
          <Proposition
            key={o.positionId}
            option={o}
            lettre={LETTRES[i] ?? String(i + 1)}
            revelee={false}
            choisie={choix?.positionId === o.positionId}
            onChoisir={() => onChoisir(o.positionId)}
          />
        ))}
      </Stack>

      <Group gap="sm">
        <Button
          onClick={onSuivante}
          disabled={!repondu}
          rightSection={<IconArrowRight size={16} />}
        >
          {derniere ? "Voir le résultat" : "Question suivante"}
        </Button>
        <Button
          variant={choix?.positionId === null ? "light" : "default"}
          onClick={() => onChoisir(null)}
        >
          Aucune de ces propositions
        </Button>
        {!repondu && (
          <Button variant="subtle" color="graphite" onClick={onPasser}>
            Passer
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function EcranResultat({
  questions,
  choix,
  onRecommencer,
}: {
  questions: QuestionQcm[];
  choix: ChoixQcm[];
  onRecommencer: () => void;
}) {
  const resultat = useMemo(() => calculerResultatQcm(questions, choix), [questions, choix]);
  const libelles = useMemo(() => libellesFormations(questions), [questions]);

  if (resultat.repondues < MINIMUM_REPONDUES) {
    return (
      <Card withBorder radius="md" padding="xl" maw={640} mx="auto">
        <Stack gap="md">
          <Title order={2} fz="xl">
            Pas assez de réponses pour un résultat
          </Title>
          <Text c="dimmed">
            Répondez à au moins {MINIMUM_REPONDUES} questions, en choisissant une proposition ou
            aucune, pour obtenir un décompte.
          </Text>
          <Button variant="default" onClick={onRecommencer} w="fit-content">
            Recommencer
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap={40} maw={640} mx="auto" w="100%">
      <Stack gap="md">
        <Title order={2}>Les formations dont vous avez choisi les propositions</Title>
        <Text c="dimmed" size="sm">
          Pour chaque formation : le nombre de questions où vous avez choisi sa proposition, sur le
          nombre de questions où elle figurait parmi les choix. Les questions passées ne comptent
          pas.
        </Text>
        <Stack gap="sm">
          {resultat.lignes.map((l) => (
            <BarreHorizontale
              key={l.formation}
              libelle={libelles.get(l.formation) ?? l.formation}
              valeur={l.part}
              reference={1}
              libelleValeur={`${l.choisie} sur ${l.proposee}`}
            />
          ))}
        </Stack>
        {resultat.aucune > 0 && (
          <Text size="sm">
            À {resultat.aucune} question{resultat.aucune > 1 ? "s" : ""} sur {resultat.repondues},
            vous n&apos;avez retenu aucune des propositions.
          </Text>
        )}
        <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
          Ce décompte porte sur quelques citations retenues par le site dans des documents de nature
          différente : programmes de campagne 2027, programme présidentiel de 2022, propositions et
          projets de parti. Il ne mesure pas votre proximité avec une formation et ne constitue pas
          une recommandation électorale : un autre choix de citations pourrait donner un autre
          résultat.{" "}
          <Anchor component={Link} to="/programmes/comparer" c="inherit">
            Lire les propositions côte à côte
          </Anchor>
          .
        </Alert>
      </Stack>

      <Stack gap="md">
        <Title order={2}>Les propositions et leurs auteurs</Title>
        <Text c="dimmed" size="sm">
          Pour chaque question, toutes les propositions, avec le candidat ou la formation qui la
          porte, le document dont elle est tirée et sa nature.
        </Text>
        <Accordion variant="separated" radius="md" multiple>
          {questions.map((q) => {
            const c = choix.find((x) => x.questionId === q.id);
            const retenue = c?.positionId
              ? q.options.find((o) => o.positionId === c.positionId)
              : undefined;
            return (
              <Accordion.Item key={q.id} value={q.id}>
                <Accordion.Control>
                  <Text fw={600}>{q.intitule}</Text>
                  <Text size="sm" c="dimmed" mt={2}>
                    {!c
                      ? "Question passée"
                      : !retenue
                        ? "Aucune proposition retenue"
                        : `Votre choix : ${auteur(retenue)}`}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="sm">
                    {q.options.map((o, i) => (
                      <Proposition
                        key={o.positionId}
                        option={o}
                        lettre={LETTRES[i] ?? String(i + 1)}
                        revelee
                        choisie={c?.positionId === o.positionId}
                        onChoisir={() => undefined}
                      />
                    ))}
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            );
          })}
        </Accordion>
      </Stack>

      <Couverture questions={questions} />

      <Group gap="md">
        <Button variant="default" onClick={onRecommencer}>
          Refaire le quiz
        </Button>
        <Anchor component={Link} to="/programmes" size="sm">
          Les documents des partis
        </Anchor>
      </Group>
    </Stack>
  );
}

/**
 * Présence de chaque formation dans le quiz, affichée avec le résultat : une
 * formation absente de la moitié des questions n'a pas les mêmes chances
 * d'être choisie, et le lecteur doit le savoir en lisant son décompte. Elle
 * n'est pas montrée avant de commencer, pour que les noms n'apparaissent
 * qu'à la fin.
 */
function Couverture({ questions }: { questions: QuestionQcm[] }) {
  const libelles = libellesFormations(questions);
  const presence = new Map<string, number>();
  for (const q of questions) {
    for (const f of new Set(q.options.map((o) => o.formation))) {
      presence.set(f, (presence.get(f) ?? 0) + 1);
    }
  }
  const lignes = [...presence.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"),
  );
  return (
    <Box>
      <Text fw={600} size="sm" mb="xs">
        Formations présentes
      </Text>
      <Table.ScrollContainer minWidth={280}>
        <Table verticalSpacing={4} withRowBorders={false}>
          <Table.Tbody>
            {lignes.map(([formation, n]) => (
              <Table.Tr key={formation}>
                <Table.Td>
                  <Text size="sm">{libelles.get(formation) ?? formation}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {n} question{n > 1 ? "s" : ""} sur {questions.length}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Box>
  );
}

function PageQcm() {
  const questions = Route.useLoaderData();
  // Les options sont mélangées au lancement de la partie, dans le
  // navigateur : mélanger au rendu serveur produirait un ordre différent de
  // celui du client, et chaque partie doit avoir le sien.
  const [partie, setPartie] = useState<QuestionQcm[] | null>(null);
  const [index, setIndex] = useState(0);
  const [choix, setChoix] = useState<ChoixQcm[]>([]);
  const [termine, setTermine] = useState(false);

  function commencer() {
    setPartie(questions.map((q) => ({ ...q, options: melanger(q.options) })));
    setIndex(0);
    setChoix([]);
    setTermine(false);
  }

  const question = partie?.[index];
  const choixCourant = question ? choix.find((c) => c.questionId === question.id) : undefined;

  function choisir(positionId: string | null) {
    if (!question) return;
    // Le choix reste dans l'état de la page : il n'est ni envoyé ni conservé.
    // Tant que la question est affichée, il peut être changé.
    setChoix([
      ...choix.filter((c) => c.questionId !== question.id),
      { questionId: question.id, positionId },
    ]);
  }

  function avancer() {
    if (!partie) return;
    if (index + 1 < partie.length) setIndex(index + 1);
    else setTermine(true);
    window.scrollTo({ top: 0 });
  }

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Anchor
          component={Link}
          to="/programmes"
          size="sm"
          c="dimmed"
          underline="hover"
          w="fit-content"
        >
          Les programmes
        </Anchor>

        <Box maw="var(--mesure-texte)">
          <Title order={1}>Le quiz des programmes</Title>
          {!partie && (
            <Text mt="sm" c="dimmed">
              {questions.length} questions. Pour chacune, des propositions tirées des documents
              publiés par les candidats et leurs partis, citées mot pour mot et présentées sans le
              nom de leur auteur. Vous choisissez celle qui se rapproche le plus de votre avis, ou
              aucune ; les auteurs ne sont révélés qu&apos;à la fin du quiz.
            </Text>
          )}
        </Box>

        {questions.length === 0 ? (
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            Le quiz n&apos;est pas chargé dans cet environnement. Lancer{" "}
            <code>npm run data:programmes</code> puis <code>npm run data:positions-programme</code>.
          </Alert>
        ) : !partie ? (
          <Stack gap="lg" maw="var(--mesure-texte)">
            <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
              Quand un candidat a publié son programme de campagne pour 2027, c&apos;est lui qui est
              cité. Sinon, la citation vient du document le plus récent de sa formation : programme
              présidentiel de 2022, programme des législatives de 2024, propositions du parti ou
              tribune du candidat. La nature de chaque document s&apos;affiche avec le résultat.
              Toutes les formations ne figurent pas dans toutes les questions : le quiz s&apos;en
              tient à ce que chaque document dit, et ne comble pas les absences.
            </Alert>
            <Text size="sm" c="dimmed">
              Vos choix restent dans votre navigateur. Ils ne sont ni envoyés au site, ni conservés.
            </Text>
            <Button onClick={commencer} w="fit-content">
              Commencer
            </Button>
          </Stack>
        ) : termine ? (
          <EcranResultat questions={partie} choix={choix} onRecommencer={commencer} />
        ) : (
          question && (
            <EcranQuestion
              question={question}
              index={index}
              total={partie.length}
              choix={choixCourant}
              onChoisir={choisir}
              onPasser={avancer}
              onSuivante={avancer}
            />
          )
        )}
      </Stack>
    </Container>
  );
}
