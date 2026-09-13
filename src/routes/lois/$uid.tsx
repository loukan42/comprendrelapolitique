import { Anchor, Badge, Box, Container, Stack, Table, Text, Title } from "@mantine/core";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { chargerDossier, type DossierEngagement, type ScrutinLoi } from "../../queries/lois";

export const Route = createFileRoute("/lois/$uid")({
  loader: async ({ params }) => {
    const detail = await chargerDossier({ data: params.uid });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: `${loaderData.dossier.titre ?? loaderData.dossier.uid} · Comprendre la Politique`,
          },
        ]
      : [],
  }),
  component: PageLoi,
});

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formaterDate(iso: string): string {
  return dateLongue.format(new Date(iso));
}

const LIBELLE_POSITION: Record<ScrutinLoi["repartition"][number]["position"], string> = {
  POUR: "pour",
  CONTRE: "contre",
  ABSTENTION: "abstention",
  NON_VOTANT: "non-votants",
};

/**
 * Une motion de censure n'enregistre que les voix POUR (AGENTS.md section 5,
 * règle 3) : la répartition ne montre donc jamais de « 0 contre » inventé,
 * seulement les positions réellement présentes dans `officiel.vote`.
 */
function BlocScrutin({ scrutin }: { scrutin: ScrutinLoi }) {
  return (
    <Box>
      <Text fw={600}>{scrutin.sortLibelle ?? scrutin.sortCode ?? "Résultat inconnu"}</Text>
      <Text c="dimmed" size="sm">
        {formaterDate(scrutin.dateScrutin)} · scrutin public {scrutin.uid}
        {scrutin.suffragesRequis !== null && <>, majorité requise {scrutin.suffragesRequis}</>}
      </Text>
      <Table.ScrollContainer minWidth={320} mt="xs">
        <Table horizontalSpacing={0} verticalSpacing={4} withRowBorders={false} maw={360}>
          <Table.Tbody>
            {scrutin.repartition.map((r) => (
              <Table.Tr key={r.position}>
                <Table.Td c="dimmed">{LIBELLE_POSITION[r.position]}</Table.Td>
                <Table.Td ta="right">{r.effectif}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Box>
  );
}

function BlocEngagement({ engagement }: { engagement: DossierEngagement }) {
  return (
    <Box>
      <Text fw={600}>{engagement.titre ?? engagement.uid}</Text>
      {engagement.scrutin ? (
        <BlocScrutin scrutin={engagement.scrutin} />
      ) : (
        <Text c="dimmed" size="sm">
          Aucune motion de censure rattachée à cet engagement dans les données importées.
        </Text>
      )}
    </Box>
  );
}

function PageLoi() {
  const detail = Route.useLoaderData();
  const { dossier, actes, scrutinsEnsemble, adopteSansVote, dossiersEngagement } = detail;

  return (
    <Container py={80}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          {dossier.procedureLibelle && (
            <Text c="dimmed" size="sm" mb={4}>
              {dossier.procedureLibelle}
              {dossier.legislature !== null && <> · {dossier.legislature}e législature</>}
            </Text>
          )}
          <Title order={1}>{dossier.titre ?? dossier.uid}</Title>
        </Box>

        <Box>
          <Title order={2}>Ce qui a été voté</Title>
          {scrutinsEnsemble.length > 0 ? (
            <Stack gap="lg" mt="sm">
              {scrutinsEnsemble.map((s) => (
                <BlocScrutin key={s.uid} scrutin={s} />
              ))}
            </Stack>
          ) : adopteSansVote ? (
            <Stack gap="xs" mt="sm" maw="var(--mesure-texte)">
              <Badge variant="outline" color="graphite" w="fit-content">
                Adopté sans vote sur l&apos;ensemble
              </Badge>
              <Text>
                Ce texte a été adopté par l&apos;article 49 alinéa 3 de la Constitution :
                l&apos;Assemblée nationale ne s&apos;est jamais prononcée sur son ensemble. Ce qui a
                été voté, ce sont les motions de censure déposées en réaction.
              </Text>
            </Stack>
          ) : (
            <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
              Aucun vote sur l&apos;ensemble de ce texte n&apos;est présent dans les données
              importées. Cela peut signifier que la procédure n&apos;est pas allée à son terme, ou
              que le rattachement entre ce dossier et son scrutin n&apos;a pas pu être établi de
              façon fiable.
            </Text>
          )}
        </Box>

        {dossiersEngagement.length > 0 && (
          <Box>
            <Title order={2}>Motions de censure liées</Title>
            <Stack gap="lg" mt="sm">
              {dossiersEngagement.map((e) => (
                <BlocEngagement key={e.uid} engagement={e} />
              ))}
            </Stack>
          </Box>
        )}

        {actes.length > 0 && (
          <Box>
            <Title order={2}>Étapes de la procédure</Title>
            <Table.ScrollContainer minWidth={480} mt="sm">
              <Table horizontalSpacing="sm" verticalSpacing={6} withRowBorders>
                <Table.Tbody>
                  {actes.map((a) => (
                    <Table.Tr key={a.uid}>
                      <Table.Td c="dimmed" w={140}>
                        {a.dateActe ? formaterDate(a.dateActe) : "—"}
                      </Table.Td>
                      <Table.Td>{a.libelleCanonique ?? a.libelleCourt ?? a.codeActe}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Box>
        )}

        <Text size="sm" c="dimmed">
          Source :{" "}
          <Anchor href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
            Open Data de l&apos;Assemblée nationale
          </Anchor>
          , Licence Ouverte. Identifiant du dossier : {dossier.uid}.
        </Text>
      </Stack>
    </Container>
  );
}
