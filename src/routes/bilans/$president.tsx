import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconExternalLink, IconInfoCircle, IconSearch } from "@tabler/icons-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  chargerBilan,
  repartir,
  type Engagement,
  type Mandat,
  type StatutEngagement,
} from "../../queries/bilans";

export const Route = createFileRoute("/bilans/$president")({
  loader: async ({ params }) => {
    const bilan = await chargerBilan({ data: params.president });
    if (!bilan) throw notFound();
    return bilan;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: `Bilan des engagements ${precede("de", loaderData.prenom)} ${loaderData.nom} · Comprendre la Politique`,
          },
        ]
      : [],
  }),
  component: PageBilan,
});

const LIBELLE_STATUT: Record<StatutEngagement, string> = {
  realise: "Réalisée",
  partiellement: "Partiellement réalisée",
  en_cours: "En cours",
  non_realise: "Non réalisée",
  abandonne: "Abandonnée",
  inevaluable: "Impossible à évaluer",
};

const COULEUR_STATUT: Record<StatutEngagement, string> = {
  realise: "var(--statut-realise)",
  partiellement: "var(--statut-partiellement)",
  en_cours: "var(--statut-en-cours)",
  non_realise: "var(--statut-non-realise)",
  abandonne: "var(--statut-abandonne)",
  inevaluable: "var(--statut-inevaluable)",
};

const ORDRE_STATUTS: StatutEngagement[] = [
  "realise",
  "partiellement",
  "en_cours",
  "non_realise",
  "abandonne",
  "inevaluable",
];

const LIBELLE_CONFIANCE = {
  haute: "confiance élevée",
  moyenne: "confiance moyenne",
  basse: "confiance faible",
} as const;

/**
 * Libellés des compteurs, accordés avec « engagements » : masculin, et pluriel
 * au-delà de un (« 3 réalisés », « 1 non réalisé », « 0 abandonné »).
 */
const COMPTE_STATUT: Record<StatutEngagement, [string, string]> = {
  realise: ["réalisé", "réalisés"],
  partiellement: ["partiellement réalisé", "partiellement réalisés"],
  en_cours: ["en cours", "en cours"],
  non_realise: ["non réalisé", "non réalisés"],
  abandonne: ["abandonné", "abandonnés"],
  inevaluable: ["impossible à évaluer", "impossibles à évaluer"],
};

function libelleCompte(statut: StatutEngagement, n: number): string {
  return COMPTE_STATUT[statut][n > 1 ? 1 : 0];
}

/** « de Jacques », mais « d'Emmanuel » : élision devant une voyelle. */
function precede(preposition: "de", mot: string): string {
  return /^[aeiouyàâéèêëîïôûü]/i.test(mot) ? `d'${mot}` : `${preposition} ${mot}`;
}

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const annee = new Intl.DateTimeFormat("fr-FR", { year: "numeric" });
const pourcent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 0 });

function PastilleStatut({ statut }: { statut: StatutEngagement }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Box
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: COULEUR_STATUT[statut],
          flexShrink: 0,
        }}
      />
      <Text size="sm" fw={600}>
        {LIBELLE_STATUT[statut]}
      </Text>
    </Group>
  );
}

/**
 * Répartition en une barre. Les six statuts y figurent toujours dans le même
 * ordre, du plus abouti au moins concluant, pour que deux mandats se
 * comparent d'un coup d'oeil.
 */
function BarreRepartition({ engagements }: { engagements: Engagement[] }) {
  const r = repartir(engagements);
  if (r.total === 0) return null;
  return (
    <Box>
      <Group
        gap={0}
        wrap="nowrap"
        style={{ borderRadius: "var(--mantine-radius-sm)", overflow: "hidden", height: 14 }}
      >
        {ORDRE_STATUTS.map((s) =>
          r.parStatut[s] > 0 ? (
            <Box
              key={s}
              bg={COULEUR_STATUT[s]}
              style={{ width: `${(r.parStatut[s] / r.total) * 100}%`, height: "100%" }}
              title={`${LIBELLE_STATUT[s]} : ${r.parStatut[s]}`}
            />
          ) : null,
        )}
      </Group>
    </Box>
  );
}

/**
 * La fiche détaillée d'un engagement, dépliée à la demande.
 *
 * L'ordre suit celui du raisonnement : ce qui a été promis, ce qui a été
 * fait, ce qui a été obtenu, puis seulement le verdict et ses raisons. Le
 * lecteur peut ainsi se faire son avis avant de lire le nôtre, et vérifier
 * par les sources.
 */
function DetailEngagement({ engagement }: { engagement: Engagement }) {
  return (
    <Stack gap="lg" mt="lg">
      <Box>
        <Text fw={600} size="sm">
          Ce que disait précisément le programme
        </Text>
        <Text size="sm" fs="italic" mt={4}>
          «&nbsp;{engagement.extraitProgramme}&nbsp;»
        </Text>
        {engagement.pageProgramme && (
          <Text size="xs" c="dimmed" mt={2}>
            {engagement.pageProgramme}
          </Text>
        )}
      </Box>

      {engagement.actions.length > 0 && (
        <Box>
          <Text fw={600} size="sm" mb="xs">
            Ce qui a été fait
          </Text>
          <Stack gap="xs">
            {engagement.actions.map((a, i) => (
              <Group key={i} gap="sm" wrap="nowrap" align="flex-start">
                <Text size="sm" fw={700} c="dimmed" style={{ minWidth: 48 }}>
                  {annee.format(new Date(a.dateAction))}
                </Text>
                <Box>
                  <Text size="sm">{a.description}</Text>
                  {a.url && (
                    <Anchor href={a.url} target="_blank" rel="noreferrer" size="xs">
                      Source
                    </Anchor>
                  )}
                </Box>
              </Group>
            ))}
          </Stack>
        </Box>
      )}

      {engagement.resultat && (
        <Box>
          <Text fw={600} size="sm">
            Le résultat
          </Text>
          <Text size="sm" mt={4}>
            {engagement.resultat}
          </Text>
        </Box>
      )}

      {engagement.interpretations && (
        <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
          <Text size="sm">{engagement.interpretations}</Text>
        </Alert>
      )}

      <Box>
        <Group gap="xs" mb={4}>
          <PastilleStatut statut={engagement.statut} />
          <Text size="xs" c="dimmed">
            · {LIBELLE_CONFIANCE[engagement.confiance]}
          </Text>
        </Group>
        <Text fw={600} size="sm" mt="sm">
          Pourquoi ce statut
        </Text>
        <Text size="sm" mt={4}>
          {engagement.justification}
        </Text>
      </Box>

      <Box>
        <Text fw={600} size="sm" mb="xs">
          Sources
        </Text>
        <Stack gap={4}>
          {engagement.sources.map((s, i) => (
            <Box key={i}>
              <Anchor href={s.url} target="_blank" rel="noreferrer" size="sm">
                <Group gap={4} wrap="nowrap">
                  {s.titre}
                  <IconExternalLink size={12} />
                </Group>
              </Anchor>
              <Text size="xs" c="dimmed">
                {s.organisme}
                {s.dateSource ? ` · ${dateLongue.format(new Date(s.dateSource))}` : ""}
                {s.institutionnelle ? "" : " · presse"}
              </Text>
            </Box>
          ))}
        </Stack>
      </Box>

      <Text size="xs" c="dimmed">
        Vérifié le {dateLongue.format(new Date(engagement.verifieLe))}.
      </Text>
    </Stack>
  );
}

function CarteEngagement({ engagement }: { engagement: Engagement }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
        <Box>
          <Text fw={600}>{engagement.titre}</Text>
          <Badge variant="outline" color="graphite" size="sm" mt={4}>
            {engagement.theme}
          </Badge>
        </Box>
        <PastilleStatut statut={engagement.statut} />
      </Group>

      <Text size="sm" mt="md">
        {engagement.reformulation}
      </Text>

      {engagement.actionMenee && (
        <Box mt="sm">
          <Text fw={600} size="sm">
            Ce qui s&apos;est passé
          </Text>
          <Text size="sm" c="dimmed" mt={2}>
            {engagement.actionMenee}
          </Text>
        </Box>
      )}

      <Anchor
        component="button"
        type="button"
        size="sm"
        mt="sm"
        onClick={() => setOuvert((v) => !v)}
      >
        {ouvert ? "Réduire" : "Voir le détail et les sources"}
      </Anchor>

      {ouvert && <DetailEngagement engagement={engagement} />}
    </Card>
  );
}

function Statistiques({ mandat }: { mandat: Mandat }) {
  const r = repartir(mandat.engagements);
  return (
    <Card withBorder radius="md" padding="lg">
      <Text fz={32} fw={700} lh={1}>
        {r.total}
      </Text>
      <Text c="dimmed" size="sm">
        engagement{r.total > 1 ? "s" : ""} analysé{r.total > 1 ? "s" : ""}
      </Text>

      <Box mt="lg">
        <BarreRepartition engagements={mandat.engagements} />
      </Box>

      <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm" mt="md">
        {ORDRE_STATUTS.map((s) => (
          <Group key={s} gap={6} wrap="nowrap">
            <Box
              aria-hidden
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: COULEUR_STATUT[s],
                flexShrink: 0,
              }}
            />
            <Text size="sm">
              <Text span fw={700}>
                {r.parStatut[s]}
              </Text>{" "}
              <Text span c="dimmed">
                {libelleCompte(s, r.parStatut[s])}
              </Text>
            </Text>
          </Group>
        ))}
      </SimpleGrid>

      {r.tauxRealises !== null && (
        <Box mt="lg">
          <Text size="sm">
            <Text span fw={700}>
              {pourcent.format(r.tauxRealises)}
            </Text>{" "}
            des {r.evaluables} engagements évaluables sont entièrement réalisés.
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            Le calcul porte sur les engagements réalisés, partiellement réalisés, non réalisés ou
            abandonnés. Les engagements en cours et ceux qu&apos;on ne peut pas évaluer en sont
            exclus : les compter comme non tenus serait faux, les compter comme tenus le serait
            aussi.
          </Text>
        </Box>
      )}
    </Card>
  );
}

function PageBilan() {
  const bilan = Route.useLoaderData();
  const [mandatId, setMandatId] = useState(bilan.mandats[0]?.id ?? "");
  const [statut, setStatut] = useState<string>("tous");
  const [theme, setTheme] = useState<string>("tous");
  const [recherche, setRecherche] = useState("");

  const mandat = bilan.mandats.find((m) => m.id === mandatId) ?? bilan.mandats[0];

  const themes = useMemo(
    () =>
      Array.from(new Set(mandat?.engagements.map((e) => e.theme) ?? [])).sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [mandat],
  );

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (mandat?.engagements ?? []).filter((e) => {
      if (statut !== "tous" && e.statut !== statut) return false;
      if (theme !== "tous" && e.theme !== theme) return false;
      if (q && !`${e.titre} ${e.reformulation}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [mandat, statut, theme, recherche]);

  if (!mandat) {
    return (
      <Container size="md" py={{ base: 32, sm: 56 }}>
        <Title order={1}>
          {bilan.prenom} {bilan.nom}
        </Title>
        <Text mt="sm" c="dimmed">
          Aucun mandat n&apos;est renseigné.
        </Text>
      </Container>
    );
  }

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>
            {bilan.prenom} {bilan.nom}
          </Title>
          <Text fz="lg" mt="xs">
            Ses engagements face aux faits
          </Text>
          <Text mt="sm" c="dimmed">
            Les engagements de ses programmes de campagne sont comparés aux mesures réellement mises
            en place. Le site ne dit pas si une politique est bonne ou mauvaise : il vérifie si ce
            qui avait été annoncé a été fait.
          </Text>
          <Text size="xs" c="dimmed" mt="xs">
            Analyse fondée sur des sources publiques et institutionnelles.
          </Text>
        </Box>

        {bilan.mandats.length > 1 && (
          <SegmentedControl
            value={mandat.id}
            onChange={setMandatId}
            data={bilan.mandats.map((m) => ({ value: m.id, label: m.libelle }))}
          />
        )}

        {mandat.enCours && (
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            <Text fw={600} size="sm">
              Mandat en cours
            </Text>
            <Text size="sm" mt={4}>
              Les engagements sont évalués selon leur état d&apos;avancement à la date de dernière
              vérification. Un engagement non réalisé à ce jour n&apos;est pas pour autant une
              promesse non tenue : le mandat n&apos;est pas terminé.
            </Text>
          </Alert>
        )}

        <Text size="sm" c="dimmed">
          Engagements tirés de{" "}
          <Anchor href={mandat.programmeUrl} target="_blank" rel="noreferrer">
            {mandat.programmeTitre}
          </Anchor>
          . Une déclaration faite en cours de mandat n&apos;est pas un engagement de campagne et ne
          figure pas ici.
        </Text>

        {mandat.engagements.length === 0 ? (
          <Alert variant="light" color="graphite" icon={<IconInfoCircle size={18} />}>
            <Text fw={600} size="sm">
              Aucun engagement n&apos;est encore documenté pour ce mandat
            </Text>
            <Text size="sm" mt={4}>
              La structure est en place, la recherche documentaire reste à faire. Chaque engagement
              demande son extrait de programme, les textes de loi ou données publiques
              correspondants, et les sources permettant de vérifier. Rien n&apos;est affiché tant
              que ces pièces ne sont pas réunies : une fiche inventée serait pire que pas de fiche.
            </Text>
          </Alert>
        ) : (
          <>
            <Statistiques mandat={mandat} />

            <Group gap="sm" align="flex-end">
              <Select
                label="Statut"
                value={statut}
                onChange={(v) => setStatut(v ?? "tous")}
                data={[
                  { value: "tous", label: "Tous" },
                  ...ORDRE_STATUTS.map((s) => ({ value: s, label: LIBELLE_STATUT[s] })),
                ]}
                allowDeselect={false}
                w={200}
              />
              <Select
                label="Thème"
                value={theme}
                onChange={(v) => setTheme(v ?? "tous")}
                data={[
                  { value: "tous", label: "Tous" },
                  ...themes.map((t) => ({ value: t, label: t })),
                ]}
                allowDeselect={false}
                w={200}
              />
              <TextInput
                label="Rechercher"
                leftSection={<IconSearch size={16} />}
                value={recherche}
                onChange={(e) => setRecherche(e.currentTarget.value)}
                style={{ flexGrow: 1 }}
              />
            </Group>

            <Stack gap="md">
              {filtres.length === 0 ? (
                <Text c="dimmed">Aucun engagement ne correspond à ces filtres.</Text>
              ) : (
                filtres.map((e) => <CarteEngagement key={e.id} engagement={e} />)
              )}
            </Stack>
          </>
        )}

        {mandat.horsProgramme.length > 0 && (
          <Box>
            <Title order={2}>Et les mesures qui n&apos;étaient pas dans le programme ?</Title>
            <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
              Des réformes importantes prises pendant le mandat sans figurer dans le programme de
              campagne. Elles sont tenues à l&apos;écart du décompte ci-dessus : une mesure réalisée
              mais non promise ne compense pas une promesse non tenue.
            </Text>
            <Stack gap="md" mt="md">
              {mandat.horsProgramme.map((h) => (
                <Card key={h.id} withBorder radius="md" padding="lg">
                  <Group justify="space-between" align="flex-start" gap="sm" wrap="nowrap">
                    <Box>
                      <Text fw={600}>{h.titre}</Text>
                      <Badge variant="outline" color="graphite" size="sm" mt={4}>
                        {h.theme}
                      </Badge>
                    </Box>
                    {h.dateMesure && (
                      <Text size="sm" c="dimmed">
                        {annee.format(new Date(h.dateMesure))}
                      </Text>
                    )}
                  </Group>
                  <Text size="sm" mt="md">
                    {h.contexte}
                  </Text>
                  <Text size="sm" mt="sm">
                    {h.decision}
                  </Text>
                  <Text size="xs" c="dimmed" mt="sm">
                    Ne figurait pas explicitement dans le programme présidentiel.
                  </Text>
                  {h.sources.length > 0 && (
                    <Stack gap={2} mt="sm">
                      {h.sources.map((s, i) => (
                        <Anchor key={i} href={s.url} target="_blank" rel="noreferrer" size="xs">
                          {s.organisme} · {s.titre}
                        </Anchor>
                      ))}
                    </Stack>
                  )}
                </Card>
              ))}
            </Stack>
          </Box>
        )}

        <Card withBorder radius="md" padding="lg">
          <Title order={2} fz="lg">
            Comment nous évaluons les engagements
          </Title>
          <Stack gap="xs" mt="sm">
            <Text size="sm">1. Nous partons des programmes officiels de campagne.</Text>
            <Text size="sm">2. Nous en tirons les engagements objectivement vérifiables.</Text>
            <Text size="sm">
              3. Nous cherchons les textes de loi, décrets et données publiques correspondants, en
              privilégiant les sources institutionnelles sur la presse.
            </Text>
            <Text size="sm">
              4. Nous comparons le résultat observable à ce qui avait été annoncé, sans confondre le
              moyen et le résultat : une loi permettant de créer des postes n&apos;est pas des
              postes créés.
            </Text>
            <Text size="sm">5. Nous attribuons un statut et nous disons pourquoi.</Text>
            <Text size="sm">6. Nous publions les sources pour que chacun puisse vérifier.</Text>
          </Stack>
          <Text size="sm" mt="md" fw={600}>
            Ce site n&apos;évalue pas si une politique est bonne ou mauvaise. Il vérifie si
            l&apos;engagement annoncé a été mis en oeuvre.
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            Quand un engagement se prête à plusieurs lectures défendables, le plus souvent une
            lecture stricte du chiffre annoncé et une lecture par l&apos;intention, les deux sont
            exposées sous la fiche avec la raison du statut retenu. Un engagement chiffré
            s&apos;évalue sur son chiffre. « Impossible à évaluer » est réservé aux engagements trop
            vagues pour être tranchés.
          </Text>
        </Card>

        <Button component="a" href="/methodologie" variant="default" w="fit-content">
          La méthodologie du site
        </Button>
      </Stack>
    </Container>
  );
}
