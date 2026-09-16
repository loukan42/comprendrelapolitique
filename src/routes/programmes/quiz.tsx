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
import { LogoFormation, PortraitCandidat } from "../../components/PortraitCandidat";
import { alternativesQuestion, selectionnerQuestions } from "../../lib/selectionQcm";
import {
  calculerResultatQcm,
  melanger,
  MINIMUM_PROPOSEE,
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
  head: () => ({ meta: [{ title: "Le quiz des programmes · Politiquizz" }] }),
  component: PageQcm,
});

const LETTRES = "ABCDEFGH";

function libelleNature(nature: string): string {
  return LIBELLE_NATURE[nature as NatureProgramme] ?? nature;
}

/** Le quiz compare les partis, même lorsque le document cite une personnalité. */
function auteur(option: OptionQcm): string {
  return option.formation;
}

/**
 * Libellé de chaque formation pour le décompte. Le
 * décompte reste fait par formation : une formation citée dans deux
 * documents ne doit pas compter deux fois.
 */
function libellesFormations(questions: QuestionQcm[]): Map<string, string> {
  const libelles = new Map<string, string>();
  for (const q of questions) {
    for (const o of q.options) {
      const connu = libelles.get(o.formation);
      if (connu === undefined) {
        libelles.set(o.formation, auteur(o));
      }
    }
  }
  return libelles;
}

function candidatsFormations(questions: QuestionQcm[]): Map<string, string | null> {
  const candidats = new Map<string, { noms: Set<string>; manquant: boolean }>();
  for (const q of questions) {
    for (const option of q.options) {
      const connu = candidats.get(option.formation) ?? { noms: new Set<string>(), manquant: false };
      if (option.candidat) connu.noms.add(option.candidat);
      else connu.manquant = true;
      candidats.set(option.formation, connu);
    }
  }
  return new Map(
    [...candidats].map(([formation, valeur]) => [
      formation,
      !valeur.manquant && valeur.noms.size === 1 ? [...valeur.noms][0]! : null,
    ]),
  );
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
      <Group gap="sm" wrap="nowrap" align="center">
        {revelee && option.candidat && <PortraitCandidat nom={option.candidat} taille="sm" />}
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
  onRetour,
}: {
  question: QuestionQcm;
  index: number;
  total: number;
  /** Absent tant que l'utilisateur n'a pas choisi. */
  choix: ChoixQcm | undefined;
  onChoisir: (positionIds: string[] | null) => void;
  onPasser: () => void;
  onSuivante: () => void;
  onRetour: () => void;
}) {
  const repondu = choix !== undefined;
  const derniere = index + 1 === total;
  const [alternatives] = useState(() => melanger(alternativesQuestion(question)));

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
        Choisissez une ou plusieurs orientations. Les propositions proches sont regroupées, avec
        leurs nuances dans les citations. Cocher une orientation retient toutes les propositions de
        ce groupe. Les auteurs sont révélés à la fin.
      </Text>

      <Stack gap="sm">
        {alternatives.map((a) => {
          const ids = a.options.map((o) => o.positionId);
          const selectionnee = ids.every((id) => choix?.positionIds?.includes(id));
          return (
            <Box key={a.id}>
              <UnstyledButton
                className={`${classes["option"]} ${classes["choisissable"]} ${selectionnee ? classes["choisie"] : ""}`}
                aria-pressed={selectionnee}
                onClick={() =>
                  onChoisir(
                    selectionnee
                      ? (choix?.positionIds ?? []).filter((id) => !ids.includes(id))
                      : [...(choix?.positionIds ?? []), ...ids],
                  )
                }
              >
                <Text fw={600}>{a.libelle}</Text>
                <Text size="sm" c="dimmed">
                  {selectionnee ? "Sélectionnée" : "Sélectionner cette orientation"}
                </Text>
              </UnstyledButton>
              <Accordion variant="default">
                <Accordion.Item value={a.id}>
                  <Accordion.Control>Lire les formulations exactes</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      {a.options.map((o) => (
                        <Text key={o.positionId} size="sm">
                          « {o.extrait} »
                        </Text>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Box>
          );
        })}
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
          variant={choix?.positionIds === null ? "light" : "default"}
          aria-pressed={choix?.positionIds === null}
          onClick={() => onChoisir(null)}
        >
          Aucune de ces propositions
        </Button>
        {!repondu && (
          <Button variant="subtle" color="graphite" onClick={onPasser}>
            Passer
          </Button>
        )}
        {index > 0 && (
          <Button variant="default" onClick={onRetour}>
            Question précédente
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
  const candidats = useMemo(() => candidatsFormations(questions), [questions]);

  if (resultat.repondues < MINIMUM_REPONDUES) {
    return (
      <Card withBorder radius="md" padding="xl" maw={640} mx="auto">
        <Stack gap="md">
          <Title order={2} fz="xl">
            Pas assez de réponses pour un résultat
          </Title>
          <Text c="dimmed">
            Répondez à au moins {MINIMUM_REPONDUES} questions, en choisissant une ou plusieurs
            orientations, ou aucune, pour obtenir un décompte.
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
        <Title order={2}>Vos choix par formation</Title>
        <Text c="dimmed" size="sm">
          Le pourcentage indique la part des propositions de chaque formation que vous avez
          choisies, parmi les questions auxquelles vous avez répondu et où elle était présente. Les
          formations sont affichées du pourcentage le plus élevé au plus faible. Les questions
          passées ne comptent pas. Plusieurs formations peuvent recevoir un accord sur la même
          question, chacune une seule fois. Les pourcentages ne s&apos;additionnent pas.
        </Text>
        <Stack gap="sm">
          {resultat.lignes
            .filter((l) => l.proposee >= MINIMUM_PROPOSEE)
            .sort(
              (a, b) =>
                b.part - a.part ||
                b.choisie - a.choisie ||
                a.formation.localeCompare(b.formation, "fr"),
            )
            .map((l) => (
              <BarreHorizontale
                key={l.formation}
                libelle={libelles.get(l.formation) ?? l.formation}
                visuel={
                  <Group gap={4} wrap="nowrap">
                    <LogoFormation formation={l.formation} taille="sm" />
                    {candidats.get(l.formation) && (
                      <PortraitCandidat nom={candidats.get(l.formation)} taille="sm" />
                    )}
                  </Group>
                }
                valeur={l.part}
                reference={1}
                libelleValeur={`${Math.round(l.part * 100)} % · ${l.choisie} choix sur ${l.proposee}`}
              />
            ))}
        </Stack>
        {resultat.lignes.some((l) => l.proposee < MINIMUM_PROPOSEE) && (
          <Text size="sm" c="dimmed">
            Trop peu présentes pour être classées (moins de {MINIMUM_PROPOSEE} questions) :{" "}
            {resultat.lignes
              .filter((l) => l.proposee < MINIMUM_PROPOSEE)
              .map(
                (l) =>
                  `${libelles.get(l.formation) ?? l.formation}, choisie ${l.choisie} fois sur ${l.proposee}`,
              )
              .join(" ; ")}
            .
          </Text>
        )}
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
          Pour chaque question, toutes les propositions, avec le parti qui la porte, le document
          dont elle est tirée et sa nature.
        </Text>
        <Accordion variant="separated" radius="md" multiple>
          {questions.map((q) => {
            const c = choix.find((x) => x.questionId === q.id);
            const retenues = q.options.filter((o) => c?.positionIds?.includes(o.positionId));
            return (
              <Accordion.Item key={q.id} value={q.id}>
                <Accordion.Control>
                  <Text fw={600}>{q.intitule}</Text>
                  <Text size="sm" c="dimmed" mt={2}>
                    {!c
                      ? "Question passée"
                      : retenues.length === 0
                        ? "Aucune proposition retenue"
                        : `Vos choix : ${[...new Set(retenues.map(auteur))].join(", ")}`}
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
                        choisie={c?.positionIds?.includes(o.positionId) ?? false}
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
        <Button component="a" href="/quiz">
          Faire le quiz des votes
        </Button>
        <Button component="a" href="/programmes/comparer" variant="default">
          Comparer les partis
        </Button>
        <Button variant="subtle" color="gray" onClick={onRecommencer}>
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
  const corpus = Route.useLoaderData();
  const questions = useMemo(() => selectionnerQuestions(corpus), [corpus]);
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

  function choisir(positionIds: string[] | null) {
    if (!question) return;
    // Le choix reste dans l'état de la page : il n'est ni envoyé ni conservé.
    // Tant que la question est affichée, il peut être changé.
    setChoix([
      ...choix.filter((c) => c.questionId !== question.id),
      ...(positionIds?.length === 0 ? [] : [{ questionId: question.id, positionIds }]),
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
              publiés par les partis, citées mot pour mot et présentées sans le nom de leur auteur.
              Vous pouvez retenir plusieurs orientations, ou aucune. Les auteurs ne sont révélés
              qu&apos;à la fin du quiz.
            </Text>
          )}
        </Box>

        {questions.length === 0 ? (
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            Aucune question ne réunit actuellement les propositions sourcées nécessaires pour
            présenter des orientations opposées. Les documents restent consultables dans les
            programmes.
          </Alert>
        ) : !partie ? (
          <Stack gap="lg" maw="var(--mesure-texte)">
            <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
              Quand un parti a publié un programme pour 2027, il est cité. Sinon, la citation vient
              du document le plus récent de ce parti : programme présidentiel de 2022, programme des
              législatives de 2024, propositions ou tribune du parti. La nature de chaque document
              s&apos;affiche avec le résultat. Toutes les formations ne figurent pas dans toutes les
              questions : le quiz s&apos;en tient à ce que chaque document dit, et ne comble pas les
              absences.
            </Alert>
            <Text size="sm" c="dimmed">
              Le quiz retient les arbitrages documentés sur la retraite, le nucléaire et la
              fiscalité du patrimoine. Les questions qui juxtaposent des mesures compatibles sont
              écartées. Ce périmètre limité ne représente pas l&apos;ensemble d&apos;un programme.
            </Text>
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
              key={question.id}
              question={question}
              index={index}
              total={partie.length}
              choix={choixCourant}
              onChoisir={choisir}
              onPasser={avancer}
              onSuivante={avancer}
              onRetour={() => setIndex((i) => Math.max(0, i - 1))}
            />
          )
        )}
      </Stack>
    </Container>
  );
}
