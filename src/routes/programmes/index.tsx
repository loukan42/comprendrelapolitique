import {
  Alert,
  Anchor,
  Badge,
  Box,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { IconExternalLink, IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  chargerProgrammes,
  LIBELLE_NATURE,
  type ReferenceProgramme,
} from "../../queries/programmes";

export const Route = createFileRoute("/programmes/")({
  loader: () => chargerProgrammes(),
  head: () => ({ meta: [{ title: "Les programmes 2027 · Politiquizz" }] }),
  component: PageProgrammes,
});

const dateCourte = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  month: "long",
  year: "numeric",
});

function LigneDocument({ doc }: { doc: ReferenceProgramme }) {
  return (
    <Box>
      <Group gap="xs" wrap="nowrap" align="baseline">
        {doc.url ? (
          <Anchor href={doc.url} target="_blank" rel="noreferrer" fw={600}>
            <Group gap={4} wrap="nowrap">
              {doc.titre ?? "Document"}
              <IconExternalLink size={14} />
            </Group>
          </Anchor>
        ) : (
          <Text fw={600}>{doc.titre ?? "Document"}</Text>
        )}
      </Group>
      <Group gap="xs" mt={4}>
        <Badge variant="outline" color="graphite" size="sm">
          {LIBELLE_NATURE[doc.nature]}
        </Badge>
        {doc.datePublication && (
          <Text size="xs" c="dimmed">
            {dateCourte.format(new Date(doc.datePublication))}
          </Text>
        )}
      </Group>
      {doc.note && (
        <Text size="sm" c="dimmed" mt={4}>
          {doc.note}
        </Text>
      )}
    </Box>
  );
}

function PageProgrammes() {
  const formations = Route.useLoaderData();

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Les programmes 2027</Title>
          <Text mt="sm" c="dimmed">
            Les documents publiés par les partis, avec le lien vers la source. Le site
            n&apos;héberge aucun de ces textes et n&apos;en résume pas le contenu : chaque lien mène
            au document tel que son auteur l&apos;a publié.
          </Text>
        </Box>

        <Stack gap={4}>
          <Anchor component={Link} to="/programmes/votes" fw={600}>
            Programmes et votes : les partis sur pièces
          </Anchor>
          <Anchor component={Link} to="/programmes/comparer" fw={600}>
            Comparer deux programmes thème par thème
          </Anchor>
          <Anchor component={Link} to="/programmes/quiz" fw={600}>
            Le quiz des programmes : choisir entre des propositions sans savoir qui les porte
          </Anchor>
        </Stack>

        <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
          Plusieurs partis ont publié un programme pour 2027. Pour les autres, le document listé est
          le plus récent de leur formation : programme présidentiel de 2022, programme des
          législatives de 2024, propositions du parti ou tribune du parti. La nature de chaque
          document est indiquée à côté de son titre, et l&apos;absence de document est affichée
          plutôt que passée sous silence.
        </Alert>

        {formations.length === 0 ? (
          <Text c="dimmed">
            Aucune référence n&apos;est chargée. Lancer <code>npm run data:programmes</code>.
          </Text>
        ) : (
          <Stack gap="md">
            {formations.map((f) => (
              <Card key={f.formation} withBorder radius="md" padding="lg">
                <Title order={2} fz="lg">
                  {f.formation}
                </Title>

                {f.documents.length > 0 && (
                  <Stack gap="md" mt="md">
                    {f.documents.map((d) => (
                      <LigneDocument key={d.id} doc={d} />
                    ))}
                  </Stack>
                )}

                {f.enAttente.length > 0 && (
                  <Box mt={f.documents.length > 0 ? "lg" : "md"}>
                    {f.enAttente.map((d) => (
                      <Box key={d.id} mb="sm">
                        <Text size="sm" fw={600}>
                          {f.formation}
                          <Text span c="dimmed" fw={400}>
                            {" "}
                            · aucun programme publié à ce jour
                          </Text>
                        </Text>
                        {d.note && (
                          <Text size="sm" c="dimmed" mt={2}>
                            {d.note}
                          </Text>
                        )}
                      </Box>
                    ))}
                  </Box>
                )}
              </Card>
            ))}
          </Stack>
        )}

        <Text size="sm" c="dimmed" maw="var(--mesure-texte)">
          Chaque lien a été vérifié comme accessible au moment de la mise à jour. Un document dont
          le lien ne répond plus est retiré de cette page plutôt que laissé en place.
        </Text>
      </Stack>
    </Container>
  );
}
