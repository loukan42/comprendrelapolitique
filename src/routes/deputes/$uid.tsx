import {
  Anchor,
  Badge,
  Box,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { BarreHorizontale } from "../../components/BarreHorizontale";
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
            title: `${loaderData.acteur.civilite ?? ""} ${loaderData.acteur.prenom ?? ""} ${loaderData.acteur.nom} · Politiquizz`,
          },
        ]
      : [],
  }),
  component: PageDepute,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
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
  const { acteur, groupes, votesRecents, tauxUnite, participation, proximiteGroupes } =
    Route.useLoaderData();
  const groupeActuel = groupes.at(-1);

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Anchor href="/lois" size="sm" c="dimmed" underline="hover" w="fit-content">
          <Group gap={4} wrap="nowrap">
            <IconArrowLeft size={14} />
            Toutes les lois
          </Group>
        </Anchor>

        <Box maw="var(--mesure-texte)">
          <Title order={1}>
            {acteur.civilite} {acteur.prenom} {acteur.nom}
          </Title>
          {groupeActuel && (
            <Group gap="xs" mt="sm">
              <Anchor href={`/groupes/${groupeActuel.organeUid}`} underline="hover">
                {groupeActuel.libelle ?? groupeActuel.libelleAbrege ?? "Groupe non identifié"}
              </Anchor>
              {groupeActuel.dateFin !== null && (
                <Badge variant="outline" color="graphite" size="sm">
                  mandat achevé
                </Badge>
              )}
            </Group>
          )}
        </Box>

        {((tauxUnite && tauxUnite.total > 0) ||
          (participation && participation.totalScrutins > 0)) && (
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {tauxUnite && tauxUnite.total > 0 && (
              <Card withBorder radius="md" padding="lg">
                <Text fw={600}>Taux d&apos;unité avec son groupe</Text>
                <Text c="dimmed" size="sm" mt={4}>
                  Sur les {tauxUnite.total} scrutins où son groupe avait une position majoritaire
                  connue, {acteur.civilite === "Mme" ? "elle" : "il"} a voté comme cette majorité.
                </Text>
                <Text fz={32} fw={700} lh={1} mt="sm">
                  {pourcent.format(tauxUnite.accord / tauxUnite.total)}
                </Text>
              </Card>
            )}
            {participation && participation.totalScrutins > 0 && (
              <Card withBorder radius="md" padding="lg">
                <Text fw={600}>Participation aux votes</Text>
                <Text c="dimmed" size="sm" mt={4}>
                  Scrutins où {acteur.civilite === "Mme" ? "elle" : "il"} a une position enregistrée
                  (y compris non-votant), sur les {participation.totalScrutins} scrutins tenus
                  pendant son ou ses mandats de député.
                </Text>
                <Text fz={32} fw={700} lh={1} mt="sm">
                  {pourcent.format(participation.votesExprimes / participation.totalScrutins)}
                </Text>
              </Card>
            )}
          </SimpleGrid>
        )}

        {proximiteGroupes.length > 0 && (
          <Box>
            <Title order={2}>Proximité avec les groupes</Title>
            <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
              Part des votes de ce parlementaire qui suivaient la position majoritaire de chaque
              groupe, sur les scrutins où celle-ci était connue (au moins 20 scrutins comparés).
              Part des scrutins où ce député a voté comme la majorité de chaque groupe. Ce
              n&apos;est pas le calcul du quiz, qui compare des réponses à des positions pondérées.
            </Text>
            <Stack gap="sm" mt="lg" maw="var(--mesure-texte)">
              {proximiteGroupes.map((p) => (
                <BarreHorizontale
                  key={`${p.organeUid}-${p.legislature ?? ""}`}
                  libelle={`${p.libelle ?? p.organeUid}${p.legislature !== null ? ` (${p.legislature}e légis.)` : ""}`}
                  href={`/groupes/${p.organeUid}`}
                  valeur={p.accord / p.total}
                  reference={1}
                  libelleValeur={pourcent.format(p.accord / p.total)}
                  couleur={p.couleur}
                />
              ))}
            </Stack>
          </Box>
        )}

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
                      <Table.Td>
                        <Anchor href={`/groupes/${g.organeUid}`} underline="hover">
                          {g.libelle ?? g.libelleAbrege ?? "Groupe non identifié"}
                        </Anchor>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
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
              <Table horizontalSpacing="sm" verticalSpacing={6} withRowBorders striped>
                <Table.Tbody>
                  {votesRecents.map((v) => (
                    <Table.Tr key={v.scrutinUid}>
                      <Table.Td c="dimmed" w={110}>
                        {dateCourte.format(new Date(v.dateScrutin))}
                      </Table.Td>
                      <Table.Td>
                        {v.dossierUid ? (
                          <Anchor href={`/lois/${v.dossierUid}`} underline="hover">
                            {v.titre}
                          </Anchor>
                        ) : (
                          v.titre
                        )}
                        {v.estVoteSurEnsemble && (
                          <Badge ml="xs" size="xs" variant="outline" color="graphite">
                            vote final
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td w={110} fw={600}>
                        {LIBELLE_POSITION[v.position]}
                      </Table.Td>
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
