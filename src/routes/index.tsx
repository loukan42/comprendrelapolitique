import { Anchor, Box, Container, Stack, Table, Text, Title } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
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

function Accueil() {
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
    <Container py={80}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Comprendre la Politique</Title>
          <Text mt="md">
            Ce que les parlementaires français ont voté depuis 2017, à partir des données publiques
            de l&apos;Assemblée nationale. Les chiffres viennent des sources officielles. Ce que
            l&apos;on ne sait pas est écrit comme tel.
          </Text>
        </Box>

        <Box maw="var(--mesure-texte)">
          <Title order={2}>Où en est le site</Title>
          <Text mt="sm">
            La chaîne de données fonctionne : les trois législatures s&apos;importent, se vérifient
            et se rejouent. L&apos;interface reste à construire. Cette page dit donc l&apos;état
            réel du projet plutôt que d&apos;afficher des écrans vides ou des exemples fabriqués.
          </Text>
        </Box>

        <Box>
          <Title order={2}>Ce qui est couvert aujourd&apos;hui</Title>
          <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
            Sur {nombre.format(total.scrutins)} scrutins publics, {nombre.format(total.finaux)}{" "}
            portent sur l&apos;ensemble d&apos;un texte, soit{" "}
            {pourcent(total.finaux, total.scrutins)}. Ce sont eux qui répondent à la question
            «&nbsp;qu&apos;est-ce qui a été voté&nbsp;?&nbsp;». Les autres portent sur un amendement
            ou un article.
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

          <Text mt="lg">
            <Anchor component={Link} to="/lois">
              Parcourir les dossiers législatifs
            </Anchor>
          </Text>
        </Box>

        <Box maw="var(--mesure-texte)">
          <Title order={2}>Une limite à connaître d&apos;emblée</Title>
          <Text mt="sm">
            Un texte adopté par l&apos;article 49 alinéa 3 ne donne lieu à aucun vote. C&apos;est le
            cas de la réforme des retraites de 2023 : l&apos;Assemblée ne s&apos;est jamais
            prononcée sur son ensemble, et ce qui a été voté, ce sont deux motions de censure.
            Chercher ce qui a été voté sur les retraites sans le savoir mène donc à côté du sujet.
          </Text>
        </Box>
      </Stack>
    </Container>
  );
}
