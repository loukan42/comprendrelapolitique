import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  ThemeIcon,
  Title,
} from "@mantine/core";
import { IconBrain, IconNews, IconSearch } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { CarteLien } from "../components/CarteLien";
import { chargerQuestionsExpress } from "../queries/quiz";

export const Route = createFileRoute("/")({
  loader: () => chargerQuestionsExpress(),
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

const nombre = new Intl.NumberFormat("fr-FR");
const pourcent = (part: number, total: number) =>
  new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    part / total,
  );

function EntreeCard({
  icone,
  titre,
  description,
  action,
}: {
  icone: React.ReactNode;
  titre: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <Card withBorder padding="lg" radius="md" h="100%">
      <Stack gap="sm" h="100%">
        <ThemeIcon variant="light" color="graphite" size={38} radius="md">
          {icone}
        </ThemeIcon>
        <Box style={{ flexGrow: 1 }}>
          <Title order={3} fz="lg">
            {titre}
          </Title>
          <Text mt={4} c="dimmed" size="sm">
            {description}
          </Text>
        </Box>
        {action}
      </Stack>
    </Card>
  );
}

function Accueil() {
  const decisions = Route.useLoaderData();
  const total = COUVERTURE.reduce(
    (acc, l) => ({
      scrutins: acc.scrutins + l.scrutins,
      votes: acc.votes + l.votes,
      finaux: acc.finaux + l.finaux,
      rattaches: acc.rattaches + l.rattaches,
    }),
    { scrutins: 0, votes: 0, finaux: 0, rattaches: 0 },
  );

  return (
    <>
      <Box
        style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
        bg="var(--mantine-color-default-hover)"
      >
        <Container size="md" py={{ base: 40, sm: 64 }}>
          <Box maw="var(--mesure-texte)">
            <Text tt="uppercase" fw={700} fz="xs" c="dimmed" style={{ letterSpacing: "0.06em" }}>
              Données officielles de l&apos;Assemblée nationale, depuis 2017
            </Text>
            <Title order={1} mt="xs">
              Comprendre la Politique
            </Title>
            <Text mt="md" fz="lg" c="dimmed">
              Ce que les parlementaires français ont voté depuis 2017, à partir des données
              publiques de l&apos;Assemblée nationale. Les chiffres viennent des sources
              officielles. Ce que l&apos;on ne sait pas est écrit comme tel.
            </Text>
          </Box>
        </Container>
      </Box>

      <Container size="md" py={{ base: 40, sm: 56 }}>
        <Stack gap={56}>
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
            <EntreeCard
              icone={<IconSearch size={20} />}
              titre="Je veux comprendre"
              description="Chercher une loi par son titre et voir ce qui a réellement été voté."
              action={
                <Button component="a" href="/recherche" fullWidth variant="light" color="graphite">
                  Chercher une loi
                </Button>
              }
            />
            <EntreeCard
              icone={<IconBrain size={20} />}
              titre="Je veux me tester"
              description="Répondre à cinq vrais scrutins et voir de quel groupe vos positions se rapprochent."
              action={
                <Button component="a" href="/quiz" fullWidth variant="light" color="graphite">
                  Faire le quiz
                </Button>
              }
            />
            <EntreeCard
              icone={<IconNews size={20} />}
              titre="Je veux voir ce qui se passe"
              description="La page actualité n'est pas encore construite : rien ne vaut mieux qu'une page vide plutôt qu'un contenu inventé."
              action={
                <Badge variant="outline" color="graphite" size="sm">
                  Bientôt
                </Badge>
              }
            />
          </SimpleGrid>

          {decisions.length > 0 && (
            <Box>
              <Title order={2}>Des scrutins récents</Title>
              <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
                Parmi les votes sur l&apos;ensemble d&apos;un texte, ceux qui ont réuni le plus de
                suffrages exprimés : en attendant un score d&apos;importance publique (voir{" "}
                <Anchor href="https://github.com/loukan42/comprendrelapolitique/blob/main/docs/SCORING.md">
                  la méthodologie
                </Anchor>
                ), l&apos;affluence sert de repère provisoire, pas de classement définitif.
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 2 }} mt="lg" spacing="md">
                {decisions
                  .filter((d) => d.dossierUid !== null)
                  .map((d) => (
                    <CarteLien key={d.scrutinUid} href={`/lois/${d.dossierUid}`}>
                      <Text fw={600}>{d.dossierTitre ?? d.objetLibelle}</Text>
                    </CarteLien>
                  ))}
              </SimpleGrid>
            </Box>
          )}

          <Box>
            <Title order={2}>Ce qui est couvert aujourd&apos;hui</Title>
            <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
              Sur {nombre.format(total.scrutins)} scrutins publics, {nombre.format(total.finaux)}{" "}
              portent sur l&apos;ensemble d&apos;un texte, soit{" "}
              {pourcent(total.finaux, total.scrutins)}. Ce sont eux qui répondent à la question
              «&nbsp;qu&apos;est-ce qui a été voté&nbsp;?&nbsp;». Les autres portent sur un
              amendement ou un article.
            </Text>
            <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
              Parmi ces votes sur un texte, {pourcent(total.rattaches, total.finaux)} sont reliés au
              dossier législatif correspondant. Le reste attend une méthode de rattachement fiable,
              faute de quoi le vote serait attribué à la mauvaise loi.
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
                    <Table.Th ta="right">{nombre.format(total.votes)}</Table.Th>
                    <Table.Th ta="right">
                      {nombre.format(total.finaux)}{" "}
                      <Text span c="dimmed" size="sm" fw={400}>
                        {pourcent(total.finaux, total.scrutins)}
                      </Text>
                    </Table.Th>
                    <Table.Th ta="right">
                      {nombre.format(total.rattaches)}{" "}
                      <Text span c="dimmed" size="sm" fw={400}>
                        {pourcent(total.rattaches, total.finaux)}
                      </Text>
                    </Table.Th>
                  </Table.Tr>
                </Table.Tfoot>
              </Table>
            </Table.ScrollContainer>

            <Text size="sm" c="dimmed" mt="sm">
              Source :{" "}
              <Anchor href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
                Open Data de l&apos;Assemblée nationale
              </Anchor>
              , Licence Ouverte. Mesuré le 13 septembre 2026 sur les corpus complets.
            </Text>
          </Box>

          <Card
            withBorder
            padding="lg"
            radius="md"
            style={{ borderLeft: "3px solid var(--mantine-primary-color-filled)" }}
          >
            <Title order={2} fz="lg">
              Une limite à connaître d&apos;emblée
            </Title>
            <Text mt="sm">
              Un texte adopté par l&apos;article 49 alinéa 3 ne donne lieu à aucun vote. C&apos;est
              le cas de la réforme des retraites de 2023 : l&apos;Assemblée ne s&apos;est jamais
              prononcée sur son ensemble, et ce qui a été voté, ce sont deux motions de censure.
              Chercher ce qui a été voté sur les retraites sans le savoir mène donc à côté du sujet.
            </Text>
          </Card>
        </Stack>
      </Container>
    </>
  );
}
