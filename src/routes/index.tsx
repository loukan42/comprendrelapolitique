import { Anchor, Box, Container, Stack, Table, Text, Title } from "@mantine/core";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Accueil,
});

/**
 * Chiffres mesurés sur les jeux Open Data de l'Assemblée nationale, corpus
 * complet et sans échantillonnage. Reproductibles par `npm run data:controler`.
 * Aucun n'est décoratif : ils disent la couverture réelle du site.
 */
const COUVERTURE = [
  { legislature: "XVe", periode: "2017 – 2022", scrutins: 4417, votes: 472631, finaux: 376 },
  { legislature: "XVIe", periode: "2022 – 2024", scrutins: 4106, votes: 602911, finaux: 209 },
  { legislature: "XVIIe", periode: "depuis 2024", scrutins: 8434, votes: 1270476, finaux: 214 },
];

const nombre = new Intl.NumberFormat("fr-FR");

function Accueil() {
  const totalVotes = COUVERTURE.reduce((n, l) => n + l.votes, 0);
  const totalFinaux = COUVERTURE.reduce((n, l) => n + l.finaux, 0);

  return (
    <Container py={80}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Comprendre la Politique</Title>
          <Text mt="md">
            Ce que les parlementaires français ont réellement voté depuis 2017, à partir des données
            publiques de l'Assemblée nationale. Les chiffres viennent des sources officielles ; ce
            que l'on ne sait pas est écrit comme tel.
          </Text>
        </Box>

        <Box maw="var(--mesure-texte)">
          <Title order={2}>Où en est le site</Title>
          <Text mt="sm">
            La chaîne de données est en place : les trois législatures s'importent, se vérifient et
            se rejouent. L'interface, elle, reste à construire — cette page ne fait rien d'autre que
            dire l'état réel du projet, plutôt que d'afficher des pages vides ou des exemples
            fabriqués.
          </Text>
        </Box>

        <Box>
          <Title order={2}>Ce qui est couvert aujourd'hui</Title>
          <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
            Sur {nombre.format(16957)} scrutins publics, seuls {totalFinaux} portent sur l'ensemble
            d'un texte. Ce sont eux qui répondent à la question « qu'est-ce qui a été voté ? » ; les
            autres portent sur des amendements ou des articles.
          </Text>

          <Table mt="lg" horizontalSpacing={0} verticalSpacing="sm" withRowBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Législature</Table.Th>
                <Table.Th>Période</Table.Th>
                <Table.Th ta="right">Scrutins</Table.Th>
                <Table.Th ta="right">Votes individuels</Table.Th>
                <Table.Th ta="right">Votes sur un texte</Table.Th>
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
                </Table.Tr>
              ))}
            </Table.Tbody>
            <Table.Tfoot>
              <Table.Tr>
                <Table.Th colSpan={3}>Total</Table.Th>
                <Table.Th ta="right">{nombre.format(totalVotes)}</Table.Th>
                <Table.Th ta="right">{nombre.format(totalFinaux)}</Table.Th>
              </Table.Tr>
            </Table.Tfoot>
          </Table>

          <Text size="sm" c="dimmed" mt="sm">
            Source :{" "}
            <Anchor href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
              Open Data de l'Assemblée nationale
            </Anchor>
            , Licence Ouverte. Mesuré le 13 septembre 2026 sur les corpus complets.
          </Text>
        </Box>

        <Box maw="var(--mesure-texte)">
          <Title order={2}>Une limite à connaître d'emblée</Title>
          <Text mt="sm">
            Un texte adopté par l'article 49 alinéa 3 ne donne lieu à aucun vote. C'est le cas de la
            réforme des retraites de 2023 : l'Assemblée ne s'est jamais prononcée sur son ensemble,
            et ce qui a été voté, ce sont deux motions de censure. Chercher « ce qui a été voté sur
            les retraites » sans le savoir mène à côté du sujet.
          </Text>
        </Box>
      </Stack>
    </Container>
  );
}
