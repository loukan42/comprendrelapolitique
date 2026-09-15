import { Anchor, Badge, Box, Container, SimpleGrid, Stack, Text, Title } from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CarteLien } from "../../components/CarteLien";
import { listerHubThemes } from "../../queries/themePages";

export const Route = createFileRoute("/themes/")({
  loader: () => listerHubThemes(),
  head: () => ({
    meta: [{ title: "Thèmes · Politiquizz" }],
  }),
  component: PageThemes,
});

function PageThemes() {
  const themes = Route.useLoaderData();

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Les grands thèmes</Title>
          <Text mt="sm" c="dimmed">
            Les lois votées depuis 2017, classées par sujet. Le classement est automatique, à partir
            du titre officiel de chaque texte : voir la{" "}
            <Anchor component={Link} to="/methodologie">
              méthodologie
            </Anchor>{" "}
            pour ses limites.
          </Text>
        </Box>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
          {themes.map((t) => (
            <CarteLien key={t.slug} href={`/themes/${t.slug}`}>
              <Text fw={600}>{t.libelle}</Text>
              <Badge mt={6} variant="outline" color="graphite" size="sm">
                {t.nombreTextes} texte{t.nombreTextes > 1 ? "s" : ""}
              </Badge>
            </CarteLien>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
