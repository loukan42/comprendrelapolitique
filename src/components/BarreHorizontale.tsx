import { Anchor, Box, Group, Text } from "@mantine/core";

/**
 * Barre horizontale simple : une valeur, une référence (le maximum de la
 * série) qui fixe l'échelle. Composant maison plutôt que `@mantine/charts` :
 * la chaîne d'outils du projet (Vite/Rolldown) ne bundlait pas correctement
 * la dépendance `use-sync-external-store` de `recharts` au moment où ce
 * composant a été écrit (export nommé perdu par l'interop CJS du
 * pré-bundling). Une barre avec `Box` et une largeur en pourcentage fait le
 * même travail visuel sans dépendance fragile.
 */
export function BarreHorizontale({
  libelle,
  href,
  valeur,
  reference,
  libelleValeur,
}: {
  libelle: string;
  href?: string;
  valeur: number;
  reference: number;
  libelleValeur: string;
}) {
  const pct = reference > 0 ? Math.max(0, Math.min(100, (valeur / reference) * 100)) : 0;
  return (
    <Box>
      <Group justify="space-between" gap="sm" mb={4}>
        {href ? (
          <Anchor href={href} size="sm" fw={600} underline="hover">
            {libelle}
          </Anchor>
        ) : (
          <Text size="sm" fw={600}>
            {libelle}
          </Text>
        )}
        <Text size="sm" fw={700}>
          {libelleValeur}
        </Text>
      </Group>
      <Box
        bg="var(--mantine-color-default-hover)"
        style={{ borderRadius: "var(--mantine-radius-sm)", overflow: "hidden", height: 10 }}
      >
        <Box
          bg="var(--mantine-primary-color-filled)"
          style={{ width: `${pct}%`, height: "100%", borderRadius: "var(--mantine-radius-sm)" }}
        />
      </Box>
    </Box>
  );
}
