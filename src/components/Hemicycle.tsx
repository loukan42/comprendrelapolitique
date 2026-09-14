import { Box, Group, Text } from "@mantine/core";

/**
 * Hémicycle : un point par vote individuel réellement enregistré, jamais un
 * siège rempli par défaut pour atteindre 577 — un député sans position
 * enregistrée est absent des données (AGENTS.md section 5, règle 2),
 * jamais représenté comme s'il avait voté.
 *
 * Les positions des sièges sont générées géométriquement (rangées
 * concentriques, une par rangée en proportion de sa circonférence) : elles
 * n'essaient pas de reproduire le plan de salle réel, que la source ne
 * fournit pas. Seul l'agencement en éventail par groupe cherche à
 * ressembler à un hémicycle ; le lecteur ne doit pas en déduire le siège
 * réel d'un député précis.
 *
 * Couleurs : des nuances de gris adaptatives, jamais bleu/rouge. En France,
 * ce duo se lit comme droite/gauche avant d'être lu comme pour/contre ;
 * l'accent neutre du site (AGENTS.md section 4) interdit ce raccourci.
 */

export interface SiegeVote {
  organeUid: string | null;
  position: "POUR" | "CONTRE" | "ABSTENTION" | "NON_VOTANT";
}

// Couleurs de sens de vote définies dans le thème (`other.couleursVote`),
// pas des nuances de gris : en noir et blanc, un hémicycle de 577 points ne
// se lit plus. Voir theme.ts pour le choix des teintes et l'écart au duo
// bleu/rouge.
const COULEUR_POSITION: Record<SiegeVote["position"], string> = {
  POUR: "var(--couleur-vote-pour)",
  CONTRE: "var(--couleur-vote-contre)",
  ABSTENTION: "var(--couleur-vote-abstention)",
  NON_VOTANT: "transparent",
};

interface PointSiege {
  x: number;
  y: number;
  angle: number;
}

/** Répartit `total` sièges sur des rangées concentriques, en proportion de
 *  la circonférence de chaque rangée, puis renvoie les points triés de
 *  gauche à droite (par angle). Géométrie pure, indépendante des données. */
function genererSieges(total: number): PointSiege[] {
  if (total <= 0) return [];
  const rangees = Math.max(4, Math.min(12, Math.round(Math.sqrt(total / 2))));
  const rayonMin = 90;
  const rayonMax = 480;
  const pas = (rayonMax - rayonMin) / Math.max(1, rangees - 1);

  const brut: number[] = [];
  for (let i = 0; i < rangees; i++) {
    const rayon = rayonMin + i * pas;
    brut.push(Math.PI * rayon);
  }
  const sommeBrut = brut.reduce((s, v) => s + v, 0);
  const parRangee = brut.map((v) => Math.max(1, Math.round((v / sommeBrut) * total)));
  let ecart = total - parRangee.reduce((s, v) => s + v, 0);
  for (let i = parRangee.length - 1; ecart !== 0 && i >= 0; i--) {
    const delta = ecart > 0 ? 1 : -1;
    if (parRangee[i]! + delta >= 1) {
      parRangee[i]! += delta;
      ecart -= delta;
    }
  }

  const points: PointSiege[] = [];
  for (let i = 0; i < rangees; i++) {
    const rayon = rayonMin + i * pas;
    const n = parRangee[i]!;
    for (let j = 0; j < n; j++) {
      const angle = ((j + 0.5) / n) * Math.PI;
      points.push({
        x: 500 - rayon * Math.cos(angle),
        y: 500 - rayon * Math.sin(angle),
        angle,
      });
    }
  }
  return points.sort((a, b) => a.angle - b.angle);
}

export function Hemicycle({ sieges }: { sieges: SiegeVote[] }) {
  // Les sièges arrivent déjà rangés de la gauche vers la droite de
  // l'hémicycle (voir `chargerSieges`). On ne les retrie donc pas : une
  // version antérieure les ordonnait par effectif décroissant, ce qui
  // détruisait la seule information qu'un hémicycle apporte sur un tableau
  // de chiffres, la géographie politique.
  //
  // Seul l'ordre interne à un groupe est fixé ici, par position, pour que les
  // voix d'un même groupe forment des blocs lisibles plutôt qu'un damier.
  const ordrePosition: SiegeVote["position"][] = ["POUR", "CONTRE", "ABSTENTION", "NON_VOTANT"];
  const donneesOrdonnees: SiegeVote[] = [];
  let bloc: SiegeVote[] = [];
  let groupeCourant: string | null = null;
  const viderBloc = () => {
    donneesOrdonnees.push(
      ...[...bloc].sort(
        (a, b) => ordrePosition.indexOf(a.position) - ordrePosition.indexOf(b.position),
      ),
    );
    bloc = [];
  };
  for (const s of sieges) {
    const cle = s.organeUid ?? "?";
    if (groupeCourant !== null && cle !== groupeCourant) viderBloc();
    groupeCourant = cle;
    bloc.push(s);
  }
  viderBloc();

  const points = genererSieges(donneesOrdonnees.length);

  return (
    <Box>
      <Box
        component="svg"
        viewBox="0 0 1000 540"
        role="img"
        aria-label={`Hémicycle : ${donneesOrdonnees.length} votes individuels représentés par siège`}
        style={{ width: "100%", maxWidth: 560, display: "block", margin: "0 auto" }}
      >
        {points.map((p, i) => {
          const siege = donneesOrdonnees[i]!;
          const creux = siege.position === "NON_VOTANT";
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={7.2}
              fill={COULEUR_POSITION[siege.position]}
              stroke={creux ? "var(--mantine-color-dimmed)" : "none"}
              strokeWidth={creux ? 1.5 : 0}
            />
          );
        })}
      </Box>
      <Group justify="center" gap="lg" mt="sm">
        <LegendePoint couleur={COULEUR_POSITION.POUR} libelle="pour" />
        <LegendePoint couleur={COULEUR_POSITION.CONTRE} libelle="contre" />
        <LegendePoint couleur={COULEUR_POSITION.ABSTENTION} libelle="abstention" />
        <LegendePoint couleur="transparent" bordure libelle="non-votant" />
      </Group>
    </Box>
  );
}

function LegendePoint({
  couleur,
  libelle,
  bordure,
}: {
  couleur: string;
  libelle: string;
  bordure?: boolean;
}) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box
        bg={couleur}
        style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          border: bordure ? "1.5px solid var(--mantine-color-dimmed)" : undefined,
        }}
      />
      <Text size="sm" c="dimmed">
        {libelle}
      </Text>
    </Group>
  );
}
