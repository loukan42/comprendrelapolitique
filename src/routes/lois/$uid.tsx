import {
  Anchor,
  Badge,
  Box,
  Card,
  Container,
  Group,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { IconArrowLeft, IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { BarreEmpilee } from "../../components/BarreEmpilee";
import { BarreHorizontale } from "../../components/BarreHorizontale";
import { Hemicycle } from "../../components/Hemicycle";
import { ParcoursLoi } from "../../components/ParcoursLoi";
import { PastilleGroupe } from "../../components/PastilleGroupe";
import { extraireEssentiel } from "../../lib/extraitIntervention";
import {
  chargerDossier,
  type DossierEngagement,
  type ExplicationVote,
  type ScrutinLoi,
  type VoteGroupeScrutin,
} from "../../queries/lois";

export const Route = createFileRoute("/lois/$uid")({
  loader: async ({ params }) => {
    const detail = await chargerDossier({ data: params.uid });
    if (!detail) throw notFound();
    return detail;
  },
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          {
            title: `${loaderData.dossier.titre ?? loaderData.dossier.uid} · Politiquizz`,
          },
        ]
      : [],
  }),
  component: PageLoi,
});

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formaterDate(iso: string): string {
  return dateLongue.format(new Date(iso));
}

const LIBELLE_POSITION: Record<ScrutinLoi["repartition"][number]["position"], string> = {
  POUR: "pour",
  CONTRE: "contre",
  ABSTENTION: "abstention",
  NON_VOTANT: "non-votants",
};

/**
 * L'intitulé complet n'est affiché que s'il dit plus que le titre court.
 * « proposition de loi pour une montagne vivante et souveraine » en face de
 * « Pour une montagne vivante et souveraine » n'apprend rien et ajoute une
 * ligne à lire ; « proposition de loi visant à… » en face d'un titre court
 * elliptique, si.
 */
function apporteQuelqueChose(complet: string | null, court: string | null): boolean {
  if (!complet) return false;
  if (!court) return true;
  const normaliser = (t: string) =>
    t
      .toLowerCase()
      .replace(/^(projet|proposition) de loi (organique |constitutionnelle )?/, "")
      .replace(/[^a-zà-ÿ0-9]/g, "");
  return normaliser(complet) !== normaliser(court);
}

/** Mêmes couleurs de sens de vote que l'hémicycle (voir theme.ts). */
const COULEUR_POSITION: Record<ScrutinLoi["repartition"][number]["position"], string | null> = {
  POUR: "var(--couleur-vote-pour)",
  CONTRE: "var(--couleur-vote-contre)",
  ABSTENTION: "var(--couleur-vote-abstention)",
  NON_VOTANT: null,
};

/**
 * Une motion de censure n'enregistre que les voix POUR (AGENTS.md section 5,
 * règle 3) : la répartition ne montre donc jamais de « 0 contre » inventé,
 * seulement les positions réellement présentes dans `officiel.vote`.
 */
function BlocScrutin({ scrutin }: { scrutin: ScrutinLoi }) {
  const maxVoix = Math.max(...scrutin.repartition.map((r) => r.effectif), 1);
  return (
    <Card withBorder radius="md" padding="lg">
      <Group gap="xs" wrap="nowrap" align="flex-start">
        {scrutin.sortCode === "adopté" && (
          <IconCircleCheck size={22} style={{ flexShrink: 0, marginTop: 2 }} />
        )}
        {scrutin.sortCode === "rejeté" && (
          <IconCircleX size={22} style={{ flexShrink: 0, marginTop: 2, opacity: 0.6 }} />
        )}
        <Box>
          <Text fw={600}>{scrutin.sortLibelle ?? scrutin.sortCode ?? "Résultat inconnu"}</Text>
          <Text c="dimmed" size="sm">
            {formaterDate(scrutin.dateScrutin)} · scrutin public {scrutin.uid}
            {scrutin.suffragesRequis !== null && <>, majorité requise {scrutin.suffragesRequis}</>}
          </Text>
        </Box>
      </Group>

      {scrutin.sieges.length > 0 && (
        <Box mt="lg">
          <Hemicycle sieges={scrutin.sieges} />
          <Text size="xs" c="dimmed" ta="center" mt={4}>
            Un point par vote individuel enregistré ({scrutin.sieges.length}), rangé de la gauche
            vers la droite de l&apos;hémicycle. L&apos;ordre des groupes est un placement éditorial
            : l&apos;Assemblée ne publie pas d&apos;axe gauche-droite. Les non-inscrits, qui ne
            forment pas une famille politique, sont regroupés à l&apos;extrémité droite du dessin
            sans que cela leur attribue une orientation.
          </Text>
        </Box>
      )}

      <Stack gap="xs" mt="lg" maw={420}>
        {scrutin.repartition.map((r) => (
          <BarreHorizontale
            key={r.position}
            libelle={LIBELLE_POSITION[r.position]}
            valeur={r.effectif}
            reference={maxVoix}
            libelleValeur={String(r.effectif)}
            couleur={COULEUR_POSITION[r.position]}
          />
        ))}
      </Stack>

      {scrutin.explicationsVote.length > 0 && (
        <Box mt="xl">
          <Text fw={600}>Pourquoi, dans leurs mots</Text>
          <Text c="dimmed" size="sm" mt={4}>
            Les explications de vote prononcées en séance avant ce scrutin, citées telles
            qu&apos;elles figurent au compte rendu. Chaque orateur parle au nom de son groupe, et le
            sens de son propre vote est rappelé à côté de son nom.
          </Text>
          <Stack gap="md" mt="md">
            {scrutin.explicationsVote.map((e) => (
              <BlocExplication key={e.acteurUid} explication={e} />
            ))}
          </Stack>
          <Text size="xs" c="dimmed" mt="sm">
            Source : compte rendu de la séance, Assemblée nationale. L&apos;extrait reprend les
            phrases où l&apos;orateur annonce le vote de son groupe et le justifie, mot pour mot et
            dans l&apos;ordre du discours.
          </Text>
        </Box>
      )}

      {scrutin.parGroupe.length > 0 && (
        <Box mt="xl">
          <Text fw={600}>Qui a voté quoi</Text>
          <Text c="dimmed" size="sm" mt={4}>
            Chaque groupe parlementaire existant au moment du vote, rangé de la gauche vers la
            droite, avec le sens de ses voix. Un parti comptant trop peu de députés pour former un
            groupe, qui en demande quinze, n&apos;apparaît pas ici : ses élus siègent parmi les
            non-inscrits. C&apos;est le cas du Rassemblement national jusqu&apos;en 2022.
          </Text>
          <Stack gap="md" mt="md">
            {scrutin.parGroupe.map((g) => (
              <LigneGroupe key={g.organeUid ?? "inconnu"} groupe={g} />
            ))}
          </Stack>
        </Box>
      )}
    </Card>
  );
}

/**
 * Une explication de vote : l'essentiel d'abord, le propos entier à la
 * demande. L'extrait est cité mot pour mot (voir `extraireEssentiel`), jamais
 * reformulé, et le texte complet reste à un clic pour que la coupe soit
 * vérifiable.
 */
function BlocExplication({ explication }: { explication: ExplicationVote }) {
  const [complet, setComplet] = useState(false);
  const resume = useMemo(() => extraireEssentiel(explication.texte), [explication.texte]);

  return (
    <Card withBorder radius="md" padding="md">
      <Group gap={8} wrap="nowrap" align="flex-start">
        <Box mt={5}>
          <PastilleGroupe couleur={explication.couleur} />
        </Box>
        <Box>
          <Text size="sm" fw={600}>
            {explication.groupe ?? "Groupe non renseigné"}
          </Text>
          <Text size="xs" c="dimmed">
            {explication.civilite} {explication.prenom} {explication.nom}
            {explication.position && <> · a voté {LIBELLE_POSITION[explication.position]}</>}
          </Text>
        </Box>
      </Group>

      {complet ? (
        <Box mt="sm">
          {explication.texte.split("\n\n").map((paragraphe, i) => (
            <Text key={i} size="sm" mt={i === 0 ? 0 : "sm"}>
              {paragraphe}
            </Text>
          ))}
        </Box>
      ) : (
        <Text size="sm" mt="sm">
          {resume.discontinu && <>… </>}
          {resume.extrait}
        </Text>
      )}

      {!resume.complet && (
        <Anchor
          component="button"
          type="button"
          size="sm"
          mt="xs"
          onClick={() => setComplet((v) => !v)}
        >
          {complet ? "Réduire" : "Lire l'intervention complète"}
        </Anchor>
      )}
    </Card>
  );
}

/**
 * Un groupe et le détail de ses voix. La position majoritaire est calculée
 * ici pour l'affichage, jamais attribuée aux députés du groupe : elle résume
 * une distribution réellement comptée, elle ne remplace aucun vote individuel
 * (AGENTS.md section 5, règle 1).
 */
function LigneGroupe({ groupe }: { groupe: VoteGroupeScrutin }) {
  const exprimes = groupe.voixPour + groupe.voixContre + groupe.voixAbstention;
  const majorite =
    exprimes === 0
      ? null
      : groupe.voixPour >= groupe.voixContre && groupe.voixPour >= groupe.voixAbstention
        ? "pour"
        : groupe.voixContre >= groupe.voixAbstention
          ? "contre"
          : "abstention";
  return (
    <Box>
      <Group justify="space-between" gap="sm" wrap="nowrap" mb={4}>
        <Group gap={6} wrap="nowrap">
          <PastilleGroupe couleur={groupe.couleur} />
          {groupe.organeUid ? (
            <Anchor href={`/groupes/${groupe.organeUid}`} size="sm" fw={600} underline="hover">
              {groupe.libelle ?? groupe.organeUid}
            </Anchor>
          ) : (
            <Text size="sm" fw={600}>
              Groupe non renseigné par la source
            </Text>
          )}
        </Group>
        {majorite && (
          <Text size="sm" fw={700}>
            {majorite}
          </Text>
        )}
      </Group>
      <BarreEmpilee
        libelle=""
        segments={[
          { libelle: "pour", valeur: groupe.voixPour, position: "pour" },
          { libelle: "contre", valeur: groupe.voixContre, position: "contre" },
          { libelle: "abstention", valeur: groupe.voixAbstention, position: "abstention" },
        ]}
      />
      {groupe.voixNonVotant > 0 && (
        <Text size="xs" c="dimmed" mt={2}>
          {groupe.voixNonVotant} non-votant{groupe.voixNonVotant > 1 ? "s" : ""}
        </Text>
      )}
    </Box>
  );
}

function BlocEngagement({ engagement }: { engagement: DossierEngagement }) {
  return (
    <Box>
      <Text fw={600} mb="xs">
        {engagement.titre ?? engagement.uid}
      </Text>
      {engagement.scrutin ? (
        <BlocScrutin scrutin={engagement.scrutin} />
      ) : (
        <Text c="dimmed" size="sm">
          Aucune motion de censure rattachée à cet engagement dans les données importées.
        </Text>
      )}
    </Box>
  );
}

function PageLoi() {
  const detail = Route.useLoaderData();
  const { dossier, actes, scrutinsEnsemble, adopteSansVote, dossiersEngagement } = detail;

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Anchor href="/lois" size="sm" c="dimmed" underline="hover" w="fit-content">
          <Group gap={4} wrap="nowrap">
            <IconArrowLeft size={14} />
            Toutes les lois
          </Group>
        </Anchor>

        <Box maw="var(--mesure-texte)">
          {dossier.procedureLibelle && (
            <Text c="dimmed" size="sm" mb={4}>
              {dossier.procedureLibelle}
              {dossier.legislature !== null && <> · {dossier.legislature}e législature</>}
            </Text>
          )}
          <Title order={1}>{dossier.titre ?? dossier.uid}</Title>

          {apporteQuelqueChose(dossier.titreComplet, dossier.titre) && (
            <Text mt="sm">
              Intitulé complet du texte :{" "}
              <Text span fs="italic">
                {dossier.titreComplet}
              </Text>
            </Text>
          )}

          {dossier.initiateur && (
            <Text mt="sm" c="dimmed">
              Déposé par{" "}
              <Anchor href={`/deputes/${dossier.initiateur.uid}`} underline="hover">
                {dossier.initiateur.civilite} {dossier.initiateur.prenom} {dossier.initiateur.nom}
              </Anchor>
              {dossier.initiateur.groupe && <> ({dossier.initiateur.groupe})</>}.
            </Text>
          )}

          {(dossier.urlAssemblee ?? dossier.urlSenat) && (
            <Group gap="md" mt="sm">
              {dossier.urlAssemblee && (
                <Anchor href={dossier.urlAssemblee} target="_blank" rel="noreferrer" size="sm">
                  Le dossier sur assemblee-nationale.fr
                </Anchor>
              )}
              {dossier.urlSenat && (
                <Anchor href={dossier.urlSenat} target="_blank" rel="noreferrer" size="sm">
                  Le dossier sur senat.fr
                </Anchor>
              )}
            </Group>
          )}
        </Box>

        <ParcoursLoi actes={actes} />

        <Box>
          <Title order={2}>Ce qui a été voté</Title>
          {scrutinsEnsemble.length > 0 ? (
            <Stack gap="md" mt="sm" maw="var(--mesure-texte)">
              {scrutinsEnsemble.map((s) => (
                <BlocScrutin key={s.uid} scrutin={s} />
              ))}
            </Stack>
          ) : adopteSansVote ? (
            <Card withBorder radius="md" padding="lg" mt="sm" maw="var(--mesure-texte)">
              <Badge variant="outline" color="graphite" w="fit-content">
                Adopté sans vote sur l&apos;ensemble
              </Badge>
              <Text mt="sm">
                Ce texte a été adopté par l&apos;article 49 alinéa 3 de la Constitution :
                l&apos;Assemblée nationale ne s&apos;est jamais prononcée sur son ensemble. Ce qui a
                été voté, ce sont les motions de censure déposées en réaction.
              </Text>
            </Card>
          ) : (
            <Text mt="sm" c="dimmed" maw="var(--mesure-texte)">
              Aucun vote sur l&apos;ensemble de ce texte n&apos;est présent dans les données
              importées. Cela peut signifier que la procédure n&apos;est pas allée à son terme, ou
              que le rattachement entre ce dossier et son scrutin n&apos;a pas pu être établi de
              façon fiable.
            </Text>
          )}
        </Box>

        {dossiersEngagement.length > 0 && (
          <Box>
            <Title order={2}>Motions de censure liées</Title>
            <Stack gap="lg" mt="sm" maw="var(--mesure-texte)">
              {dossiersEngagement.map((e) => (
                <BlocEngagement key={e.uid} engagement={e} />
              ))}
            </Stack>
          </Box>
        )}

        <Text size="sm" c="dimmed">
          Source :{" "}
          <Anchor href="https://data.assemblee-nationale.fr/" target="_blank" rel="noreferrer">
            Open Data de l&apos;Assemblée nationale
          </Anchor>
          , Licence Ouverte. Identifiant du dossier : {dossier.uid}.
        </Text>
      </Stack>
    </Container>
  );
}
