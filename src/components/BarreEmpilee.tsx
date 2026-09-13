import { Anchor, Box, Group, Text } from "@mantine/core";

export interface SegmentEmpile {
  libelle: string;
  valeur: number;
  /** Position du vote que représente ce segment. */
  position: "pour" | "contre" | "abstention";
}

/** Mêmes couleurs de sens de vote que l'hémicycle (voir theme.ts). */
const COULEUR_POSITION: Record<SegmentEmpile["position"], string> = {
  pour: "var(--couleur-vote-pour)",
  contre: "var(--couleur-vote-contre)",
  abstention: "var(--couleur-vote-abstention)",
};

const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });
const nombre = new Intl.NumberFormat("fr-FR");

/** « 0 % » pour deux voix réelles ferait lire une absence de vote là où il y
 *  en a eu : sous le demi-point, on écrit le seuil plutôt que l'arrondi. */
function part(valeur: number, total: number): string {
  const ratio = valeur / total;
  return ratio > 0 && ratio < 0.005 ? "< 1 %" : pourcent.format(ratio);
}

/**
 * Barre empilée pour une répartition (pour/contre/abstention) en part du
 * total, avec sa légende et le détail chiffré en dessous : la couleur seule
 * ne suffit pas à lire un résultat, surtout entre deux teintes de gris
 * proches. Voir BarreHorizontale.tsx pour le choix d'un composant maison
 * plutôt que `@mantine/charts`.
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
                  bg={COULEUR_POSITION[seg.position]}
                  style={{ width: `${(seg.valeur / total) * 100}%`, height: "100%" }}
                  title={`${seg.libelle} : ${seg.valeur}`}
                />
              ),
          )
        )}
      </Group>
      {total > 0 && (
        <Text size="xs" c="dimmed" mt={4}>
          {segments
            .filter((seg) => seg.valeur > 0)
            .map(
              (seg) => `${part(seg.valeur, total)} ${seg.libelle} (${nombre.format(seg.valeur)})`,
            )
            .join(" · ")}
        </Text>
      )}
    </Box>
  );
}

export function LegendeEmpilee({ segments }: { segments: Omit<SegmentEmpile, "valeur">[] }) {
  return (
    <Group gap="md">
      {segments.map((seg) => (
        <Group key={seg.libelle} gap={6} wrap="nowrap">
          <Box
            bg={COULEUR_POSITION[seg.position]}
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
