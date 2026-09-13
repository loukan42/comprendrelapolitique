import { Anchor, Badge, Box, Container, Group, Stack, Table, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { chargerPageTheme } from "../../queries/themePages";

export const Route = createFileRoute("/themes/$slug")({
  loader: async ({ params }) => {
    const page = await chargerPageTheme({ data: params.slug });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.libelle} · Comprendre la Politique` }] : [],
  }),
  component: PageTheme,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function PageTheme() {
  const { libelle, textes, parGroupe } = Route.useLoaderData();

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Anchor href="/themes" size="sm" c="dimmed" underline="hover" w="fit-content">
          <Group gap={4} wrap="nowrap">
            <IconArrowLeft size={14} />
            Tous les thèmes
          </Group>
        </Anchor>

        <Box maw="var(--mesure-texte)">
          <Title order={1}>{libelle}</Title>
          <Text mt="sm" c="dimmed">
            {textes.length} texte{textes.length > 1 ? "s" : ""} voté{textes.length > 1 ? "s" : ""}{" "}
            sur l&apos;ensemble depuis 2017, classé{textes.length > 1 ? "s" : ""} dans ce thème par
            le titre officiel du texte.
          </Text>
        </Box>

        {parGroupe.length > 0 && (
          <Box>
            <Title order={2}>Comment les groupes ont voté sur ce thème</Title>
            <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
              Somme des voix de chaque groupe sur l&apos;ensemble des textes de ce thème, tous
              scrutins confondus.
            </Text>
            <Table.ScrollContainer minWidth={480} mt="sm">
              <Table horizontalSpacing="sm" verticalSpacing={6} withRowBorders striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Groupe</Table.Th>
                    <Table.Th ta="right">Pour</Table.Th>
                    <Table.Th ta="right">Contre</Table.Th>
                    <Table.Th ta="right">Abst.</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {parGroupe.map((g) => (
                    <Table.Tr key={g.organeUid}>
                      <Table.Td>
                        <Anchor href={`/groupes/${g.organeUid}`} underline="hover">
                          {g.libelle ?? g.organeUid}
                        </Anchor>
                      </Table.Td>
                      <Table.Td ta="right">{g.voixPour}</Table.Td>
                      <Table.Td ta="right">{g.voixContre}</Table.Td>
                      <Table.Td ta="right">{g.voixAbstention}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Box>
        )}

        <Box>
          <Title order={2}>Les textes</Title>
          <Stack gap="sm" mt="sm">
            {textes.map((t) => (
              <Group
                key={t.dossierUid}
                justify="space-between"
                wrap="nowrap"
                align="flex-start"
                gap="sm"
              >
                <Box>
                  <Anchor href={`/lois/${t.dossierUid}`} fw={600} underline="hover">
                    {t.titre ?? t.dossierUid}
                  </Anchor>
                  <Text c="dimmed" size="sm">
                    {dateCourte.format(new Date(t.dateScrutin))}
                  </Text>
                </Box>
                {t.sortCode === "adopté" && (
                  <Badge
                    leftSection={<IconCircleCheck size={12} />}
                    variant="outline"
                    color="graphite"
                  >
                    adopté
                  </Badge>
                )}
                {t.sortCode === "rejeté" && (
                  <Badge leftSection={<IconCircleX size={12} />} variant="outline" color="graphite">
                    rejeté
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        </Box>

        <Text size="sm" c="dimmed">
          Source :{" "}
          <Anchor href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
            Open Data de l&apos;Assemblée nationale
          </Anchor>
          , Licence Ouverte.
        </Text>
      </Stack>
    </Container>
  );
}
