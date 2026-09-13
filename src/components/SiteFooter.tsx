import { Anchor, Container, Group, Text } from "@mantine/core";

export function SiteFooter() {
  return (
    <Container
      size="md"
      py="lg"
      mt={80}
      style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
    >
      <Group justify="space-between" gap="sm">
        <Text size="sm" c="dimmed">
          Données : Open Data de l&apos;Assemblée nationale, Licence Ouverte.
        </Text>
        <Anchor
          href="https://data.assemblee-nationale.fr/"
          target="_blank"
          rel="noreferrer"
          size="sm"
          c="dimmed"
        >
          data.assemblee-nationale.fr
        </Anchor>
      </Group>
    </Container>
  );
}
