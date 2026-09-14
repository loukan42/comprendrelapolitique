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
import { createFileRoute } from "@tanstack/react-router";
import {
  chargerProgrammes,
  type NatureProgramme,
  type ReferenceProgramme,
} from "../queries/programmes";

export const Route = createFileRoute("/programmes")({
  loader: () => chargerProgrammes(),
  head: () => ({ meta: [{ title: "Les programmes 2027 · Comprendre la Politique" }] }),
  component: PageProgrammes,
});

/**
 * Le libellé de nature est la principale information de cette page après le
 * lien lui-même. À ce jour, presque aucun parti n'a publié de programme pour
 * la présidentielle de 2027 : ce qui est en ligne est un programme de 2024 ou
 * un projet en cours. Présenter ces documents comme des programmes 2027
 * tromperait le lecteur sur ce qu'il va lire.
 */
const LIBELLE_NATURE: Record<NatureProgramme, string> = {
  presidentiel_2027: "programme présidentiel 2027",
  legislatif_2024: "programme des législatives 2024",
  europeen_2024: "programme des européennes 2024",
  projet_en_cours: "projet du parti, en cours",
  aucun: "aucun document publié",
};

const dateCourte = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

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
            Les documents publiés par les partis eux-mêmes, avec le lien vers la source. Le site
            n&apos;héberge aucun de ces textes et n&apos;en résume pas le contenu : chaque lien mène
            au document tel que son auteur l&apos;a publié.
          </Text>
        </Box>

        <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
          À ce jour, aucun parti n&apos;a publié de programme pour la présidentielle de 2027. Ce qui
          est en ligne est soit un programme des élections de 2024, soit un projet de parti en cours
          d&apos;écriture. La nature de chaque document est indiquée à côté de son titre, et
          l&apos;absence de document est affichée plutôt que passée sous silence.
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
                          {d.candidat ?? f.formation}
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
