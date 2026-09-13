import {
  Accordion,
  Anchor,
  Badge,
  Box,
  Container,
  Group,
  Progress,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowDown, IconArrowUp, IconArrowsSort } from "@tabler/icons-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import {
  chargerDossierLoi,
  type ActeParcours,
  type AmendementImportant,
  type BlocVote,
  type GroupeVote,
  type MotionCensure,
  type ScrutinDetail,
  type VoteIndividuel,
} from "../../lib/lois.server";
import { theme } from "../../theme";

const obtenirDossierLoi = createServerFn({ method: "GET" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => chargerDossierLoi(id));

export const Route = createFileRoute("/lois/$id")({
  loader: async ({ params }) => {
    const dossier = await obtenirDossierLoi({ data: params.id });
    if (!dossier) throw notFound();
    return dossier;
  },
  component: PageLoi,
  notFoundComponent: DossierIntrouvable,
});

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------

const nombre = new Intl.NumberFormat("fr-FR");
const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formaterDate(iso: string): string {
  return dateLongue.format(new Date(iso));
}

function pourcent(part: number, total: number): string {
  if (total <= 0) return "0 %";
  return new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 }).format(
    part / total,
  );
}

const COULEURS_VOTE = theme.other!["couleursVote"] as Record<
  "pour" | "contre" | "abstention" | "nonVotant",
  string
>;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function DossierIntrouvable() {
  return (
    <Container size="sm" py={96}>
      <Stack gap="md">
        <Title order={1}>Ce dossier n&apos;existe pas</Title>
        <Text c="dimmed">
          Aucun dossier législatif ne correspond à cet identifiant dans la base de l&apos;Assemblée
          nationale.
        </Text>
        <Anchor href="/">Retour à l&apos;accueil</Anchor>
      </Stack>
    </Container>
  );
}

function PageLoi() {
  const dossier = Route.useLoaderData();

  return (
    <Container size="md" py={64}>
      <Stack gap={48}>
        <Box maw="var(--mesure-texte)">
          <Group gap="xs" mb="xs">
            {dossier.procedureLibelle && (
              <Badge variant="outline" color="graphite" tt="none">
                {dossier.procedureLibelle}
              </Badge>
            )}
            {dossier.legislature && (
              <Badge variant="outline" color="graphite" tt="none">
                {dossier.legislature}e législature
              </Badge>
            )}
          </Group>
          <Title order={1}>{dossier.titre ?? dossier.uid}</Title>
        </Box>

        <SectionResumePedagogique titre="En 30 secondes" />
        <SectionResumePedagogique titre="Ce qui change concrètement" />
        <SectionResumePedagogique titre="Pourquoi cette loi ?" />

        <Box>
          <Title order={2} mb="md">
            Parcours de la loi
          </Title>
          <FriseParcours actes={dossier.parcours} votes={dossier.votes} />
        </Box>

        <Box>
          <Title order={2} mb="md">
            Qui a voté quoi ?
          </Title>
          <BlocVoteAffichage votes={dossier.votes} />
        </Box>

        <Box>
          <Title order={2} mb="md">
            Amendements importants
          </Title>
          <ListeAmendements amendements={dossier.amendements} />
        </Box>

        <SourcesBlock dossierUid={dossier.uid} />
      </Stack>
    </Container>
  );
}

/**
 * Emplacement des résumés pédagogiques (spec section 6 : « En 30 secondes »,
 * « Ce qui change concrètement », « Pourquoi cette loi ? »). Le schéma
 * `enrichissement` qui les alimenterait n'est pas encore peuplé : plutôt que
 * d'inventer un résumé, la section dit honnêtement qu'il manque.
 */
function SectionResumePedagogique({ titre }: { titre: string }) {
  return (
    <Box maw="var(--mesure-texte)">
      <Title order={2}>{titre}</Title>
      <Text mt="sm" c="dimmed">
        Résumé pédagogique à venir. Cette section dépend d&apos;un enrichissement qui n&apos;a pas
        encore été produit pour ce dossier.
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Gabarit 5 : parcours (frise macro + détail par lecture)
// ---------------------------------------------------------------------------

const ETAPES_MACRO = [
  "Dépôt",
  "Commission",
  "Séance Assemblée",
  "Sénat",
  "Nouvelle lecture / CMP",
  "Décision finale",
  "Conseil constitutionnel",
  "Promulgation",
] as const;

/**
 * Classement des actes en étapes macro à partir du préfixe de `code_acte`.
 * Approximation documentée, pas une modélisation exhaustive de la procédure :
 * elle s'appuie sur les conventions de code observées sur le corpus de la
 * XVIe (docs/DATA_MODEL.md section 4), pas sur un référentiel officiel des
 * codes. « Décision finale » n'est volontairement pas déduite des codes
 * d'actes, ambigus (plusieurs `*-DEC` jalonnent une navette) : elle reprend
 * directement le résultat du bloc de vote, qui est la donnée qui compte.
 */
function calculerEtapesFranchies(actes: ActeParcours[], votes: BlocVote): Record<string, boolean> {
  const codes = actes.map((a) => a.codeActe ?? "");
  const unCode = (pred: (c: string) => boolean) => codes.some(pred);

  return {
    Dépôt: unCode((c) => c.includes("DEPOT")),
    Commission: unCode((c) => c.includes("-COM") && !c.startsWith("CMP")),
    "Séance Assemblée": unCode((c) => /^AN\d/.test(c) && c.includes("DEBATS")),
    Sénat: unCode((c) => /^SN\d/.test(c) && c.includes("DEBATS")),
    "Nouvelle lecture / CMP": unCode((c) => c.startsWith("CMP") || /^(AN|SN)[2-9]/.test(c)),
    "Décision finale": votes.type === "vote_ensemble" || votes.type === "quarante_neuf_trois",
    "Conseil constitutionnel": unCode((c) => c.startsWith("CC")),
    Promulgation: unCode((c) => c.startsWith("PROM")),
  };
}

const LIBELLES_LECTURE: Record<string, string> = {
  SN1: "1ère lecture, Sénat",
  AN1: "1ère lecture, Assemblée nationale",
  SN2: "Nouvelle lecture, Sénat",
  AN2: "Nouvelle lecture, Assemblée nationale",
  SN3: "Lecture définitive, Sénat",
  AN3: "Lecture définitive, Assemblée nationale",
  CMP: "Commission mixte paritaire",
  CC: "Conseil constitutionnel",
  PROM: "Promulgation",
  AN21: "Engagement de responsabilité (article 49.3)",
};

function grouperParLecture(
  actes: ActeParcours[],
): Array<{ cle: string; libelle: string; actes: ActeParcours[] }> {
  const groupes = new Map<string, ActeParcours[]>();
  for (const acte of actes) {
    const prefixe = (acte.codeActe ?? "?").split("-")[0] ?? "?";
    if (!groupes.has(prefixe)) groupes.set(prefixe, []);
    groupes.get(prefixe)!.push(acte);
  }
  return [...groupes.entries()].map(([cle, actesGroupe]) => ({
    cle,
    libelle: LIBELLES_LECTURE[cle] ?? cle,
    actes: actesGroupe,
  }));
}

function FriseParcours({ actes, votes }: { actes: ActeParcours[]; votes: BlocVote }) {
  const franchies = useMemo(() => calculerEtapesFranchies(actes, votes), [actes, votes]);
  const lectures = useMemo(() => grouperParLecture(actes), [actes]);

  if (actes.length === 0) {
    return (
      <Text c="dimmed">Aucune étape de procédure enregistrée pour ce dossier dans la source.</Text>
    );
  }

  return (
    <Stack gap="lg">
      <Group gap="xs" wrap="wrap">
        {ETAPES_MACRO.map((etape) => (
          <Badge
            key={etape}
            variant={franchies[etape] ? "filled" : "outline"}
            color={franchies[etape] ? "encre" : "graphite"}
            tt="none"
          >
            {etape}
          </Badge>
        ))}
      </Group>

      <Accordion variant="separated" multiple={false}>
        {lectures.map((lecture) => (
          <Accordion.Item key={lecture.cle} value={lecture.cle}>
            <Accordion.Control>
              <Text fw={600}>{lecture.libelle}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Table verticalSpacing="xs" horizontalSpacing="sm">
                <Table.Tbody>
                  {lecture.actes.map((acte) => (
                    <Table.Tr key={acte.uid}>
                      <Table.Td w="14ch" c="dimmed">
                        {acte.dateActe ? formaterDate(acte.dateActe) : ""}
                      </Table.Td>
                      <Table.Td>
                        {acte.libelleCourt ?? acte.libelleCanonique ?? "Étape non libellée"}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Gabarits 1 à 4 : bloc de vote
// ---------------------------------------------------------------------------

function BlocVoteAffichage({ votes }: { votes: BlocVote }) {
  switch (votes.type) {
    case "vote_ensemble":
      return (
        <GabaritVoteEnsemble
          scrutin={votes.scrutinPrincipal}
          autresLectures={votes.autresLectures}
        />
      );
    case "quarante_neuf_trois":
      return <GabaritQuaranteNeufTrois engagements={votes.engagements} />;
    case "conflit":
      return (
        <GabaritConflit
          dossierOfficiel={votes.dossierOfficiel}
          dossierReconstruit={votes.dossierReconstruit}
        />
      );
    case "aucun_scrutin":
      return <GabaritAucunScrutin />;
  }
}

/** Gabarit 1 : scrutin ordinaire sur l'ensemble du texte. */
function GabaritVoteEnsemble({
  scrutin,
  autresLectures,
}: {
  scrutin: ScrutinDetail;
  autresLectures: {
    uid: string;
    objetLibelle: string;
    dateScrutin: string;
    sortLibelle: string | null;
  }[];
}) {
  const total = scrutin.pour + scrutin.contre + scrutin.abstention + scrutin.nonVotant;

  return (
    <Stack gap="lg">
      <Box>
        <Text fw={600}>{scrutin.objetLibelle}</Text>
        <Group gap="xs" mt={4}>
          <Text size="sm" c="dimmed">
            {formaterDate(scrutin.dateScrutin)}
          </Text>
          {scrutin.sortLibelle && (
            <Badge variant="light" color="encre" tt="none">
              {scrutin.sortLibelle}
            </Badge>
          )}
        </Group>
      </Box>

      <BarreQuatreCategories
        pour={scrutin.pour}
        contre={scrutin.contre}
        abstention={scrutin.abstention}
        nonVotant={scrutin.nonVotant}
      />

      <Group gap="xl">
        <ResultatChiffre
          libelle="Pour"
          valeur={scrutin.pour}
          total={total}
          couleur={COULEURS_VOTE.pour}
        />
        <ResultatChiffre
          libelle="Contre"
          valeur={scrutin.contre}
          total={total}
          couleur={COULEURS_VOTE.contre}
        />
        <ResultatChiffre
          libelle="Abstention"
          valeur={scrutin.abstention}
          total={total}
          couleur={COULEURS_VOTE.abstention}
        />
        <ResultatChiffre
          libelle="Non-votant"
          valeur={scrutin.nonVotant}
          total={total}
          couleur={COULEURS_VOTE.nonVotant}
        />
      </Group>

      {scrutin.suffragesRequis != null && (
        <Text size="sm" c="dimmed">
          Majorité requise : {nombre.format(scrutin.suffragesRequis)} voix.
        </Text>
      )}

      {autresLectures.length > 0 && (
        <Box>
          <Text size="sm" fw={600} mb={4}>
            Ce texte a été voté sur l&apos;ensemble à {autresLectures.length + 1} reprises
          </Text>
          <Stack gap={2}>
            {autresLectures.map((l) => (
              <Text key={l.uid} size="sm" c="dimmed">
                {formaterDate(l.dateScrutin)} : {l.sortLibelle ?? "résultat non renseigné"}
              </Text>
            ))}
          </Stack>
        </Box>
      )}

      <Box>
        <Title order={3} mb="sm">
          Les groupes étaient-ils divisés ?
        </Title>
        <RepartitionParGroupe groupes={scrutin.groupes} />
      </Box>

      <Accordion variant="separated">
        <Accordion.Item value="deputes">
          <Accordion.Control>Voir les députés</Accordion.Control>
          <Accordion.Panel>
            <TableVotesIndividuels votes={scrutin.votes} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

function BarreQuatreCategories({
  pour,
  contre,
  abstention,
  nonVotant,
}: {
  pour: number;
  contre: number;
  abstention: number;
  nonVotant: number;
}) {
  const total = pour + contre + abstention + nonVotant;
  if (total === 0) return null;
  return (
    <Progress.Root size={28}>
      <Progress.Section value={(pour / total) * 100} color={COULEURS_VOTE.pour}>
        <Progress.Label>{pourcent(pour, total)}</Progress.Label>
      </Progress.Section>
      <Progress.Section value={(contre / total) * 100} color={COULEURS_VOTE.contre}>
        <Progress.Label>{pourcent(contre, total)}</Progress.Label>
      </Progress.Section>
      <Progress.Section value={(abstention / total) * 100} color={COULEURS_VOTE.abstention}>
        <Progress.Label c="dark">{pourcent(abstention, total)}</Progress.Label>
      </Progress.Section>
      <Progress.Section value={(nonVotant / total) * 100} color={COULEURS_VOTE.nonVotant}>
        <Progress.Label c="dark">{pourcent(nonVotant, total)}</Progress.Label>
      </Progress.Section>
    </Progress.Root>
  );
}

function ResultatChiffre({
  libelle,
  valeur,
  total,
  couleur,
}: {
  libelle: string;
  valeur: number;
  total: number;
  couleur: string;
}) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Box
        w={12}
        h={12}
        bg={couleur}
        style={{ borderRadius: "var(--mantine-radius-xs)", flexShrink: 0 }}
      />
      <Box>
        <Text size="sm" c="dimmed">
          {libelle}
        </Text>
        <Text fw={600}>
          {nombre.format(valeur)}{" "}
          <Text span size="sm" c="dimmed" fw={400}>
            ({pourcent(valeur, total)})
          </Text>
        </Text>
      </Box>
    </Group>
  );
}

function RepartitionParGroupe({ groupes }: { groupes: GroupeVote[] }) {
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="sm" horizontalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Groupe</Table.Th>
            <Table.Th w="8ch" ta="right">
              Effectif
            </Table.Th>
            <Table.Th w="40%">Répartition du vote</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {groupes.map((g) => (
            <Table.Tr key={g.organeUid ?? g.libelle}>
              <Table.Td>
                {g.libelle}
                {!g.nominatifComplet && (
                  <Text span size="xs" c="dimmed">
                    {" "}
                    (décompte nominatif incomplet)
                  </Text>
                )}
              </Table.Td>
              <Table.Td ta="right">
                {g.nombreMembres != null ? nombre.format(g.nombreMembres) : "-"}
              </Table.Td>
              <Table.Td>
                <BarreQuatreCategories
                  pour={g.pour}
                  contre={g.contre}
                  abstention={g.abstention}
                  nonVotant={g.nonVotant}
                />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

type ClefTri = "nom" | "groupeLibelle" | "position";

function TableVotesIndividuels({ votes }: { votes: VoteIndividuel[] }) {
  const [clef, setClef] = useState<ClefTri>("nom");
  const [sensDescendant, setSensDescendant] = useState(false);

  const votesTries = useMemo(() => {
    const copie = [...votes];
    copie.sort((a, b) => {
      const va = a[clef] ?? "";
      const vb = b[clef] ?? "";
      const cmp = va.localeCompare(vb, "fr");
      return sensDescendant ? -cmp : cmp;
    });
    return copie;
  }, [votes, clef, sensDescendant]);

  function trierPar(nouvelleClef: ClefTri) {
    if (nouvelleClef === clef) {
      setSensDescendant((v) => !v);
    } else {
      setClef(nouvelleClef);
      setSensDescendant(false);
    }
  }

  function IconeTri({ clefColonne }: { clefColonne: ClefTri }) {
    if (clefColonne !== clef) return <IconArrowsSort size={14} />;
    return sensDescendant ? <IconArrowDown size={14} /> : <IconArrowUp size={14} />;
  }

  return (
    <Table.ScrollContainer minWidth={520}>
      <Table verticalSpacing={4} horizontalSpacing="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>
              <Anchor
                component="button"
                type="button"
                c="dark"
                underline="never"
                onClick={() => trierPar("nom")}
              >
                <Group gap={4} wrap="nowrap">
                  Nom <IconeTri clefColonne="nom" />
                </Group>
              </Anchor>
            </Table.Th>
            <Table.Th>
              <Anchor
                component="button"
                type="button"
                c="dark"
                underline="never"
                onClick={() => trierPar("groupeLibelle")}
              >
                <Group gap={4} wrap="nowrap">
                  Groupe <IconeTri clefColonne="groupeLibelle" />
                </Group>
              </Anchor>
            </Table.Th>
            <Table.Th>
              <Anchor
                component="button"
                type="button"
                c="dark"
                underline="never"
                onClick={() => trierPar("position")}
              >
                <Group gap={4} wrap="nowrap">
                  Position <IconeTri clefColonne="position" />
                </Group>
              </Anchor>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {votesTries.map((v) => (
            <Table.Tr key={v.acteurUid}>
              <Table.Td>
                {v.prenom} {v.nom}
              </Table.Td>
              <Table.Td c="dimmed">{v.groupeLibelle}</Table.Td>
              <Table.Td>
                <Group gap={6} wrap="nowrap">
                  {LIBELLE_POSITION[v.position]}
                  {v.parDelegation && (
                    <Badge size="xs" variant="outline" color="graphite" tt="none">
                      Par délégation
                    </Badge>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

const LIBELLE_POSITION: Record<VoteIndividuel["position"], string> = {
  POUR: "Pour",
  CONTRE: "Contre",
  ABSTENTION: "Abstention",
  NON_VOTANT: "Non-votant",
};

/** Gabarit 2 (invoqué depuis le gabarit 3) : une motion de censure. */
function BlocMotionCensure({ motion }: { motion: MotionCensure }) {
  const adoptee = motion.sortCode?.toLowerCase().includes("adopt");
  return (
    <Box>
      <Text fw={600}>{motion.titre}</Text>
      <Text mt={4}>
        {nombre.format(motion.nombreVotants)} voix pour la censure
        {motion.suffragesRequis != null && `, ${nombre.format(motion.suffragesRequis)} requises`}.
        Motion {adoptee ? "adoptée" : "rejetée"}.
      </Text>
      <Text size="sm" c="dimmed" mt="xs">
        Seuls les députés votant la censure sont recensés par la procédure de l&apos;article 49 de
        la Constitution. L&apos;absence de vote CONTRE dans cette liste ne signifie pas que les
        autres députés soutenaient le texte : ils ne prennent simplement pas part à ce type de
        scrutin.
      </Text>
      <Accordion variant="separated" mt="sm">
        <Accordion.Item value="deputes">
          <Accordion.Control>Voir les députés ({motion.votesPour.length})</Accordion.Control>
          <Accordion.Panel>
            <TableVotesIndividuels votes={motion.votesPour} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Box>
  );
}

/** Gabarit 3 : adopté sans vote par engagement de responsabilité (49.3). */
function GabaritQuaranteNeufTrois({
  engagements,
}: {
  engagements: Array<{
    dossierEngagement: { uid: string; titre: string | null };
    motions: MotionCensure[];
  }>;
}) {
  const plusieurs = engagements.length > 1;
  return (
    <Stack gap="lg">
      <Box
        p="md"
        style={{
          border: "1px solid var(--mantine-color-graphite-3)",
          borderRadius: "var(--mantine-radius-sm)",
        }}
      >
        <Text fw={600}>Adopté sans vote de l&apos;Assemblée sur l&apos;ensemble du texte.</Text>
        <Text mt="xs">
          Le Gouvernement a engagé sa responsabilité sur ce texte (article 49, alinéa 3 de la
          Constitution){plusieurs ? ", à plusieurs reprises," : ""} ce qui a entraîné son adoption
          sans vote sur l&apos;ensemble. L&apos;Assemblée nationale ne s&apos;est jamais prononcée
          par un scrutin sur ce texte pris dans son ensemble.
        </Text>
        <Text mt="xs" size="sm">
          {plusieurs ? "Dossiers d'engagement :" : "Dossier d'engagement :"}
        </Text>
        <Stack gap={2} mt={4}>
          {engagements.map(({ dossierEngagement }) => (
            <Text key={dossierEngagement.uid} size="sm">
              <Anchor href={`/lois/${dossierEngagement.uid}`}>
                {dossierEngagement.titre ?? dossierEngagement.uid}
              </Anchor>
            </Text>
          ))}
        </Stack>
      </Box>

      {engagements.map(({ dossierEngagement, motions }) =>
        motions.length > 0 ? (
          <Box key={dossierEngagement.uid}>
            <Title order={3} mb={2}>
              Motions de censure déposées en réaction
            </Title>
            {plusieurs && (
              <Text size="sm" c="dimmed" mb="sm">
                {dossierEngagement.titre ?? dossierEngagement.uid}
              </Text>
            )}
            <Stack gap="lg">
              {motions.map((m) => (
                <BlocMotionCensure key={m.uid} motion={m} />
              ))}
            </Stack>
          </Box>
        ) : null,
      )}
    </Stack>
  );
}

/** Gabarit 4, cas particulier : rattachement scrutin/dossier en conflit. */
function GabaritConflit({
  dossierOfficiel,
  dossierReconstruit,
}: {
  dossierOfficiel: string | null;
  dossierReconstruit: string | null;
}) {
  return (
    <Box
      p="md"
      style={{
        border: "1px solid var(--mantine-color-graphite-3)",
        borderRadius: "var(--mantine-radius-sm)",
      }}
    >
      <Text fw={600}>
        Rattachement incertain entre ce dossier et un scrutin : deux dossiers candidats identifiés.
      </Text>
      <Text mt="xs" size="sm" c="dimmed">
        Le lien officiel entre le scrutin et un dossier, et le rattachement reconstruit à partir des
        titres, désignent deux dossiers différents ({dossierOfficiel ?? "?"} et{" "}
        {dossierReconstruit ?? "?"}). Le produit ne tranche pas ce désaccord en silence.
      </Text>
    </Box>
  );
}

/** Gabarit 4 : aucun scrutin sur l'ensemble n'est rattaché à ce dossier. */
function GabaritAucunScrutin() {
  return (
    <Box
      p="md"
      style={{
        border: "1px solid var(--mantine-color-graphite-3)",
        borderRadius: "var(--mantine-radius-sm)",
      }}
    >
      <Text fw={600}>Vote individuel non disponible.</Text>
      <Text mt="xs">
        Aucun scrutin public nominatif n&apos;a été enregistré pour l&apos;adoption de ce texte. Un
        vote à main levée ou par accord tacite ne produit pas de décompte nominatif dans les données
        de l&apos;Assemblée nationale.
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Amendements
// ---------------------------------------------------------------------------

function ListeAmendements({ amendements }: { amendements: AmendementImportant[] }) {
  if (amendements.length === 0) {
    return <Text c="dimmed">Aucun amendement discuté n&apos;est enregistré pour ce dossier.</Text>;
  }
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table verticalSpacing="sm" horizontalSpacing="sm" withRowBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Numéro</Table.Th>
            <Table.Th>Auteur</Table.Th>
            <Table.Th>Sort</Table.Th>
            <Table.Th ta="right">Cosignataires</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {amendements.map((a) => (
            <Table.Tr key={a.uid}>
              <Table.Td>{a.numeroLong ?? "-"}</Table.Td>
              <Table.Td c="dimmed" maw={280}>
                {/* Le libellé officiel d'un amendement collectif énumère parfois
                    tous les signataires en toutes lettres : on le tronque
                    visuellement, le texte complet reste dans le titre. */}
                <Text truncate="end" title={a.auteurLibelle ?? a.typeAuteur}>
                  {a.auteurLibelle ?? a.typeAuteur}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge
                  variant={a.sortLibelle === "Adopté" ? "filled" : "outline"}
                  color={a.sortLibelle === "Adopté" ? "encre" : "graphite"}
                  tt="none"
                >
                  {a.sortLibelle ?? "-"}
                </Badge>
              </Table.Td>
              <Table.Td ta="right">{a.nombreCosignataires}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function SourcesBlock({ dossierUid }: { dossierUid: string }) {
  return (
    <Box pt="md" style={{ borderTop: "1px solid var(--mantine-color-graphite-3)" }}>
      <Title order={3} mb="sm">
        Sources
      </Title>
      <Text size="sm" c="dimmed">
        Dossier {dossierUid}. Données issues de l&apos;Open Data de l&apos;
        <Anchor href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
          Assemblée nationale
        </Anchor>
        , Licence Ouverte / Open Licence.
      </Text>
    </Box>
  );
}
