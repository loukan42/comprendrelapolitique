import {
  Accordion,
  Anchor,
  Box,
  Button,
  Card,
  Container,
  Grid,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { CarteLien } from "../components/CarteLien";
import accueil from "../components/Accueil.module.css";
import { Hemicycle } from "../components/Hemicycle";
import { LegendeNuage, NuageScrutins } from "../components/NuageScrutins";
import { useNuageScrutins } from "../components/useNuageScrutins";
import { chargerDernierVote, chargerScrutinsRecents } from "../queries/lois";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [decisions, dernierVote] = await Promise.all([
      chargerScrutinsRecents(),
      chargerDernierVote(),
    ]);
    return { decisions, dernierVote };
  },
  component: Accueil,
});

/**
 * Chiffres mesurés sur les jeux Open Data de l'Assemblée nationale, corpus
 * complet et sans échantillonnage. Reproductibles par `npm run data:controler`.
 * Aucun n'est décoratif : ils disent la couverture réelle du site.
 *
 * `finaux` : votes portant sur l'ensemble d'un texte.
 * `rattaches` : ceux d'entre eux reliés au dossier législatif correspondant.
 */
const COUVERTURE = [
  {
    legislature: "XVe",
    periode: "2017 à 2022",
    scrutins: 4417,
    votes: 472631,
    finaux: 376,
    rattaches: 351,
  },
  {
    legislature: "XVIe",
    periode: "2022 à 2024",
    scrutins: 4106,
    votes: 602911,
    finaux: 209,
    rattaches: 201,
  },
  {
    legislature: "XVIIe",
    periode: "depuis 2024",
    scrutins: 8434,
    votes: 1270476,
    finaux: 214,
    rattaches: 209,
  },
];

const TOTAL = COUVERTURE.reduce(
  (acc, l) => ({
    scrutins: acc.scrutins + l.scrutins,
    votes: acc.votes + l.votes,
    finaux: acc.finaux + l.finaux,
    rattaches: acc.rattaches + l.rattaches,
  }),
  { scrutins: 0, votes: 0, finaux: 0, rattaches: 0 },
);

/** Largeur de la page d'accueil : 1 200 px de contenu, comme la référence. */
const LARGEUR = 1200;
const MARGES = { base: "md", sm: "xl" } as const;

const nombre = new Intl.NumberFormat("fr-FR");
const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const pourcent = (part: number, total: number) =>
  new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    part / total,
  );

function formaterJour(jour: string): string {
  return dateLongue.format(new Date(`${jour}T12:00:00`)).replace(/^1 /, "1er ");
}

/** Petite étiquette en capitales au-dessus d'un texte, reprise de la référence. */
function Etiquette({ children }: { children: string }) {
  return (
    <Text tt="uppercase" fw={600} fz="xs" c="bleu.3" lts="0.06em">
      {children}
    </Text>
  );
}

/**
 * Une porte d'entrée de l'accueil : une étiquette, un titre, une phrase et un
 * seul bouton. Le bouton est poussé en bas de la carte, pour que tous les
 * boutons d'une rangée s'alignent quelle que soit la longueur du texte. Pas
 * d'icône dans un carré arrondi : AGENTS.md section 2 la bannit.
 */
function EntreeCard({
  etiquette,
  titre,
  description,
  href,
  action,
}: {
  etiquette: string;
  titre: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <Card withBorder padding="lg" radius="md" h="100%">
      <Stack gap="xs" h="100%">
        <Etiquette>{etiquette}</Etiquette>
        <Title order={3} fz="xl">
          {titre}
        </Title>
        <Text c="dimmed" size="sm" flex={1}>
          {description}
        </Text>
        <Button component="a" href={href} variant="filled" mt="sm" w="fit-content">
          {action}
        </Button>
      </Stack>
    </Card>
  );
}

function Accueil() {
  const { decisions, dernierVote } = Route.useLoaderData();
  const nuage = useNuageScrutins();

  return (
    <>
      {/* L'accroche : un très grand titre posé sur le nuage des scrutins, où
          chaque triangle est un vote réel de l'Assemblée depuis 2017. */}
      <Box component="section" className={accueil["hero"]}>
        <NuageScrutins donnees={nuage} className={accueil["nuage"]} />
        <Container size={LARGEUR} px={MARGES} className={accueil["contenu"]}>
          <Title
            order={1}
            fz="clamp(2.75rem, 1rem + 6.4vw, 7rem)"
            lh={1.02}
            maw={{ base: "100%", md: 680 }}
          >
            Les votes de l&apos;Assemblée nationale, depuis 2017.
          </Title>
          <Box mt={{ base: 32, sm: 56 }} maw={440}>
            <Etiquette>Données officielles, sources citées</Etiquette>
            <Text mt="sm">
              {nombre.format(TOTAL.scrutins)} scrutins publics et {nombre.format(TOTAL.votes)} votes
              individuels de députés, chacun relié à sa source. Ce que l&apos;on ne sait pas est
              écrit comme tel.
            </Text>
            <Group mt="xl" gap="lg" align="center">
              <Button component="a" href="/quiz">
                Faire le quiz des votes
              </Button>
              <Anchor href="/lois" size="sm">
                Voir les lois
              </Anchor>
            </Group>
          </Box>
        </Container>
      </Box>

      <Container size={LARGEUR} px={MARGES} pt="md" pb={{ base: 48, sm: 80 }}>
        <Box maw={720}>
          <LegendeNuage donnees={nuage} />
        </Box>
      </Container>

      {dernierVote && (
        <Container size={LARGEUR} px={MARGES} pb={{ base: 48, sm: 96 }}>
          <Grid gap={{ base: 24, md: 64 }} align="center">
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Etiquette>Le dernier vote sur un texte</Etiquette>
              <Title order={2} mt="xs">
                {dernierVote.titre ?? dernierVote.dossierUid}
              </Title>
              <Text mt="sm" c="dimmed">
                Voté le {formaterJour(dernierVote.date)} : {nombre.format(dernierVote.pour)} pour,{" "}
                {nombre.format(dernierVote.contre)} contre, {nombre.format(dernierVote.abstention)}{" "}
                abstention{dernierVote.abstention > 1 ? "s" : ""}. Un point par député, scrutin n°{" "}
                {dernierVote.numero}.
              </Text>
              <Anchor href={`/lois/${dernierVote.dossierUid}`} size="sm" mt="md" display="block">
                Voir la loi et ce qui a été voté
              </Anchor>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Hemicycle sieges={dernierVote.sieges} />
            </Grid.Col>
          </Grid>
        </Container>
      )}

      <Container size={LARGEUR} px={MARGES} pb={{ base: 48, sm: 96 }}>
        <Stack gap={96}>
          <Box>
            <Title order={2} maw={640}>
              Les lois, les quiz et l&apos;actualité
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mt="xl">
              <EntreeCard
                etiquette="Comprendre"
                titre="Les lois depuis 2017"
                description="Retrouver un texte par son titre et voir qui l'a voté."
                href="/lois"
                action="Voir les lois"
              />
              <EntreeCard
                etiquette="Se tester"
                titre="Le quiz des votes"
                description="De vrais scrutins : votez, puis comparez-vous aux groupes."
                href="/quiz"
                action="Faire le quiz"
              />
              <EntreeCard
                etiquette="Se tester"
                titre="Le quiz des programmes"
                description="Des propositions citées mot pour mot, sans le nom du parti."
                href="/programmes/quiz"
                action="Faire le quiz"
              />
              <EntreeCard
                etiquette="Suivre"
                titre="En ce moment"
                description="Les derniers textes déposés, votés et promulgués."
                href="/actualite"
                action="Voir l'actualité"
              />
            </SimpleGrid>
          </Box>

          {decisions.length > 0 && (
            <Grid gap={{ base: 24, md: 64 }}>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Etiquette>Derniers scrutins</Etiquette>
                <Title order={2} mt="xs">
                  Les derniers votes sur un texte
                </Title>
                <Text mt="sm" c="dimmed">
                  Toutes législatures confondues, du plus récent au plus ancien.
                </Text>
                <Anchor href="/actualite" size="sm" mt="md" display="block">
                  Tout ce qui se passe en ce moment
                </Anchor>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Stack gap="sm">
                  {decisions.map((d) => (
                    <CarteLien key={d.dossierUid} href={`/lois/${d.dossierUid}`}>
                      <Group gap="xs" wrap="nowrap" align="flex-start">
                        {d.sortCode === "adopté" && (
                          <IconCircleCheck size={18} style={{ flexShrink: 0, marginTop: 3 }} />
                        )}
                        {d.sortCode === "rejeté" && (
                          <IconCircleX
                            size={18}
                            style={{ flexShrink: 0, marginTop: 3, opacity: 0.6 }}
                          />
                        )}
                        <Box>
                          <Text fw={600}>{d.titre ?? d.dossierUid}</Text>
                          <Text size="sm" c="dimmed" mt={2}>
                            {dateCourte.format(new Date(d.dateScrutin))}
                          </Text>
                        </Box>
                      </Group>
                    </CarteLien>
                  ))}
                </Stack>
              </Grid.Col>
            </Grid>
          )}

          <Accordion variant="separated" radius="md">
            <Accordion.Item value="couverture">
              <Accordion.Control>En savoir plus sur les données du site</Accordion.Control>
              <Accordion.Panel>
                <Stack gap="xl">
                  <Box>
                    <Title order={3} fz="lg">
                      Ce qui est couvert aujourd&apos;hui
                    </Title>
                    <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
                      Sur {nombre.format(TOTAL.scrutins)} scrutins publics,{" "}
                      {nombre.format(TOTAL.finaux)} portent sur l&apos;ensemble d&apos;un texte,
                      soit {pourcent(TOTAL.finaux, TOTAL.scrutins)}. Ce sont eux qui répondent à la
                      question «&nbsp;qu&apos;est-ce qui a été voté&nbsp;?&nbsp;». Les autres
                      portent sur un amendement ou un article.
                    </Text>
                    <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
                      Parmi ces votes sur un texte, {pourcent(TOTAL.rattaches, TOTAL.finaux)} sont
                      reliés au dossier législatif correspondant. Le reste attend une méthode de
                      rattachement fiable, faute de quoi le vote serait attribué à la mauvaise loi.
                    </Text>

                    <Table.ScrollContainer minWidth={640} mt="lg">
                      <Table horizontalSpacing={0} verticalSpacing="sm" withRowBorders>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Législature</Table.Th>
                            <Table.Th>Période</Table.Th>
                            <Table.Th ta="right">Scrutins</Table.Th>
                            <Table.Th ta="right">Votes individuels</Table.Th>
                            <Table.Th ta="right">Votes sur un texte</Table.Th>
                            <Table.Th ta="right">Reliés à leur loi</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {COUVERTURE.map((l) => (
                            <Table.Tr key={l.legislature}>
                              <Table.Td>{l.legislature}</Table.Td>
                              <Table.Td c="dimmed">{l.periode}</Table.Td>
                              <Table.Td ta="right">{nombre.format(l.scrutins)}</Table.Td>
                              <Table.Td ta="right">{nombre.format(l.votes)}</Table.Td>
                              <Table.Td ta="right">
                                {nombre.format(l.finaux)}{" "}
                                <Text span c="dimmed" size="sm">
                                  {pourcent(l.finaux, l.scrutins)}
                                </Text>
                              </Table.Td>
                              <Table.Td ta="right">
                                {nombre.format(l.rattaches)}{" "}
                                <Text span c="dimmed" size="sm">
                                  {pourcent(l.rattaches, l.finaux)}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                        <Table.Tfoot>
                          <Table.Tr>
                            <Table.Th colSpan={3}>Total</Table.Th>
                            <Table.Th ta="right">{nombre.format(TOTAL.votes)}</Table.Th>
                            <Table.Th ta="right">
                              {nombre.format(TOTAL.finaux)}{" "}
                              <Text span c="dimmed" size="sm" fw={400}>
                                {pourcent(TOTAL.finaux, TOTAL.scrutins)}
                              </Text>
                            </Table.Th>
                            <Table.Th ta="right">
                              {nombre.format(TOTAL.rattaches)}{" "}
                              <Text span c="dimmed" size="sm" fw={400}>
                                {pourcent(TOTAL.rattaches, TOTAL.finaux)}
                              </Text>
                            </Table.Th>
                          </Table.Tr>
                        </Table.Tfoot>
                      </Table>
                    </Table.ScrollContainer>

                    <Text size="sm" c="dimmed" mt="sm">
                      Source :{" "}
                      <Anchor
                        href="https://data.assemblee-nationale.fr/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Data de l&apos;Assemblée nationale
                      </Anchor>
                      , Licence Ouverte. Mesuré le 13 septembre 2026 sur les corpus complets.
                    </Text>
                  </Box>

                  <Box>
                    <Title order={3} fz="lg">
                      Une limite à connaître d&apos;emblée
                    </Title>
                    <Text mt="sm" maw="var(--mesure-texte)">
                      Un texte adopté par l&apos;article 49 alinéa 3 ne donne lieu à aucun vote.
                      C&apos;est le cas de la réforme des retraites de 2023 : l&apos;Assemblée ne
                      s&apos;est jamais prononcée sur son ensemble, et ce qui a été voté, ce sont
                      deux motions de censure. Chercher ce qui a été voté sur les retraites sans le
                      savoir mène donc à côté du sujet.
                    </Text>
                  </Box>
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </Stack>
      </Container>
    </>
  );
}
