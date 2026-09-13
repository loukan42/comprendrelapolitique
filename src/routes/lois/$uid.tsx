import {
  Anchor,
  Badge,
  Box,
  Card,
  Container,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { BarreHorizontale } from "../../components/BarreHorizontale";
import { Hemicycle } from "../../components/Hemicycle";
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
  const maxVoix = Math.max(...scrutin.repartition.map((r) => r.effectif), 1);
  return (
    <Card withBorder radius="md" padding="lg">
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {scrutin.sortCode === "adopté" && (
          <IconCircleCheck size={22} style={{ flexShrink: 0, marginTop: 2 }} />
        )}
        {scrutin.sortCode === "rejeté" && (
          <IconCircleX size={22} style={{ flexShrink: 0, marginTop: 2, opacity: 0.6 }} />
        )}
        <Box>
          <Text fw={600}>{scrutin.sortLibelle ?? scrutin.sortCode ?? "Résultat inconnu"}</Text>
          <Text c="dimmed" size="sm">
            {formaterDate(scrutin.dateScrutin)} · scrutin public {scrutin.uid}
            {scrutin.suffragesRequis !== null && <>, majorité requise {scrutin.suffragesRequis}</>}
          </Text>
        </Box>
      </Group>

      {scrutin.sieges.length > 0 && (
        <Box mt="lg">
          <Hemicycle sieges={scrutin.sieges} />
          <Text size="xs" c="dimmed" ta="center" mt={4}>
            Un point par vote individuel enregistré ({scrutin.sieges.length}). Sièges regroupés par
            groupe parlementaire ; leur disposition ne reproduit pas le plan de salle réel.
          </Text>
        </Box>
      )}

      <Stack gap="xs" mt="lg" maw={420}>
        {scrutin.repartition.map((r) => (
          <BarreHorizontale
            key={r.position}
            libelle={LIBELLE_POSITION[r.position]}
            valeur={r.effectif}
            reference={maxVoix}
            libelleValeur={String(r.effectif)}
          />
        ))}
      </Stack>
    </Card>
  );
}

function BlocEngagement({ engagement }: { engagement: DossierEngagement }) {
  return (
    <Box>
      <Text fw={600} mb="xs">
        {engagement.titre ?? engagement.uid}
      </Text>
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
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Anchor href="/recherche" size="sm" c="dimmed" underline="hover" w="fit-content">
          <Group gap={4} wrap="nowrap">
            <IconArrowLeft size={14} />
            Retour à la recherche
          </Group>
        </Anchor>

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
            <Stack gap="md" mt="sm" maw="var(--mesure-texte)">
              {scrutinsEnsemble.map((s) => (
                <BlocScrutin key={s.uid} scrutin={s} />
              ))}
            </Stack>
          ) : adopteSansVote ? (
            <Card withBorder radius="md" padding="lg" mt="sm" maw="var(--mesure-texte)">
              <Badge variant="outline" color="graphite" w="fit-content">
                Adopté sans vote sur l&apos;ensemble
              </Badge>
              <Text mt="sm">
                Ce texte a été adopté par l&apos;article 49 alinéa 3 de la Constitution :
                l&apos;Assemblée nationale ne s&apos;est jamais prononcée sur son ensemble. Ce qui a
                été voté, ce sont les motions de censure déposées en réaction.
              </Text>
            </Card>
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
            <Stack gap="lg" mt="sm" maw="var(--mesure-texte)">
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
              <Table horizontalSpacing="sm" verticalSpacing={6} withRowBorders striped>
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
