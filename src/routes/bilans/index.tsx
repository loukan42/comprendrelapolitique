import { Alert, Anchor, Box, Card, Container, Stack, Text, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { listerPresidents } from "../../queries/bilans";

export const Route = createFileRoute("/bilans/")({
  loader: () => listerPresidents(),
  head: () => ({ meta: [{ title: "Bilan des engagements · Comprendre la Politique" }] }),
  component: PageBilans,
});

function PageBilans() {
  const presidents = Route.useLoaderData();

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Bilan des engagements</Title>
          <Text mt="sm" c="dimmed">
            Les engagements pris en campagne, comparés aux mesures réellement mises en place. Le
            site ne dit pas si une politique est bonne ou mauvaise : il vérifie si ce qui avait été
            annoncé a été fait.
          </Text>
        </Box>

        {presidents.length === 0 ? (
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            Aucun bilan n&apos;est chargé. Lancer <code>npm run data:bilans</code>.
          </Alert>
        ) : (
          <Stack gap="md">
            {presidents.map((p) => (
              <Card key={p.id} withBorder radius="md" padding="lg">
                <Anchor href={`/bilans/${p.id}`} fw={600} fz="lg">
                  {p.prenom} {p.nom}
                </Anchor>
                <Text size="sm" c="dimmed" mt={4}>
                  {p.mandats} mandat{p.mandats > 1 ? "s" : ""} documenté
                  {p.mandats > 1 ? "s" : ""}
                </Text>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
