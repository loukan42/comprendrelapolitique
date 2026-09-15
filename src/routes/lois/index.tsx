import {
  Anchor,
  Badge,
  Box,
  Checkbox,
  Container,
  Group,
  Pagination,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { IconSearch } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import {
  chargerListeDossiers,
  LEGISLATURES_LISTE,
  type ListeDossiers,
} from "../../lib/lois-liste.server";

interface RechercheLois {
  page: number;
  q: string;
  /** Législature filtrée, ou 0 pour toutes. */
  leg: number;
  /** Vrai pour inclure les résolutions et autres procédures. */
  tout: boolean;
}

const obtenirListeDossiers = createServerFn({ method: "GET" })
  .validator(
    (data: { page: number; recherche: string | null; legislature: number | null; tout: boolean }) =>
      data,
  )
  .handler(async ({ data }) => chargerListeDossiers(data));

export const Route = createFileRoute("/lois/")({
  validateSearch: (recherche: Record<string, unknown>): RechercheLois => {
    const page = Number(recherche["page"]);
    const leg = Number(recherche["leg"]);
    return {
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
      q: typeof recherche["q"] === "string" ? recherche["q"] : "",
      leg: LEGISLATURES_LISTE.some((l) => l === leg) ? leg : 0,
      tout: recherche["tout"] === true || recherche["tout"] === "true",
    };
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    q: search.q,
    leg: search.leg,
    tout: search.tout,
  }),
  loader: ({ deps }) =>
    obtenirListeDossiers({
      data: {
        page: deps.page,
        recherche: deps.q || null,
        legislature: deps.leg || null,
        tout: deps.tout,
      },
    }),
  head: () => ({ meta: [{ title: "Les lois · Comprendre la Politique" }] }),
  component: PageListeLois,
});

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const nombre = new Intl.NumberFormat("fr-FR");

function formaterDate(jour: string): string {
  return dateLongue.format(new Date(`${jour}T12:00:00`)).replace(/^1 /, "1er ");
}

const LIBELLE_LEGISLATURE: Record<number, string> = {
  15: "XVe (2017-2022)",
  16: "XVIe (2022-2024)",
  17: "XVIIe (depuis 2024)",
};

function PageListeLois() {
  const donnees = Route.useLoaderData();
  const { q, leg, tout } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [saisie, setSaisie] = useState(q);

  function changer(modif: Partial<RechercheLois>) {
    void navigate({ search: (precedent) => ({ ...precedent, ...modif, page: 1 }) });
  }

  return (
    <Container size={1200} px={{ base: "md", sm: "xl" }} py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Les lois</Title>
          <Text mt="sm" c="dimmed">
            Les textes de loi examinés par l&apos;Assemblée nationale depuis 2017, du plus récent au
            plus ancien. Chaque texte mène à sa page : son parcours, ce qui a été voté et le
            résultat.
          </Text>
        </Box>

        <Stack gap="sm">
          <TextInput
            placeholder="Chercher une loi par son titre, par exemple « retraites »"
            aria-label="Chercher une loi par son titre"
            leftSection={<IconSearch size={16} />}
            defaultValue={q}
            onChange={(evenement) => setSaisie(evenement.currentTarget.value)}
            onKeyDown={(evenement) => {
              if (evenement.key === "Enter") changer({ q: saisie });
            }}
          />
          <Group justify="space-between" gap="sm">
            <SegmentedControl
              size="xs"
              value={String(leg)}
              onChange={(v) => changer({ leg: Number(v) })}
              data={[
                { value: "0", label: "Toutes" },
                ...LEGISLATURES_LISTE.map((l) => ({
                  value: String(l),
                  label: LIBELLE_LEGISLATURE[l] ?? String(l),
                })),
              ]}
            />
            <Checkbox
              size="xs"
              label="Inclure les résolutions et autres procédures"
              checked={tout}
              onChange={(e) => changer({ tout: e.currentTarget.checked })}
            />
          </Group>
          <Text size="sm" c="dimmed">
            {nombre.format(donnees.total)} texte{donnees.total > 1 ? "s" : ""}
            {q ? ` pour « ${q} »` : ""}
          </Text>
        </Stack>

        <TableDossiers donnees={donnees} recherche={q} />

        {donnees.nombrePages > 1 && (
          <Group justify="center">
            <Pagination
              total={donnees.nombrePages}
              value={donnees.page}
              onChange={(page) =>
                void navigate({ search: (precedent) => ({ ...precedent, page }) })
              }
            />
          </Group>
        )}
      </Stack>
    </Container>
  );
}

function TableDossiers({ donnees, recherche }: { donnees: ListeDossiers; recherche: string }) {
  if (donnees.dossiers.length === 0) {
    return (
      <Text c="dimmed">
        {recherche
          ? "Aucune loi ne correspond à cette recherche. Essayez un mot plus court ou retirez les filtres."
          : "La liste des lois n'est pas disponible dans cet environnement : les données de l'Assemblée n'y sont pas chargées."}
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={640}>
      <Table verticalSpacing="sm" horizontalSpacing="sm" withRowBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Texte</Table.Th>
            <Table.Th>Résultat</Table.Th>
            <Table.Th>Dernière étape</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {donnees.dossiers.map((dossier) => (
            <Table.Tr key={dossier.uid}>
              <Table.Td maw={520}>
                <Anchor href={`/lois/${dossier.uid}`}>{dossier.titre ?? dossier.uid}</Anchor>
              </Table.Td>
              <Table.Td>
                {dossier.statut ? (
                  <Badge
                    variant={dossier.statut.adopte ? "filled" : "outline"}
                    color={dossier.statut.adopte ? "encre" : "graphite"}
                    tt="none"
                  >
                    {dossier.statut.libelle}
                  </Badge>
                ) : (
                  <Text size="sm" c="dimmed">
                    Pas de vote sur l&apos;ensemble
                  </Text>
                )}
              </Table.Td>
              <Table.Td c="dimmed">
                {dossier.derniereDate ? formaterDate(dossier.derniereDate) : "-"}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
