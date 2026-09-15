import { Anchor, Badge, Box, Card, Container, Group, Stack, Text, Title } from "@mantine/core";
import { IconArrowLeft, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { BarreEmpilee, LegendeEmpilee } from "../../components/BarreEmpilee";
import { chargerPageTheme, type TexteTheme } from "../../queries/themePages";

export const Route = createFileRoute("/themes/$slug")({
  loader: async ({ params }) => {
    const page = await chargerPageTheme({ data: params.slug });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.libelle} · Politiquizz` }] : [],
  }),
  component: PageTheme,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const nombre = new Intl.NumberFormat("fr-FR");

/**
 * Une carte par texte, avec le résultat de son propre scrutin. Le décompte
 * n'est jamais agrégé à l'échelle du thème : additionner les voix de textes
 * différents ferait dire à un groupe qu'il « soutient la justice à 100 % »
 * alors qu'il a pu voter contre la moitié des lois du thème.
 */
function CarteTexte({ texte }: { texte: TexteTheme }) {
  const total = texte.voixPour + texte.voixContre + texte.voixAbstention;
  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <Box>
          <Anchor href={`/lois/${texte.dossierUid}`} fw={600} underline="hover">
            {texte.titre ?? texte.dossierUid}
          </Anchor>
          <Text c="dimmed" size="sm" mt={2}>
            Scrutin du {dateCourte.format(new Date(texte.dateScrutin))}
          </Text>
        </Box>
        {texte.sortCode === "adopté" && (
          <Badge leftSection={<IconCircleCheck size={12} />} variant="outline" color="graphite">
            adopté
          </Badge>
        )}
        {texte.sortCode === "rejeté" && (
          <Badge leftSection={<IconCircleX size={12} />} variant="outline" color="graphite">
            rejeté
          </Badge>
        )}
      </Group>

      {total > 0 && (
        <Box mt="md">
          <BarreEmpilee
            libelle={`${nombre.format(total)} voix exprimées`}
            segments={[
              { libelle: "pour", valeur: texte.voixPour, position: "pour" },
              { libelle: "contre", valeur: texte.voixContre, position: "contre" },
              { libelle: "abstention", valeur: texte.voixAbstention, position: "abstention" },
            ]}
          />
          <Text size="xs" c="dimmed" mt={4}>
            Le détail par groupe et le vote de chaque député sont sur{" "}
            <Anchor href={`/lois/${texte.dossierUid}`} size="xs" underline="hover">
              la page du texte
            </Anchor>
            .
          </Text>
        </Box>
      )}
    </Card>
  );
}

function PageTheme() {
  const { libelle, textes } = Route.useLoaderData();

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
            {textes.length} texte{textes.length > 1 ? "s" : ""} sur lequel l&apos;Assemblée a voté
            depuis 2017, du plus récent au plus ancien. Le rattachement à ce thème vient du titre
            officiel du texte. Chaque texte porte le résultat de son propre scrutin : ces chiffres
            ne sont jamais additionnés entre textes, une loi ne se résumant pas à celles qui
            partagent son thème.
          </Text>
        </Box>

        {textes.length > 0 && (
          <Box>
            <LegendeEmpilee
              segments={[
                { libelle: "pour", position: "pour" },
                { libelle: "contre", position: "contre" },
                { libelle: "abstention", position: "abstention" },
              ]}
            />
            <Stack gap="md" mt="md">
              {textes.map((t) => (
                <CarteTexte key={t.dossierUid} texte={t} />
              ))}
            </Stack>
          </Box>
        )}

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
