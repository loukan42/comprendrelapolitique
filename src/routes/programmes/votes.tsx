import {
  Accordion,
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Container,
  Divider,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LIBELLES_CONSTAT } from "../../lib/programmesVotes";
import { libelleTheme } from "../../lib/themesProgrammes";
import { LIBELLE_NATURE } from "../../queries/programmes";
import {
  chargerProgrammesVotes,
  type ComparaisonProgrammeVote,
} from "../../queries/programmesVotes";
import classes from "../../components/ProgrammesVotes.module.css";

export const Route = createFileRoute("/programmes/votes")({
  loader: () => chargerProgrammesVotes(),
  head: () => ({ meta: [{ title: "Programmes et votes · Politiquizz" }] }),
  component: PageProgrammesVotes,
});

const date = (jour: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(new Date(jour));

function Fiche({ fiche: f }: { fiche: ComparaisonProgrammeVote }) {
  const sourceVote = `https://www.assemblee-nationale.fr/dyn/${f.legislature}/scrutins/${f.numero}`;
  return (
    <Stack component="article" gap="lg" className={classes["fiche"]}>
      <Group justify="space-between">
        <Title order={2}>{f.formation}</Title>
        <Badge color="graphite" variant="outline">
          {LIBELLES_CONSTAT[f.constat]}
        </Badge>
      </Group>
      <Text size="sm" c="dimmed">
        {libelleTheme(f.theme)} · Vérifié le {date(f.verifieLe)}
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xl">
        <Stack gap="sm">
          <Title order={3}>Dans le programme</Title>
          <Text component="blockquote" m={0}>
            « {f.extrait} »
          </Text>
          <Text size="sm">{LIBELLE_NATURE[f.nature]}</Text>
          <Anchor href={f.sourceProgramme} target="_blank" rel="noreferrer">
            {f.document}
          </Anchor>
          <Text size="sm" c="dimmed">
            {f.formation} ·{" "}
            {f.dateProgramme ? date(f.dateProgramme) : "Date de publication non renseignée"}
          </Text>
        </Stack>
        <Stack gap="sm">
          <Title order={3}>À l&apos;Assemblée</Title>
          <Text>{f.titreVote}</Text>
          {f.typeVote === "MOC" ? (
            <Text>
              {f.pour} voix pour la censure. Ce scrutin ne permet pas de comparer une proposition de
              fond.
            </Text>
          ) : (
            <Text>
              {f.pour} pour · {f.contre} contre · {f.abstention} abstentions · {f.nonVotant}{" "}
              non-votants enregistrés
            </Text>
          )}
          <Anchor href={sourceVote} target="_blank" rel="noreferrer">
            Assemblée nationale · {date(f.dateVote)}
          </Anchor>
          <Text size="sm" c="dimmed">
            Périmètre : {f.perimetre}
          </Text>
          <Anchor size="sm" href={f.sourcePerimetre} target="_blank" rel="noreferrer">
            Source du rattachement au parti · vérifiée le {date(f.verifieLe)}
          </Anchor>
        </Stack>
      </SimpleGrid>
      {f.constat === "non_comparable" ? (
        <Alert color="graphite">
          Le scrutin, son rattachement ou les votes disponibles ne permettent pas de publier ce
          rapprochement.{f.conflit && " Les sources de rattachement au dossier sont en conflit."}
        </Alert>
      ) : (
        <Box>
          <Title order={3}>Ce que la comparaison montre</Title>
          <Text mt="sm">{f.explication}</Text>
        </Box>
      )}
      <Text c="dimmed">{f.limites}</Text>
      <Anchor href={f.sourceTexte} target="_blank" rel="noreferrer">
        Lire le texte soumis au vote · Assemblée nationale · {date(f.dateVote)}
      </Anchor>
      <Text size="sm" c="dimmed">
        {f.dateProgramme && f.dateVote < f.dateProgramme
          ? "Ce vote précède la publication du document : un écart peut correspondre à une évolution de position."
          : "La date et la nature du document font partie de la comparaison."}
      </Text>
    </Stack>
  );
}

function PageProgrammesVotes() {
  const fiches = Route.useLoaderData();
  const [parti, setParti] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [constat, setConstat] = useState<string | null>(null);
  const visibles = fiches.filter(
    (f) =>
      (!parti || f.formation === parti) &&
      (!theme || f.theme === theme) &&
      (!constat || f.constat === constat),
  );
  return (
    <Container size="lg" py="xl" className={classes["page"]}>
      <Stack gap="xl">
        <Anchor component={Link} to="/programmes">
          Les programmes
        </Anchor>
        <Box maw="var(--mesure-texte)">
          <Text size="sm" c="dimmed">
            Présidentielle 2027 · Les partis sur pièces
          </Text>
          <Title order={1} mt="sm">
            Les promesses des partis face à leurs votes
          </Title>
          <Text mt="lg">
            Cette page met côte à côte une proposition écrite dans le programme d&apos;un parti et
            un vote passé de ses députés sur le même sujet. Chaque fiche indique le scrutin, le
            nombre de votes rattachés au parti et ce que l&apos;on peut réellement comparer.
          </Text>
        </Box>
        <Alert color="graphite" variant="outline">
          Une fiche peut signaler une même orientation, un écart documenté ou un cas à nuancer. Elle
          ne donne pas une note de « sincérité » : un vote porte sur un texte précis et ne résume
          jamais à lui seul tout le programme d&apos;un parti.
        </Alert>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Select
            label="Parti"
            placeholder="Tous les partis"
            clearable
            searchable
            value={parti}
            onChange={setParti}
            data={[...new Set(fiches.map((f) => f.formation))].sort()}
          />
          <Select
            label="Thème"
            placeholder="Tous les thèmes"
            clearable
            value={theme}
            onChange={setTheme}
            data={[...new Set(fiches.map((f) => f.theme))]
              .sort()
              .map((t) => ({ value: t, label: libelleTheme(t) }))}
          />
          <Select
            label="Constat"
            placeholder="Tous les constats"
            clearable
            value={constat}
            onChange={setConstat}
            data={Object.entries(LIBELLES_CONSTAT).map(([value, label]) => ({ value, label }))}
          />
        </SimpleGrid>
        <Text role="status" size="sm" c="dimmed">
          {visibles.length} fiche{visibles.length > 1 ? "s" : ""} dans le corpus publié
        </Text>
        {visibles.length ? (
          visibles.map((f) => <Fiche key={f.id} fiche={f} />)
        ) : (
          <Stack gap="sm" className={classes["fiche"]}>
            <Title order={2}>
              {fiches.length
                ? "Aucune fiche pour ces filtres"
                : "Les rapprochements restent à documenter"}
            </Title>
            <Text>
              {fiches.length
                ? "Modifiez les filtres pour consulter les autres fiches."
                : "Aucune fiche vérifiée n'est encore publiée. Les propositions restent consultables dans le comparateur, mais il serait abusif d'en déduire une cohérence ou une contradiction sans scrutin rattaché et vérifié."}
            </Text>
            {fiches.length > 0 && (
              <Button
                variant="default"
                onClick={() => {
                  setParti(null);
                  setTheme(null);
                  setConstat(null);
                }}
              >
                Réinitialiser les filtres
              </Button>
            )}
            <Anchor component={Link} to="/programmes/comparer">
              Comparer les programmes
            </Anchor>
          </Stack>
        )}
        <Divider />
        <Accordion variant="default">
          <Accordion.Item value="methode">
            <Accordion.Control>Comment lire les rapprochements</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md" maw="var(--mesure-texte)">
                <Text>
                  Le programme et le vote sont attribués au même parti. Le décompte rassemble les
                  votes individuels des députés qui avaient un mandat de ce parti à la date du
                  scrutin. La source et les limites de ce périmètre sont précisées sur chaque fiche.
                </Text>
                <Text>
                  Un vote contre un texte complet peut porter sur une autre disposition. La
                  comparaison doit expliquer ce qui était soumis au vote et les différences avec la
                  proposition. Une abstention ou un non-votant ne devient jamais un vote contre.
                </Text>
                <Text>
                  Les motions de censure, les amendements isolés et les rattachements en conflit ne
                  produisent pas de verdict dans cette version. Une adoption sans vote par 49.3 ou à
                  main levée ne fournit aucun vote nominatif sur l&apos;ensemble à comparer.
                </Text>
                <Text>
                  Un programme ancien ou une déclaration de parti conserve sa nature et sa date. Il
                  n&apos;est pas présenté comme un programme présidentiel 2027. Le corpus est
                  partiel ; l&apos;absence de fiche pour un parti ne vaut pas approbation de sa
                  cohérence.
                </Text>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Container>
  );
}
