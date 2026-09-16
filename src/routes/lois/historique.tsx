import {
  Alert,
  Anchor,
  Badge,
  Box,
  Card,
  Container,
  Group,
  Pagination,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconAlertCircle, IconChartDonut, IconExternalLink, IconSearch } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import styles from "../../components/HistoriqueLois.module.css";
import {
  chargerHistoriqueLois,
  type FormationLois,
  type LoiHistorique,
} from "../../queries/historiqueLois";

export const Route = createFileRoute("/lois/historique")({
  loader: () => chargerHistoriqueLois(),
  head: () => ({ meta: [{ title: "Historique des lois · Politiquizz" }] }),
  component: PageHistoriqueLois,
});

const nombre = new Intl.NumberFormat("fr-FR");
const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const couleursCamembert = [
  "var(--mantine-color-donnees-4)",
  "var(--mantine-color-donnees-5)",
  "var(--mantine-color-donnees-6)",
  "var(--mantine-color-donnees-7)",
  "var(--mantine-color-donnees-8)",
  "var(--mantine-color-donnees-9)",
  "var(--mantine-color-donnees-3)",
  "var(--mantine-color-donnees-2)",
  "var(--mantine-color-donnees-1)",
];
const TAILLE_PAGE = 25;

function formaterDate(jour: string): string {
  return dateLongue.format(new Date(`${jour}T12:00:00`)).replace(/^1 /, "1er ");
}

function pourcentage(part: number, total: number): string {
  if (total === 0) return "0 %";
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(part / total);
}

function cheminArc(debut: number, fin: number): string {
  const centre = 100;
  const rayon = 86;
  const angle = (degre: number) => ((degre - 90) * Math.PI) / 180;
  const point = (degre: number) => [
    Number((centre + rayon * Math.cos(angle(degre))).toFixed(3)),
    Number((centre + rayon * Math.sin(angle(degre))).toFixed(3)),
  ];
  const [x1, y1] = point(debut);
  const [x2, y2] = point(fin);
  const grandArc = fin - debut > 180 ? 1 : 0;
  return `M ${centre} ${centre} L ${x1} ${y1} A ${rayon} ${rayon} 0 ${grandArc} 1 ${x2} ${y2} Z`;
}

function Camembert({ formations }: { formations: FormationLois[] }) {
  const adoptees = formations.filter((formation) => formation.adoptees > 0);
  const principales = adoptees.slice(0, 8);
  const reste = adoptees.slice(8).reduce((somme, formation) => somme + formation.adoptees, 0);
  const partsDonnees =
    reste > 0
      ? [...principales, { formation: "Autres formations", proposees: 0, adoptees: reste }]
      : principales;
  const total = partsDonnees.reduce((somme, formation) => somme + formation.adoptees, 0);
  if (total === 0) {
    return <Text c="dimmed">Aucune loi adoptée n&apos;est disponible dans le corpus chargé.</Text>;
  }

  let angle = 0;
  const parts = partsDonnees.map((formation, index) => {
    const suivant = angle + (formation.adoptees / total) * 360;
    const part = {
      formation,
      debut: angle,
      fin: suivant,
      couleur: couleursCamembert[index % couleursCamembert.length],
    };
    angle = suivant;
    return part;
  });

  return (
    <Box className={styles["chart"]}>
      <svg
        className={styles["pie"]}
        viewBox="0 0 200 200"
        role="img"
        aria-labelledby="camembert-titre camembert-description"
      >
        <title id="camembert-titre">Lois adoptées par formation</title>
        <desc id="camembert-description">
          Répartition des {nombre.format(total)} lois adoptées entre les principales formations des
          déposants et les autres formations regroupées.
        </desc>
        {parts.map((part) => (
          <path
            key={part.formation.formation}
            d={cheminArc(part.debut, part.fin)}
            fill={part.couleur}
            stroke="var(--mantine-color-body)"
            strokeWidth="2"
          />
        ))}
        <circle cx="100" cy="100" r="48" fill="var(--mantine-color-body)" />
        <text
          x="100"
          y="95"
          textAnchor="middle"
          fill="var(--mantine-color-text)"
          fontSize="18"
          fontWeight="600"
        >
          {nombre.format(total)}
        </text>
        <text x="100" y="113" textAnchor="middle" fill="var(--mantine-color-dimmed)" fontSize="9">
          ADOPTÉES
        </text>
      </svg>
      <Box className={styles["legende"]} component="ul" m={0} p={0}>
        {parts.map((part) => (
          <Box component="li" key={part.formation.formation} className={styles["ligneLegende"]}>
            <Box
              className={styles["pastille"]}
              style={{ backgroundColor: part.couleur }}
              aria-hidden="true"
            />
            <Text size="sm">{part.formation.formation}</Text>
            <Text size="sm" fw={600}>
              {nombre.format(part.formation.adoptees)}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function Evolution({
  annees,
}: {
  annees: Array<{ annee: number; proposees: number; adoptees: number }>;
}) {
  const maximum = Math.max(...annees.map((annee) => annee.proposees), 1);
  return (
    <Box className={styles["barres"]}>
      {annees.map((annee) => (
        <Box key={annee.annee} className={styles["barreLigne"]}>
          <Text size="sm" c="dimmed">
            {annee.annee}
          </Text>
          <Box className={styles["barreFond"]} aria-label={`${annee.proposees} textes déposés`}>
            <Box
              className={styles["barreValeur"]}
              style={{ width: `${(annee.proposees / maximum) * 100}%` }}
            />
          </Box>
          <Text size="sm" ta="right">
            {nombre.format(annee.proposees)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

function Stat({ valeur, label }: { valeur: string; label: string }) {
  return (
    <Card withBorder padding="lg" radius="md">
      <Text fz="clamp(2rem, 1.5rem + 1.4vw, 3rem)" fw={300} lh={1}>
        {valeur}
      </Text>
      <Text c="dimmed" mt="xs">
        {label}
      </Text>
    </Card>
  );
}

function PageHistoriqueLois() {
  const donnees = Route.useLoaderData();
  const [recherche, setRecherche] = useState("");
  const [formation, setFormation] = useState<string | null>(null);
  const [statut, setStatut] = useState<string | null>("toutes");
  const [page, setPage] = useState(1);
  const adoptees = donnees.lois.filter((loi) => loi.adoptee).length;
  const filtrage = useMemo(() => {
    const terme = recherche.trim().toLocaleLowerCase("fr");
    return donnees.lois.filter((loi) => {
      const correspondRecherche =
        !terme ||
        [loi.titre, loi.formation, loi.groupe, loi.initiateur]
          .filter(Boolean)
          .some((valeur) => valeur!.toLocaleLowerCase("fr").includes(terme));
      const correspondFormation = !formation || loi.formation === formation;
      const correspondStatut =
        statut === "toutes" || (statut === "adoptees" ? loi.adoptee : !loi.adoptee);
      return correspondRecherche && correspondFormation && correspondStatut;
    });
  }, [donnees.lois, formation, recherche, statut]);
  const nombrePages = Math.max(1, Math.ceil(filtrage.length / TAILLE_PAGE));
  const pageCourante = Math.min(page, nombrePages);
  const lignes = filtrage.slice((pageCourante - 1) * TAILLE_PAGE, pageCourante * TAILLE_PAGE);
  const optionsFormations = donnees.formations.map((item) => ({
    value: item.formation,
    label: item.formation,
  }));

  function changerRecherche(valeur: string) {
    setRecherche(valeur);
    setPage(1);
  }

  function changerFormation(valeur: string | null) {
    setFormation(valeur);
    setPage(1);
  }

  function changerStatut(valeur: string | null) {
    setStatut(valeur ?? "toutes");
    setPage(1);
  }

  return (
    <Container size={1200} px={{ base: "md", sm: "xl" }} py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Les lois proposées et adoptées</Title>
          <Text mt="sm" c="dimmed">
            Une vue sur vingt ans des dossiers de loi enregistrés par l&apos;Assemblée nationale.
            Pour chaque texte, la page indique sa date de dépôt, son déposant et le résultat de la
            procédure.
          </Text>
        </Box>

        {!donnees.couvertureComplete && (
          <Alert icon={<IconAlertCircle size={18} />} color="ocre" title="Couverture du corpus">
            La période demandée va du {formaterDate(donnees.debut)} au {formaterDate(donnees.fin)}.
            Le corpus actuellement chargé commence au{" "}
            {donnees.couvertureDebut ? formaterDate(donnees.couvertureDebut) : "une date inconnue"}{" "}
            : les années antérieures ne sont pas complètes et ne sont pas représentées comme telles.
          </Alert>
        )}

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Stat valeur={nombre.format(donnees.lois.length)} label="dossiers de loi recensés" />
          <Stat valeur={nombre.format(adoptees)} label="dossiers adoptés" />
          <Stat
            valeur={pourcentage(adoptees, donnees.lois.length)}
            label="part adoptée dans le corpus"
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Card withBorder padding="xl" radius="md">
            <Group gap="sm" mb="lg">
              <IconChartDonut size={20} aria-hidden="true" />
              <Title order={2} fz="xl">
                Qui a proposé les lois adoptées ?
              </Title>
            </Group>
            <Text size="sm" c="dimmed" mb="xl">
              Les parts représentent les formations auxquelles la source rattache le groupe du
              député initiateur au moment du dépôt, lorsque la correspondance est disponible. Les
              projets de loi déposés au nom d&apos;un ministre ou du Premier ministre sont regroupés
              sous « Gouvernement », car ces initiateurs n&apos;ont pas de groupe parlementaire. Les
              huit principales formations sont affichées séparément. Les autres sont regroupées,
              tandis que les propositions parlementaires sans rattachement restent sous « Déposant
              non rattaché ».
            </Text>
            <Camembert formations={donnees.formations} />
            <Text size="xs" c="dimmed" mt="xl">
              Les couleurs servent uniquement à distinguer les parts du graphique. Elles ne codent
              aucune opinion politique.
            </Text>
          </Card>
          <Card withBorder padding="xl" radius="md">
            <Title order={2} fz="xl">
              Dépôts par année
            </Title>
            <Text size="sm" c="dimmed" mt="xs" mb="xl">
              Nombre de dossiers de loi dont le premier acte enregistré se situe dans l&apos;année.
            </Text>
            {donnees.annees.length > 0 ? (
              <Evolution annees={donnees.annees} />
            ) : (
              <Text c="dimmed">Aucune donnée disponible.</Text>
            )}
          </Card>
        </SimpleGrid>

        <Box>
          <Title order={2}>Tous les dossiers du corpus</Title>
          <Text c="dimmed" mt="xs">
            {nombre.format(filtrage.length)} résultat{filtrage.length > 1 ? "s" : ""}. La formation
            affichée correspond au rattachement disponible dans les données, pas à une déduction à
            partir des votes.
          </Text>
        </Box>
        <Group align="end" gap="sm">
          <TextInput
            flex={1}
            label="Rechercher"
            placeholder="Titre, formation ou déposant"
            leftSection={<IconSearch size={16} />}
            value={recherche}
            onChange={(event) => changerRecherche(event.currentTarget.value)}
          />
          <Select
            label="Formation"
            placeholder="Toutes"
            clearable
            data={optionsFormations}
            value={formation}
            onChange={changerFormation}
          />
          <Select
            label="Statut"
            data={[
              { value: "toutes", label: "Tous" },
              { value: "adoptees", label: "Adoptés" },
              { value: "non-adoptees", label: "Non adoptés ou sans vote final" },
            ]}
            value={statut}
            onChange={changerStatut}
          />
        </Group>

        {lignes.length > 0 ? (
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm" horizontalSpacing="sm" withRowBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Texte</Table.Th>
                  <Table.Th>Déposé par</Table.Th>
                  <Table.Th>Date de dépôt</Table.Th>
                  <Table.Th>Résultat</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lignes.map((loi) => (
                  <LigneLoi key={loi.uid} loi={loi} />
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        ) : (
          <Text c="dimmed">Aucun dossier ne correspond à ces filtres.</Text>
        )}
        {nombrePages > 1 && (
          <Group justify="center">
            <Pagination total={nombrePages} value={pageCourante} onChange={setPage} />
          </Group>
        )}

        <Text size="xs" c="dimmed">
          Source : dossiers, actes législatifs, mandats et scrutins publiés par l&apos;Assemblée
          nationale. Mise à jour selon le dernier import du corpus. Les adoptions sans vote sont
          identifiées séparément via la vue officielle dédiée au 49.3. Les rattachements en conflit
          restent signalés et ne sont pas comptés comme des adoptions.
        </Text>
      </Stack>
    </Container>
  );
}

function LigneLoi({ loi }: { loi: LoiHistorique }) {
  return (
    <Table.Tr>
      <Table.Td maw={460}>
        <Anchor href={`/lois/${loi.uid}`}>{loi.titre ?? loi.uid}</Anchor>
        {loi.url && (
          <Anchor
            href={loi.url}
            target="_blank"
            rel="noreferrer"
            ml="xs"
            aria-label="Voir la source officielle"
          >
            <IconExternalLink size={14} />
          </Anchor>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm">{loi.formation}</Text>
        {loi.initiateur && (
          <Text size="xs" c="dimmed">
            {loi.initiateur}
          </Text>
        )}
      </Table.Td>
      <Table.Td c="dimmed">{formaterDate(loi.dateDepot)}</Table.Td>
      <Table.Td>
        <Badge
          variant={loi.adoptee ? "filled" : "outline"}
          color={loi.adoptee ? "encre" : loi.conflit ? "ocre" : "graphite"}
          tt="none"
        >
          {loi.adoptee
            ? loi.adopteePar493
              ? "Adopté sans vote, 49.3"
              : "Adopté"
            : loi.conflit
              ? "Rattachement à vérifier"
              : "Pas d’adoption identifiée"}
        </Badge>
      </Table.Td>
    </Table.Tr>
  );
}
