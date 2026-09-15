import {
  Accordion,
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Card,
  Container,
  Grid,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconArrowsLeftRight, IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import {
  AnneauAccords,
  AxeQuestion,
  Marqueur,
  MatriceProximite,
  PastilleAccord,
} from "../../components/Benchmark";
import {
  accordDe,
  comparer,
  formationsDe,
  LIBELLE_ACCORD,
  libelleFormation,
  matriceProximite,
  type LigneComparaison,
  type PositionBenchmark,
} from "../../lib/benchmarkProgrammes";
import { libelleTheme } from "../../lib/themesProgrammes";
import { chargerBenchmark, LIBELLE_NATURE, type NatureProgramme } from "../../queries/programmes";

const recherche = z.object({
  a: z.string().optional(),
  b: z.string().optional(),
});

export const Route = createFileRoute("/programmes/comparer")({
  validateSearch: recherche,
  loader: () => chargerBenchmark(),
  head: () => ({ meta: [{ title: "Comparer les programmes · Politiquizz" }] }),
  component: PageComparer,
});

const LARGEUR = 1200;
const MARGES = { base: "md", sm: "xl" } as const;

function libelleNature(nature: string): string {
  return LIBELLE_NATURE[nature as NatureProgramme] ?? nature;
}

function Etiquette({ children }: { children: string }) {
  return (
    <Text tt="uppercase" fw={600} fz="xs" c="bleu.3" lts="0.06em">
      {children}
    </Text>
  );
}

/** Un grand chiffre du tableau de bord, avec ce qu'il compte. */
function Chiffre({ valeur, libelle }: { valeur: number; libelle: string }) {
  return (
    <Box>
      <Text fz="2.5rem" fw={300} lh={1} lts="-0.04em">
        {valeur}
      </Text>
      <Text size="sm" c="dimmed" mt={4}>
        {libelle}
      </Text>
    </Box>
  );
}

/**
 * La citation d'une formation, avec son document. C'est elle qui fait foi :
 * la place sur l'axe n'en est qu'une lecture.
 */
function Citation({ position, cote }: { position: PositionBenchmark | null; cote: "a" | "b" }) {
  if (!position) {
    return (
      <Text size="sm" c="dimmed" fs="italic">
        Rien de cité sur cette question dans le document retenu.
      </Text>
    );
  }
  return (
    <Box>
      <Group gap="xs" wrap="nowrap">
        <Marqueur cote={cote} />
        <Text size="xs" fw={700} tt="uppercase" lts="0.04em">
          {position.candidat ?? position.formation}
        </Text>
      </Group>
      <Text size="sm" mt={6} fs="italic">
        «&nbsp;{position.extrait}&nbsp;»
      </Text>
      <Text size="xs" c="dimmed" mt={4}>
        {position.url ? (
          <Anchor href={position.url} target="_blank" rel="noreferrer" size="xs">
            {position.titreDocument ?? "Document source"}
          </Anchor>
        ) : (
          (position.titreDocument ?? "Document source")
        )}{" "}
        · {libelleNature(position.natureDocument)}
      </Text>
    </Box>
  );
}

function Accord({ ecart }: { ecart: number | null }) {
  if (ecart === null) return null;
  const accord = accordDe(ecart);
  return (
    <Group gap={6} wrap="nowrap">
      <PastilleAccord accord={accord} />
      <Text size="xs" c="dimmed">
        {LIBELLE_ACCORD[accord]}
      </Text>
    </Group>
  );
}

/** Une question en duel : l'axe, puis les deux citations côte à côte. */
function CarteDuel({ ligne }: { ligne: LigneComparaison }) {
  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" align="flex-start" gap="sm">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts="0.06em">
          {libelleTheme(ligne.question.theme)}
        </Text>
        <Accord ecart={ligne.ecart} />
      </Group>
      <Text fw={500} mt={4}>
        {ligne.question.intitule}
      </Text>
      {ligne.question.axeMoins && (
        <Box mt="sm">
          <AxeQuestion question={ligne.question} a={ligne.a} b={ligne.b} />
        </Box>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mt="md">
        <Citation position={ligne.a} cote="a" />
        <Citation position={ligne.b} cote="b" />
      </SimpleGrid>
    </Card>
  );
}

function PageComparer() {
  const questions = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const formations = useMemo(() => formationsDe(questions), [questions]);
  const existe = (f: string | undefined) => !!f && formations.some((x) => x.formation === f);
  // Aucun duel n'est imposé à l'arrivée : proposer d'emblée deux candidats
  // se lirait comme un choix éditorial. La matrice sert de point d'entrée.
  const a = existe(search.a) ? search.a! : null;
  const b = existe(search.b) ? search.b! : null;
  const fa = formations.find((f) => f.formation === a);
  const fb = formations.find((f) => f.formation === b);

  const comparaison = useMemo(
    () => (a && b && a !== b ? comparer(questions, a, b) : null),
    [questions, a, b],
  );
  const matrice = useMemo(() => matriceProximite(questions, formations), [questions, formations]);
  const options = formations.map((f) => ({ value: f.formation, label: libelleFormation(f) }));

  const choisir = (na: string, nb: string) => {
    navigate({ search: { a: na, b: nb }, resetScroll: false });
  };

  const surAxe = comparaison?.lignes.filter((l) => l.question.axeMoins !== null) ?? [];
  const sansAxe = comparaison?.lignes.filter((l) => l.question.axeMoins === null) ?? [];
  const nomA = fa?.candidat ?? fa?.formation ?? "";
  const nomB = fb?.candidat ?? fb?.formation ?? "";

  return (
    <Container size={LARGEUR} px={MARGES} py={{ base: 32, sm: 56 }}>
      <Stack gap={56}>
        <Box>
          <Anchor component={Link} to="/programmes" size="sm" c="dimmed" underline="hover">
            <Group gap={4} wrap="nowrap">
              <IconArrowLeft size={14} />
              Tous les programmes
            </Group>
          </Anchor>
          <Title order={1} mt="md">
            Comparer les programmes
          </Title>
          <Text mt="sm" c="dimmed" maw={720}>
            Deux candidats face à face, sur {questions.length} questions, à partir de citations de
            leurs documents. Le score et les graphiques reposent sur une lecture du site : chaque
            citation est placée sur un axe entre deux pôles. La citation reste affichée à côté, pour
            qu&apos;on puisse vérifier.
          </Text>
        </Box>

        {formations.length < 2 ? (
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            Le corpus des programmes n&apos;est pas chargé dans cet environnement. Lancer{" "}
            <code>npm run data:programmes</code> puis <code>npm run data:positions-programme</code>.
          </Alert>
        ) : (
          <>
            <Card withBorder radius="md" padding="lg">
              <Grid align="flex-end" gap="md">
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Select
                    label="Premier candidat ou parti"
                    data={options}
                    value={a}
                    allowDeselect={false}
                    leftSection={<Marqueur cote="a" />}
                    placeholder="Choisir un candidat"
                    onChange={(v) =>
                      v && navigate({ search: { a: v, ...(b ? { b } : {}) }, resetScroll: false })
                    }
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 2 }}>
                  <Group justify="center">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      radius="xl"
                      aria-label="Inverser les deux candidats"
                      onClick={() => a && b && choisir(b, a)}
                    >
                      <IconArrowsLeftRight size={18} />
                    </ActionIcon>
                  </Group>
                </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 5 }}>
                  <Select
                    label="Second candidat ou parti"
                    data={options}
                    value={b}
                    allowDeselect={false}
                    leftSection={<Marqueur cote="b" />}
                    placeholder="Choisir un candidat"
                    onChange={(v) =>
                      v && navigate({ search: { ...(a ? { a } : {}), b: v }, resetScroll: false })
                    }
                  />
                </Grid.Col>
              </Grid>
            </Card>

            {!comparaison ? (
              <Text c="dimmed">
                {a && a === b
                  ? "Choisissez deux candidats différents."
                  : "Choisissez deux candidats ci-dessus, ou cliquez une case de la matrice plus bas."}
              </Text>
            ) : (
              <>
                <Box>
                  <Etiquette>Le résultat</Etiquette>
                  <Title order={2} mt="xs">
                    {nomA} et {nomB}
                  </Title>
                  <Text mt="sm" c="dimmed" maw={720}>
                    {comparaison.communes === 0
                      ? "Aucune question placée sur un axe ne réunit ces deux candidats : leurs documents ne traitent pas les mêmes sujets."
                      : `Ils se prononcent tous deux sur ${comparaison.communes} des questions placées sur un axe. Ils y défendent la même position ou une position proche sur ${comparaison.repartition.identique + comparaison.repartition.proche}, et des positions opposées sur ${comparaison.repartition.oppose}.`}
                  </Text>
                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" mt="xl">
                    <Card withBorder radius="md" padding="lg">
                      <Text fz="2.5rem" fw={300} lh={1} lts="-0.04em">
                        {comparaison.repartition.identique + comparaison.repartition.proche}
                        <Text span fz="lg" c="dimmed">
                          {" "}
                          / {comparaison.communes}
                        </Text>
                      </Text>
                      <Text size="sm" mt={4}>
                        questions où leurs positions sont identiques ou proches
                      </Text>
                      <Text size="xs" c="dimmed" mt="sm">
                        {comparaison.fragiles} de ces {comparaison.communes} classements tiennent à
                        une lecture près : un cran de plus ou de moins sur l&apos;axe les ferait
                        changer de catégorie.
                      </Text>
                    </Card>
                    <Card withBorder radius="md" padding="lg">
                      <AnneauAccords repartition={comparaison.repartition} />
                    </Card>
                    <Card withBorder radius="md" padding="lg">
                      <Stack gap="lg" justify="center" h="100%">
                        <Chiffre valeur={comparaison.communes} libelle="questions communes" />
                        <Chiffre
                          valeur={comparaison.pointsCommuns.length}
                          libelle="points d'accord"
                        />
                        <Chiffre
                          valeur={comparaison.differences.length}
                          libelle="grandes différences"
                        />
                      </Stack>
                    </Card>
                  </SimpleGrid>
                </Box>

                <SimpleGrid cols={{ base: 1, lg: 2 }} spacing={40}>
                  <Box>
                    <Etiquette>Les grands points communs</Etiquette>
                    <Title order={3} fz="xl" mt="xs" mb="md">
                      Là où ils se rejoignent
                    </Title>
                    {comparaison.pointsCommuns.length === 0 ? (
                      <Text c="dimmed" size="sm">
                        Aucune question où leurs positions sont identiques ou proches.
                      </Text>
                    ) : (
                      <Stack gap="md">
                        {comparaison.pointsCommuns.map((l) => (
                          <CarteDuel key={l.question.id} ligne={l} />
                        ))}
                      </Stack>
                    )}
                  </Box>
                  <Box>
                    <Etiquette>Les grandes différences</Etiquette>
                    <Title order={3} fz="xl" mt="xs" mb="md">
                      Là où ils s&apos;opposent
                    </Title>
                    {comparaison.differences.length === 0 ? (
                      <Text c="dimmed" size="sm">
                        Aucune question où leurs positions sont opposées.
                      </Text>
                    ) : (
                      <Stack gap="md">
                        {comparaison.differences.map((l) => (
                          <CarteDuel key={l.question.id} ligne={l} />
                        ))}
                      </Stack>
                    )}
                  </Box>
                </SimpleGrid>

                <Box>
                  <Etiquette>Question par question</Etiquette>
                  <Title order={3} fz="xl" mt="xs">
                    Chaque question sur son axe
                  </Title>
                  <Group gap="lg" mt="sm">
                    <Group gap={6}>
                      <Marqueur cote="a" />
                      <Text size="sm">{nomA}</Text>
                    </Group>
                    <Group gap={6}>
                      <Marqueur cote="b" />
                      <Text size="sm">{nomB}</Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      Points gris : les autres candidats ou partis
                    </Text>
                  </Group>
                  <Accordion variant="separated" radius="md" mt="lg" multiple>
                    {surAxe.map((l) => (
                      <Accordion.Item key={l.question.id} value={l.question.id}>
                        <Accordion.Control>
                          <Grid gap="md" align="center">
                            <Grid.Col span={{ base: 12, md: 5 }}>
                              <Text size="xs" c="dimmed" tt="uppercase" fw={600} lts="0.06em">
                                {libelleTheme(l.question.theme)}
                              </Text>
                              <Text fw={500} mt={2}>
                                {l.question.intitule}
                              </Text>
                              <Box mt={6}>
                                {l.ecart === null ? (
                                  <Text size="xs" c="dimmed">
                                    {!l.a && !l.b
                                      ? "Aucun des deux ne se prononce"
                                      : !l.a || !l.b
                                        ? "Un seul des deux se prononce"
                                        : "Hors axe pour l'un des deux"}
                                  </Text>
                                ) : (
                                  <Accord ecart={l.ecart} />
                                )}
                              </Box>
                            </Grid.Col>
                            <Grid.Col span={{ base: 12, md: 7 }}>
                              <AxeQuestion question={l.question} a={l.a} b={l.b} />
                            </Grid.Col>
                          </Grid>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
                            <Citation position={l.a} cote="a" />
                            <Citation position={l.b} cote="b" />
                          </SimpleGrid>
                        </Accordion.Panel>
                      </Accordion.Item>
                    ))}
                  </Accordion>
                </Box>

                {sansAxe.length > 0 && (
                  <Box>
                    <Etiquette>Sans axe</Etiquette>
                    <Title order={3} fz="xl" mt="xs">
                      Des réponses qui ne se rangent pas sur une échelle
                    </Title>
                    <Text size="sm" c="dimmed" mt="xs" maw={720}>
                      Sur ces questions, les réponses portent sur des leviers différents : les
                      ordonner reviendrait à inventer une hiérarchie. Elles ne comptent pas dans le
                      score.
                    </Text>
                    <Stack gap="md" mt="md">
                      {sansAxe.map((l) => (
                        <CarteDuel key={l.question.id} ligne={l} />
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}

            <Box>
              <Etiquette>Vue d&apos;ensemble</Etiquette>
              <Title order={2} mt="xs">
                Qui est proche de qui
              </Title>
              <Text mt="sm" c="dimmed" maw={720}>
                Pour chaque paire, le nombre de questions où leurs positions sont identiques ou
                proches, sur le nombre de questions où les deux se prononcent. La case n&apos;est
                colorée qu&apos;à partir de cinq questions communes ; un point signale moins de
                trois. Cliquez sur une case pour comparer la paire.
              </Text>
              <Box mt="lg">
                <MatriceProximite matrice={matrice} a={a} b={b} onChoisir={choisir} />
              </Box>
            </Box>
          </>
        )}

        <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />} maw={820}>
          Les citations sont vérifiées mot pour mot contre les documents publiés par les candidats
          et leurs partis. Leur place sur chaque axe est une lecture du site, écrite en clair et
          contestable : ces décomptes comparent des citations choisies, pas des programmes entiers,
          et ne constitue pas une recommandation. Un candidat absent d&apos;une question n&apos;a
          pas forcément d&apos;avis contraire : son document n&apos;en parle pas.{" "}
          <Anchor component={Link} to="/programmes/quiz" c="inherit">
            Les mêmes citations en quiz, sans le nom des candidats
          </Anchor>
          .
        </Alert>
      </Stack>
    </Container>
  );
}
