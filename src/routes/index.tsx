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
  ThemeIcon,
  Title,
} from "@mantine/core";
import {
  IconArrowRight,
  IconBuildingBank,
  IconChartDonut,
  IconCircleCheck,
  IconScale,
} from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import accueil from "../components/Accueil.module.css";
import { Hemicycle } from "../components/Hemicycle";
import { NuageScrutins } from "../components/NuageScrutins";
import { useNuageScrutins } from "../components/useNuageScrutins";
import { chargerDernierVote } from "../queries/lois";

export const Route = createFileRoute("/")({
  loader: async () => ({ dernierVote: await chargerDernierVote() }),
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

/** Les grands sujets, chacun vers sa page thème. */
const SUJETS = [
  { slug: "pouvoir_achat", titre: "Pouvoir d'achat", detail: "Inflation, SMIC…" },
  { slug: "sante", titre: "Santé", detail: "Hôpital, soins, médicaments…" },
  { slug: "securite", titre: "Sécurité", detail: "Police, gendarmerie, délinquance…" },
  { slug: "education", titre: "Éducation", detail: "École, enseignants, universités…" },
  { slug: "immigration", titre: "Immigration", detail: "Étrangers, asile, expulsions…" },
  { slug: "energie", titre: "Énergie", detail: "Nucléaire, électricité, renouvelables…" },
  { slug: "travail", titre: "Travail", detail: "Emploi, chômage, salariés…" },
  { slug: "entreprises", titre: "Entreprises", detail: "PME, industrie, commerce…" },
] as const;

const LARGEUR = 1200;
const MARGES = { base: "md", sm: "xl" } as const;

const nombre = new Intl.NumberFormat("fr-FR");
const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

function formaterJour(jour: string): string {
  return dateLongue.format(new Date(`${jour}T12:00:00`)).replace(/^1 /, "1er ");
}
const pourcent = (part: number, total: number) =>
  new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    part / total,
  );

/** Petite étiquette en capitales au-dessus d'un titre, reprise de la référence. */
function Etiquette({ children }: { children: ReactNode }) {
  return (
    <Text tt="uppercase" fw={600} fz="xs" c="bleu.3" lts="0.06em">
      {children}
    </Text>
  );
}

/**
 * Une carte de fonctionnalité : une icône, une étiquette, un titre, un texte
 * et un seul bouton, poussé en bas pour que les boutons d'une rangée
 * s'alignent quelle que soit la longueur du texte.
 */
function CarteFonction({
  icone,
  etiquette,
  titre,
  children,
  label,
  href,
  action,
}: {
  icone: ReactNode;
  etiquette: string;
  titre: string;
  children: ReactNode;
  label?: string;
  href: string;
  action: string;
}) {
  return (
    <Card withBorder padding="lg" radius="md" h="100%">
      <Stack gap="sm" h="100%">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color="bleu" size="lg" radius="xl">
            {icone}
          </ThemeIcon>
          <Etiquette>{etiquette}</Etiquette>
        </Group>
        <Title order={3} fz="xl">
          {titre}
        </Title>
        <Box c="dimmed" fz="sm" flex={1}>
          {children}
        </Box>
        {label && (
          <Text size="xs" c="bleu.3" fw={600}>
            {label}
          </Text>
        )}
        <Button
          component="a"
          href={href}
          w="fit-content"
          rightSection={<IconArrowRight size={16} />}
        >
          {action}
        </Button>
      </Stack>
    </Card>
  );
}

function Accueil() {
  const { dernierVote } = Route.useLoaderData();
  const nuage = useNuageScrutins();

  return (
    <>
      {/* L'accroche, posée sur l'hémicycle des scrutins en fond. */}
      <Box component="section" className={accueil["hero"]}>
        <NuageScrutins donnees={nuage} className={accueil["nuage"]} />
        <Container size={LARGEUR} px={MARGES} className={accueil["contenu"]}>
          <Title
            order={1}
            fz="clamp(2.25rem, 1rem + 6.4vw, 7rem)"
            lh={1.02}
            maw={{ base: "100%", md: 720 }}
          >
            La politique, enfin compréhensible.
          </Title>
          <Box mt={{ base: 28, sm: 44 }} maw={500}>
            <Text>
              Votes, lois, programmes, promesses : Politiquizz transforme les données politiques
              officielles en expériences simples et accessibles.
            </Text>
            <Text mt="sm" c="dimmed">
              Découvrez qui vote comme vous, comparez les candidats et comprenez les décisions qui
              façonnent la France.
            </Text>
            <Group mt="xl" gap="lg" align="center">
              <Button component="a" href="#vos-idees" size="md">
                Découvrir qui me correspond
              </Button>
              <Anchor href="/lois" size="sm" fw={600} tt="uppercase" lts="0.04em">
                Explorer les données
              </Anchor>
            </Group>
            <Text mt="xl" size="xs" c="dimmed" tt="uppercase" fw={600} lts="0.06em">
              Données officielles · Sources citées · Méthode transparente
            </Text>
          </Box>
        </Container>
      </Box>

      <Container size={LARGEUR} px={MARGES} pb={{ base: 64, sm: 112 }}>
        <Stack gap={96}>
          {/* Ce qui distingue le site : les idées d'abord, les partis ensuite. */}
          <Box id="vos-idees" className={accueil["ancre"]}>
            <Grid gap={{ base: 32, md: 64 }} align="center">
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Etiquette>Comment ça marche</Etiquette>
                <Title order={2} mt="xs">
                  Ne choisissez pas d&apos;abord le parti. Choisissez d&apos;abord vos idées.
                </Title>
                <Text mt="md" c="dimmed" maw={520}>
                  Répondez à des questions simples, sans connaître la position des partis. Le quiz
                  des votes compare vos réponses à de vrais votes de l&apos;Assemblée ; le quiz des
                  programmes, à des propositions citées dans les programmes.
                </Text>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Card withBorder radius="md" padding="xl">
                  <Etiquette>Exemple · Quizz Assemblée nationale</Etiquette>
                  <Text fz="lg" fw={500} mt="sm">
                    Une personne majeure atteinte d&apos;une maladie grave et incurable, en phase
                    avancée ou terminale, et qui en souffre, doit-elle pouvoir demander une aide à
                    mourir ?
                  </Text>
                  <Text size="sm" c="dimmed" mt="md">
                    Cinq réponses possibles, de «&nbsp;Tout à fait d&apos;accord&nbsp;» à «&nbsp;Pas
                    du tout d&apos;accord&nbsp;», ou «&nbsp;Je ne sais pas&nbsp;».
                  </Text>
                  <Text size="sm" c="dimmed" mt="lg">
                    Aperçu d&apos;une question du quizz. Vous répondez d&apos;abord, puis nous vous
                    montrons comment les différents groupes politiques ont réellement voté, lors des
                    scrutins de juin et juillet 2026 sur la fin de vie.
                  </Text>
                </Card>
              </Grid.Col>
            </Grid>

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mt={48}>
              <Card withBorder radius="md" padding="xl" className={accueil["choix"]}>
                <Etiquette>Quizz Assemblée nationale</Etiquette>
                <Title order={3} fz="clamp(1.5rem, 1.2rem + 1vw, 2rem)" mt="xs" flex={1}>
                  Quelles formations politiques votent comme vous ?
                </Title>
                <Button
                  component="a"
                  href="/quiz"
                  mt="xl"
                  w="fit-content"
                  rightSection={<IconArrowRight size={16} />}
                >
                  Faire le quizz Assemblée nationale
                </Button>
              </Card>
              <Card withBorder radius="md" padding="xl" className={accueil["choix"]}>
                <Etiquette>Quizz Programme présidentiel 2027</Etiquette>
                <Title order={3} fz="clamp(1.5rem, 1.2rem + 1vw, 2rem)" mt="xs" flex={1}>
                  Quels candidats proposent les idées les plus proches des vôtres ?
                </Title>
                <Button
                  component="a"
                  href="/programmes/quiz"
                  mt="xl"
                  w="fit-content"
                  rightSection={<IconArrowRight size={16} />}
                >
                  Faire le quizz Programme présidentiel 2027
                </Button>
              </Card>
            </SimpleGrid>
          </Box>

          {/* À quoi sert le site, en langage courant. */}
          <Grid gap={{ base: 24, md: 64 }}>
            <Grid.Col span={{ base: 12, md: 5 }}>
              <Etiquette>Pourquoi Politiquizz</Etiquette>
              <Title order={2} mt="xs">
                Des milliers de données politiques. Enfin faciles à comprendre.
              </Title>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Text>
                Depuis 2017, l&apos;Assemblée nationale publie des milliers de scrutins, de votes et
                de textes de loi. Politiquizz rassemble ces données, les relie entre elles et les
                vulgarise pour répondre simplement à des questions comme :
              </Text>
              <ul className={accueil["questions"]}>
                <li>Qui vote réellement comme moi ?</li>
                <li>Quels candidats défendent les idées qui me correspondent ?</li>
                <li>Qui a voté quoi sur la sécurité, l&apos;écologie ou l&apos;immigration ?</li>
                <li>Quelles promesses d&apos;Emmanuel Macron ont été réalisées ?</li>
                <li>Quelles sont les décisions politiques importantes du moment ?</li>
              </ul>
              <Text c="dimmed">Pas besoin d&apos;être expert en politique pour comprendre.</Text>
            </Grid.Col>
          </Grid>

          {/* Les fonctionnalités. */}
          <Box>
            <Etiquette>Les outils</Etiquette>
            <Title order={2} mt="xs">
              Explorez la politique autrement
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg" mt="xl">
              <CarteFonction
                icone={<IconScale size={18} />}
                etiquette="Comparer"
                titre="Comparez les candidats"
                href="/programmes/comparer"
                action="Comparer"
              >
                Choisissez deux candidats et comparez simplement leurs positions : économie, santé,
                sécurité, éducation, immigration, écologie, retraites…
              </CarteFonction>
              <CarteFonction
                icone={<IconBuildingBank size={18} />}
                etiquette="Assemblée nationale"
                titre="Qui vote quoi ?"
                href="/actualite"
                action="Voir les derniers votes"
              >
                Suivez les derniers textes déposés, votés et promulgués à l&apos;Assemblée
                nationale. Sur la page de chaque loi&nbsp;: ce qui a été voté et la position de
                chaque groupe politique.
              </CarteFonction>
              <CarteFonction
                icone={<IconChartDonut size={18} />}
                etiquette="Lois et formations"
                titre="Qui a proposé les lois adoptées ?"
                href="/lois/historique"
                action="Voir l’historique des lois"
              >
                Une vue sur vingt ans des dossiers de loi, avec la formation du déposant, les
                adoptions identifiées et leur répartition dans un graphique.
              </CarteFonction>
              <CarteFonction
                icone={<IconCircleCheck size={18} />}
                etiquette="Bilans"
                titre="Les promesses face aux faits"
                href="/bilans"
                action="Voir les bilans"
              >
                Qu&apos;avait promis Emmanuel Macron ? Qu&apos;est-ce qui a été réalisé,
                partiellement réalisé, abandonné ou reste difficile à évaluer ? Les engagements des
                quinquennats 2017-2022 et 2022-2027, avec leurs sources.
              </CarteFonction>
            </SimpleGrid>
          </Box>

          {/* Les grands sujets, vers les pages thèmes. */}
          <Box>
            <Grid gap={{ base: 16, md: 64 }} align="flex-end">
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Etiquette>Les thèmes</Etiquette>
                <Title order={2} mt="xs">
                  Comprendre les grands sujets de société
                </Title>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Text c="dimmed">
                  Un sujet vous intéresse ? Commencez ici. Pour chaque sujet, les textes votés à
                  l&apos;Assemblée depuis 2017 et le résultat de chaque vote.
                </Text>
              </Grid.Col>
            </Grid>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md" mt="xl">
              {SUJETS.map((s) => (
                <a key={s.slug} href={`/themes/${s.slug}`} className={accueil["sujet"]}>
                  <Text fw={500} fz="lg">
                    {s.titre}
                  </Text>
                  <Text size="sm" c="dimmed" mt={4}>
                    {s.detail}
                  </Text>
                  <IconArrowRight size={18} className={accueil["flecheSujet"]} />
                </a>
              ))}
            </SimpleGrid>
            <Button
              component="a"
              href="/themes"
              variant="default"
              mt="xl"
              rightSection={<IconArrowRight size={16} />}
            >
              Explorer tous les thèmes
            </Button>
          </Box>

          {/* Le dernier grand vote, député par député. */}
          {dernierVote && (
            <Grid gap={{ base: 24, md: 64 }} align="center">
              <Grid.Col span={{ base: 12, md: 5 }}>
                <Etiquette>Le dernier vote sur une loi à l&apos;Assemblée</Etiquette>
                <Title order={2} mt="xs">
                  {dernierVote.titre ?? "Le dernier texte voté"}
                </Title>
                <Text mt="md">
                  {nombre.format(dernierVote.pour)} députés ont voté pour ·{" "}
                  {nombre.format(dernierVote.contre)} contre ·{" "}
                  {nombre.format(dernierVote.abstention)}{" "}
                  {dernierVote.abstention > 1 ? "se sont abstenus" : "s'est abstenu"}
                </Text>
                <Text size="sm" c="dimmed" mt="xs">
                  Vote sur l&apos;ensemble du texte le {formaterJour(dernierVote.date)}
                  {dernierVote.sortLibelle ? ` : ${dernierVote.sortLibelle}` : ""}.{" "}
                  {dernierVote.nonVotants > 0
                    ? `${nombre.format(dernierVote.nonVotants)} non-votant${dernierVote.nonVotants > 1 ? "s" : ""}. `
                    : ""}
                  Source : scrutin public n° {dernierVote.numero} de l&apos;Assemblée nationale.
                </Text>
                <Button
                  component="a"
                  href={`/lois/${dernierVote.dossierUid}`}
                  mt="xl"
                  rightSection={<IconArrowRight size={16} />}
                >
                  Comprendre ce qui a été voté
                </Button>
              </Grid.Col>
              <Grid.Col span={{ base: 12, md: 7 }}>
                <Hemicycle sieges={dernierVote.sieges} />
              </Grid.Col>
            </Grid>
          )}

          {/* La confiance : d'où viennent les chiffres. */}
          <Box>
            <Etiquette>Nos données</Etiquette>
            <Title order={2} mt="xs" maw={760}>
              Ici, les opinions s&apos;arrêtent là où commencent les données.
            </Title>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" mt="xl">
              <Box>
                <Text fz="clamp(2.5rem, 2rem + 2vw, 4rem)" fw={300} lh={1} lts="-0.04em">
                  {nombre.format(TOTAL.scrutins)}
                </Text>
                <Text c="dimmed" mt="xs">
                  scrutins publics depuis 2017
                </Text>
              </Box>
              <Box>
                <Text fz="clamp(2.5rem, 2rem + 2vw, 4rem)" fw={300} lh={1} lts="-0.04em">
                  +{nombre.format(Math.floor(TOTAL.votes / 100000) / 10)} millions
                </Text>
                <Text c="dimmed" mt="xs">
                  de votes individuels de députés analysés
                </Text>
              </Box>
              <Box>
                <Text fz="clamp(2.5rem, 2rem + 2vw, 4rem)" fw={300} lh={1} lts="-0.04em">
                  {nombre.format(TOTAL.finaux)}
                </Text>
                <Text c="dimmed" mt="xs">
                  votes sur l&apos;ensemble d&apos;une loi
                </Text>
              </Box>
            </SimpleGrid>
            <Text mt="xl" maw={640}>
              Les informations présentées par Politiquizz proviennent de sources publiques et sont
              reliées à leur source originale. Quand une information n&apos;est pas connue ou
              vérifiable, nous le disons.
            </Text>
            <Anchor href="/methodologie" size="sm" mt="sm" display="block">
              Découvrir notre méthodologie
            </Anchor>

            <Accordion variant="separated" radius="md" mt="xl">
              <Accordion.Item value="couverture">
                <Accordion.Control>
                  Le détail des données, législature par législature
                </Accordion.Control>
                <Accordion.Panel>
                  <Stack gap="xl">
                    <Box>
                      <Text c="dimmed" maw="var(--mesure-texte)">
                        Sur {nombre.format(TOTAL.scrutins)} scrutins publics,{" "}
                        {nombre.format(TOTAL.finaux)} portent sur l&apos;ensemble d&apos;un texte,
                        soit {pourcent(TOTAL.finaux, TOTAL.scrutins)}. Ce sont eux qui répondent à
                        la question «&nbsp;qu&apos;est-ce qui a été voté&nbsp;?&nbsp;». Les autres
                        portent sur un amendement ou un article. Parmi ces votes sur un texte,{" "}
                        {pourcent(TOTAL.rattaches, TOTAL.finaux)} sont reliés au dossier législatif
                        correspondant.
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
                                <Table.Td ta="right">{nombre.format(l.finaux)}</Table.Td>
                                <Table.Td ta="right">{nombre.format(l.rattaches)}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
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
                        Quand le Gouvernement engage sa responsabilité sur un texte (article 49
                        alinéa 3), l&apos;Assemblée ne vote pas sur ce texte lors de la lecture
                        concernée : il est considéré comme adopté si aucune motion de censure
                        n&apos;est votée. C&apos;est le cas de la réforme des retraites de 2023 :
                        l&apos;Assemblée ne s&apos;est jamais prononcée sur son ensemble. Après le
                        recours au 49.3 le 16 mars 2023, les seuls scrutins de l&apos;Assemblée sur
                        ce texte sont les deux motions de censure du 20 mars, rejetées (278 et 94
                        voix pour 287 requises).
                      </Text>
                    </Box>
                  </Stack>
                </Accordion.Panel>
              </Accordion.Item>
            </Accordion>
          </Box>
        </Stack>
      </Container>
    </>
  );
}
