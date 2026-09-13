import { Anchor, Box, Group, Text } from "@mantine/core";

export interface SegmentEmpile {
  libelle: string;
  valeur: number;
  /** Nuance de graphite (jamais une couleur de parti : voir theme.ts). */
  teinte: "8" | "4" | "2";
}

/**
 * Barre empilée pour une répartition (pour/contre/abstention) en part du
 * total, avec sa légende. Voir BarreHorizontale.tsx pour le choix d'un
 * composant maison plutôt que `@mantine/charts`.
 */
export function BarreEmpilee({
  libelle,
  href,
  segments,
}: {
  libelle: string;
  href?: string;
  segments: SegmentEmpile[];
}) {
  const total = segments.reduce((s, seg) => s + seg.valeur, 0);
  return (
    <Box>
      {href ? (
        <Anchor href={href} size="sm" fw={600} underline="hover">
          {libelle}
        </Anchor>
      ) : (
        <Text size="sm" fw={600}>
          {libelle}
        </Text>
      )}
      <Group
        gap={0}
        wrap="nowrap"
        mt={4}
        style={{ borderRadius: "var(--mantine-radius-sm)", overflow: "hidden", height: 14 }}
      >
        {total === 0 ? (
          <Box bg="var(--mantine-color-default-hover)" style={{ width: "100%", height: "100%" }} />
        ) : (
          segments.map(
            (seg) =>
              seg.valeur > 0 && (
                <Box
                  key={seg.libelle}
                  bg={`var(--mantine-color-graphite-${seg.teinte})`}
                  style={{ width: `${(seg.valeur / total) * 100}%`, height: "100%" }}
                  title={`${seg.libelle} : ${seg.valeur}`}
                />
              ),
          )
        )}
      </Group>
    </Box>
  );
}

export function LegendeEmpilee({ segments }: { segments: Omit<SegmentEmpile, "valeur">[] }) {
  return (
    <Group gap="md">
      {segments.map((seg) => (
        <Group key={seg.libelle} gap={6} wrap="nowrap">
          <Box
            bg={`var(--mantine-color-graphite-${seg.teinte})`}
            style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0 }}
          />
          <Text size="sm" c="dimmed">
            {seg.libelle}
          </Text>
        </Group>
      ))}
    </Group>
  );
}
