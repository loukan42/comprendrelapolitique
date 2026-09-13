import { Anchor, Badge, Box, Container, Group, Stack, Table, Text, Title } from "@mantine/core";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { chargerDepute } from "../../queries/deputes";

export const Route = createFileRoute("/deputes/$uid")({
  loader: async ({ params }) => {
    const detail = await chargerDepute({ data: params.uid });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: `${loaderData.acteur.civilite ?? ""} ${loaderData.acteur.prenom ?? ""} ${loaderData.acteur.nom} · Comprendre la Politique`,
          },
        ]
      : [],
  }),
  component: PageDepute,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

const LIBELLE_POSITION: Record<string, string> = {
  POUR: "pour",
  CONTRE: "contre",
  ABSTENTION: "abstention",
  NON_VOTANT: "non-votant",
};

function PageDepute() {
  const { acteur, groupes, votesRecents, tauxUnite } = Route.useLoaderData();
  const groupeActuel = groupes.at(-1);

  return (
    <Container py={80}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>
            {acteur.civilite} {acteur.prenom} {acteur.nom}
          </Title>
          {groupeActuel && (
            <Text mt={4} c="dimmed">
              {groupeActuel.libelle ?? groupeActuel.libelleAbrege ?? "Groupe non identifié"}
              {groupeActuel.dateFin === null ? "" : " (mandat achevé)"}
            </Text>
          )}
        </Box>

        {groupes.length > 1 && (
          <Box>
            <Title order={2}>Historique des groupes</Title>
            <Table.ScrollContainer minWidth={420} mt="sm">
              <Table horizontalSpacing="sm" verticalSpacing={6} withRowBorders>
                <Table.Tbody>
                  {groupes.map((g) => (
                    <Table.Tr key={`${g.organeUid}-${g.dateDebut}`}>
                      <Table.Td c="dimmed" w={220}>
                        {dateCourte.format(new Date(g.dateDebut))}
                        {" → "}
                        {g.dateFin ? dateCourte.format(new Date(g.dateFin)) : "en cours"}
                      </Table.Td>
                      <Table.Td>{g.libelle ?? g.libelleAbrege ?? "Groupe non identifié"}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Box>
        )}

        {tauxUnite && tauxUnite.total > 0 && (
          <Box maw="var(--mesure-texte)">
            <Title order={2}>Taux d&apos;unité avec son groupe</Title>
            <Text mt="sm">
              Sur les {tauxUnite.total} scrutins où son groupe avait une position majoritaire
              connue, {acteur.civilite === "Mme" ? "elle" : "il"} a voté comme cette majorité dans{" "}
              {pourcent.format(tauxUnite.accord / tauxUnite.total)} des cas.
            </Text>
          </Box>
        )}

        <Box>
          <Title order={2}>Votes récents</Title>
          {votesRecents.length === 0 ? (
            <Text mt="sm" c="dimmed">
              Aucun vote nominatif n&apos;est présent dans les données importées pour ce
              parlementaire.
            </Text>
          ) : (
            <Table.ScrollContainer minWidth={560} mt="sm">
              <Table horizontalSpacing="sm" verticalSpacing={6} withRowBorders>
                <Table.Tbody>
                  {votesRecents.map((v) => (
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
                        {v.estVoteSurEnsemble && (
                          <Badge ml="xs" size="xs" variant="outline" color="graphite">
                            vote final
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td w={110}>{LIBELLE_POSITION[v.position]}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </Box>

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
            , Licence Ouverte. Identifiant : {acteur.uid}.
          </Text>
        </Group>
      </Stack>
    </Container>
  );
}
