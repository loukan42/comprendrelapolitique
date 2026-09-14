import { Anchor, Container, Group, Text } from "@mantine/core";
import classes from "./SiteFooter.module.css";

/** Pied de page sur la largeur de l'accueil, liens en petites capitales. */
export function SiteFooter() {
  return (
    <footer className={classes["pied"]}>
      <Container size={1200} px={{ base: "md", sm: "xl" }} py="xl">
        <Group justify="space-between" align="flex-end" gap="lg">
          <Text size="sm" c="dimmed" maw={460}>
            Données : Open Data de l&apos;Assemblée nationale, Licence Ouverte.
          </Text>
          <Group gap="lg">
            <Anchor href="/methodologie" c="dimmed" underline="never" className={classes["lien"]}>
              Méthodologie
            </Anchor>
            <Anchor
              href="https://data.assemblee-nationale.fr/"
              target="_blank"
              rel="noreferrer"
              c="dimmed"
              underline="never"
              className={classes["lien"]}
            >
              Données ouvertes de l&apos;Assemblée
            </Anchor>
          </Group>
        </Group>
      </Container>
    </footer>
  );
}
