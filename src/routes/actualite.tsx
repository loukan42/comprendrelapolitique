import { Alert, Anchor, Box, Container, Stack, Text, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { createFileRoute } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { chargerActualite, type EvenementDossier, type VoteRecent } from "../queries/actualite";
import classes from "../components/Actualite.module.css";

export const Route = createFileRoute("/actualite")({
  loader: () => chargerActualite(),
  head: () => ({ meta: [{ title: "En ce moment à l'Assemblée · Politiquizz" }] }),
  component: PageActualite,
});

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Une date AAAA-MM-JJ, lue à midi pour qu'aucun fuseau ne la fasse changer de jour. */
function formaterDate(jour: string): string {
  return dateLongue.format(new Date(`${jour}T12:00:00`)).replace(/^1 /, "1er ");
}

function Section({
  titre,
  explication,
  vide,
  children,
}: {
  titre: string;
  explication: string;
  vide: boolean;
  children: ReactNode;
}) {
  return (
    <Box component="section">
      <Title order={2}>{titre}</Title>
      <Text c="dimmed" size="sm" mt="xs" maw="var(--mesure-texte)">
        {explication}
      </Text>
      {vide ? (
        <Text c="dimmed" mt="md">
          Aucune donnée chargée pour cette liste.
        </Text>
      ) : (
        <Box component="ul" className={classes["liste"]} mt="md">
          {children}
        </Box>
      )}
    </Box>
  );
}

function Element({ evenement, detail }: { evenement: EvenementDossier; detail?: string | null }) {
  return (
    <Box component="li" className={classes["element"]}>
      <Text size="sm" c="dimmed">
        {formaterDate(evenement.date)}
      </Text>
      <Box>
        <Anchor href={`/lois/${evenement.dossierUid}`}>
          {evenement.titre ?? evenement.dossierUid}
        </Anchor>
        {detail && (
          <Text size="sm" c="dimmed" mt={2}>
            {detail}
          </Text>
        )}
      </Box>
    </Box>
  );
}

/** Le résultat du scrutin, tel que la source l'écrit. */
function resultatVote(vote: VoteRecent): string | null {
  const texte = vote.sortLibelle ?? vote.sortCode;
  if (!texte) return null;
  return `Résultat : ${texte}`;
}

function PageActualite() {
  const { depots, votes, promulgations, miseAJour } = Route.useLoaderData();

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap={48}>
        <Box maw="var(--mesure-texte)">
          <Title order={1}>En ce moment à l&apos;Assemblée</Title>
          <Text mt="sm" c="dimmed">
            Les derniers textes déposés, les derniers votes sur l&apos;ensemble d&apos;un texte et
            les dernières lois promulguées, tels que l&apos;Assemblée nationale les publie dans ses
            données ouvertes.
            {miseAJour && <> Dernière archive publiée le {formaterDate(miseAJour)}.</>}
          </Text>
        </Box>

        <Section
          titre="Textes déposés"
          explication="Premier dépôt d'une initiative à l'Assemblée nationale : projet ou proposition de loi, proposition de résolution. Un texte déposé n'est pas encore examiné, et beaucoup ne le seront jamais."
          vide={depots.length === 0}
        >
          {depots.map((d) => (
            <Element key={d.dossierUid} evenement={d} detail={d.procedure} />
          ))}
        </Section>

        <Section
          titre="Votes sur l'ensemble d'un texte"
          explication="Le dernier scrutin public sur l'ensemble de chaque texte. Un texte adopté sans vote, par l'article 49 alinéa 3 de la Constitution, n'apparaît pas ici : il n'y a pas eu de vote."
          vide={votes.length === 0}
        >
          {votes.map((v) => (
            <Element key={v.dossierUid} evenement={v} detail={resultatVote(v)} />
          ))}
        </Section>

        <Section
          titre="Lois promulguées"
          explication="Date de promulgation par le président de la République, dernière étape avant l'entrée en vigueur."
          vide={promulgations.length === 0}
        >
          {promulgations.map((p) => (
            <Element key={p.dossierUid} evenement={p} />
          ))}
        </Section>

        <Text size="sm" c="dimmed">
          Source : données ouvertes de l&apos;Assemblée nationale, jeux Dossiers législatifs et
          Scrutins, republiés chaque nuit pour la législature en cours.
        </Text>
      </Stack>
    </Container>
  );
}
