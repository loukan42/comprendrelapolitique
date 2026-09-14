import {
  Alert,
  Anchor,
  Box,
  Card,
  Container,
  Grid,
  Group,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  comparerProgrammes,
  listerFormationsComparables,
  type PositionProgramme,
} from "../../queries/programmes";

const recherche = z.object({
  a: z.string().optional(),
  b: z.string().optional(),
});

export const Route = createFileRoute("/programmes/comparer")({
  validateSearch: recherche,
  loaderDeps: ({ search }) => ({ a: search.a, b: search.b }),
  loader: async ({ deps }) => {
    const formations = await listerFormationsComparables();
    const a = deps.a ?? formations[0];
    const b = deps.b ?? formations[1];
    const comparaison = a && b && a !== b ? await comparerProgrammes({ data: [a, b] }) : [];
    return { formations, a: a ?? null, b: b ?? null, comparaison };
  },
  head: () => ({ meta: [{ title: "Comparer deux programmes · Comprendre la Politique" }] }),
  component: PageComparer,
});

/**
 * Libellés d'affichage des thèmes. Un thème absent de cette table s'affiche
 * avec son identifiant brut, ce qui se voit : la liste doit suivre les thèmes
 * réellement utilisés dans `programme_position`.
 */
const LIBELLE_THEME: Record<string, string> = {
  retraites: "Retraites",
  travail: "Travail",
  impots: "Impôts",
  energie: "Énergie",
  education: "Éducation",
  sante: "Santé",
  immigration: "Immigration",
  environnement: "Environnement",
  securite: "Sécurité",
  justice: "Justice",
  institutions: "Institutions",
  entreprises: "Entreprises",
  defense: "Défense",
  logement: "Logement",
  europe: "Europe",
  economie: "Économie",
};

/**
 * Une position citée. Le résumé n'apparaît jamais seul : la citation exacte
 * est affichée en dessous, avec le lien vers le document. Un résumé sans sa
 * citation serait une reformulation présentée comme la parole du parti.
 */
function BlocPosition({ position }: { position: PositionProgramme }) {
  return (
    <Box mb="md">
      {position.resumeAffichage && (
        <Text fw={600} size="sm">
          {position.resumeAffichage}
        </Text>
      )}
      <Text size="sm" c="dimmed" mt={2} fs="italic">
        «&nbsp;{position.extrait}&nbsp;»
      </Text>
      {position.url && (
        <Anchor
          href={position.url}
          target="_blank"
          rel="noreferrer"
          size="xs"
          mt={2}
          display="block"
        >
          {position.titreDocument ?? "Source"}
          {position.pageOuSection && position.pageOuSection !== position.titreDocument
            ? ` · ${position.pageOuSection}`
            : ""}
        </Anchor>
      )}
    </Box>
  );
}

function PageComparer() {
  const { formations, a, b, comparaison } = Route.useLoaderData();
  const navigate = useNavigate({ from: Route.fullPath });

  const options = formations.map((f) => ({ value: f, label: f }));

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Anchor
          component={Link}
          to="/programmes"
          size="sm"
          c="dimmed"
          underline="hover"
          w="fit-content"
        >
          <Group gap={4} wrap="nowrap">
            <IconArrowLeft size={14} />
            Tous les programmes
          </Group>
        </Anchor>

        <Box maw="var(--mesure-texte)">
          <Title order={1}>Comparer deux programmes</Title>
          <Text mt="sm" c="dimmed">
            Chaque position est une citation du document publié par la formation, reprise mot pour
            mot et accompagnée de son lien. Rien n&apos;est reformulé.
          </Text>
        </Box>

        {formations.length < 2 ? (
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            Il faut au moins deux formations avec des positions citées pour comparer. Le corpus est
            en cours de constitution : voir{" "}
            <Anchor component={Link} to="/programmes">
              la liste des programmes
            </Anchor>
            .
          </Alert>
        ) : (
          <>
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label="Première formation"
                  data={options}
                  value={a}
                  allowDeselect={false}
                  onChange={(v) => v && navigate({ search: (s) => ({ ...s, a: v }) })}
                />
              </Grid.Col>
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Select
                  label="Seconde formation"
                  data={options}
                  value={b}
                  allowDeselect={false}
                  onChange={(v) => v && navigate({ search: (s) => ({ ...s, b: v }) })}
                />
              </Grid.Col>
            </Grid>

            {a === b ? (
              <Text c="dimmed">Choisir deux formations différentes.</Text>
            ) : comparaison.length === 0 ? (
              <Text c="dimmed">
                Aucun thème n&apos;est documenté pour ces deux formations à la fois.
              </Text>
            ) : (
              <Stack gap="md">
                {comparaison.map((t) => (
                  <Card key={t.theme} withBorder radius="md" padding="lg">
                    <Title order={2} fz="lg" mb="md">
                      {LIBELLE_THEME[t.theme] ?? t.theme}
                    </Title>
                    <Grid>
                      {t.colonnes.map((colonne, i) => (
                        <Grid.Col key={i} span={{ base: 12, sm: 6 }}>
                          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="xs">
                            {i === 0 ? a : b}
                          </Text>
                          {colonne ? (
                            colonne.map((p) => <BlocPosition key={p.id} position={p} />)
                          ) : (
                            <Text size="sm" c="dimmed" fs="italic">
                              Rien de publié sur ce thème dans le document retenu.
                            </Text>
                          )}
                        </Grid.Col>
                      ))}
                    </Grid>
                  </Card>
                ))}
              </Stack>
            )}
          </>
        )}

        <Text size="sm" c="dimmed" maw="var(--mesure-texte)">
          Une colonne vide signifie que le document retenu ne traite pas ce thème, pas que la
          formation n&apos;a pas d&apos;avis. Les citations sont vérifiées automatiquement contre le
          document source : une phrase qui n&apos;y figure pas mot pour mot n&apos;est pas publiée.
        </Text>
      </Stack>
    </Container>
  );
}
