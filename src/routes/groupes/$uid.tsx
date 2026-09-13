import {
  Anchor,
  Box,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { chargerGroupe } from "../../queries/groupes";

export const Route = createFileRoute("/groupes/$uid")({
  loader: async ({ params }) => {
    const detail = await chargerGroupe({ data: params.uid });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: `${loaderData.organe.libelle ?? loaderData.organe.uid} · Comprendre la Politique`,
          },
        ]
      : [],
  }),
  component: PageGroupe,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

function PageGroupe() {
  const { organe, membres, votesEnsemble, tauxUnite } = Route.useLoaderData();

  return (
    <Container py={80}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          {organe.legislature !== null && (
            <Text c="dimmed" size="sm" mb={4}>
              {organe.legislature}e législature
            </Text>
          )}
          <Title order={1}>{organe.libelle ?? organe.uid}</Title>
          <Text mt="sm" c="dimmed">
            {membres.length} député{membres.length > 1 ? "s" : ""} rattaché
            {membres.length > 1 ? "s" : ""} à ce groupe durant la législature.
          </Text>
        </Box>

        {tauxUnite && tauxUnite.total > 0 && (
          <Box maw="var(--mesure-texte)">
            <Title order={2}>Taux d&apos;unité</Title>
            <Text mt="sm">
              Sur {tauxUnite.total} votes individuels exprimés par ses membres dans des scrutins où
              le groupe avait une position majoritaire connue,{" "}
              {pourcent.format(tauxUnite.accord / tauxUnite.total)} suivaient cette position.
            </Text>
          </Box>
        )}

        <Box>
          <Title order={2}>Grands votes</Title>
          {votesEnsemble.length === 0 ? (
            <Text mt="sm" c="dimmed">
              Aucun vote sur l&apos;ensemble d&apos;un texte n&apos;est présent dans les données
              importées pour ce groupe.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={620} mt="sm">
              <Table horizontalSpacing="sm" verticalSpacing={6} withRowBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Texte</Table.Th>
                    <Table.Th ta="right">Pour</Table.Th>
                    <Table.Th ta="right">Contre</Table.Th>
                    <Table.Th ta="right">Abst.</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {votesEnsemble.map((v) => (
                    <Table.Tr key={v.scrutinUid}>
                      <Table.Td c="dimmed" w={110}>
                        {dateCourte.format(new Date(v.dateScrutin))}
                      </Table.Td>
                      <Table.Td>
                        {v.dossierUid ? (
                          <Anchor href={`/lois/${v.dossierUid}`}>{v.titre}</Anchor>
                        ) : (
                          v.titre
                        )}
                      </Table.Td>
                      <Table.Td ta="right">{v.voixPour}</Table.Td>
                      <Table.Td ta="right">{v.voixContre}</Table.Td>
                      <Table.Td ta="right">{v.voixAbstention}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Box>

        {membres.length > 0 && (
          <Box>
            <Title order={2}>Membres</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} mt="sm" spacing="xs">
              {membres.map((m) => (
                <Anchor key={m.acteurUid} href={`/deputes/${m.acteurUid}`}>
                  {m.civilite} {m.prenom} {m.nom}
                </Anchor>
              ))}
            </SimpleGrid>
          </Box>
        )}

        <Group gap={4}>
          <Text size="sm" c="dimmed">
            Source :{" "}
          </Text>
          <Anchor
            href="https://data.assemblee-nationale.fr/"
            target="_blank"
            rel="noreferrer"
            size="sm"
          >
            Open Data de l&apos;Assemblée nationale
          </Anchor>
          <Text size="sm" c="dimmed">
            , Licence Ouverte. Identifiant : {organe.uid}.
          </Text>
        </Group>
      </Stack>
    </Container>
  );
}
