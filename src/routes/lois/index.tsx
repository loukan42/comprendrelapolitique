import {
  Anchor,
  Badge,
  Box,
  Container,
  Group,
  Pagination,
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

import { chargerListeDossiers, type ListeDossiers } from "../../lib/lois-liste.server";

interface RechercheLois {
  page: number;
  q: string;
}

const obtenirListeDossiers = createServerFn({ method: "GET" })
  .validator((data: { page: number; recherche: string | null }) => data)
  .handler(async ({ data }) => chargerListeDossiers(data));

export const Route = createFileRoute("/lois/")({
  validateSearch: (recherche: Record<string, unknown>): RechercheLois => {
    const page = Number(recherche["page"]);
    return {
      page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
      q: typeof recherche["q"] === "string" ? recherche["q"] : "",
    };
  },
  loaderDeps: ({ search }) => ({ page: search.page, q: search.q }),
  loader: ({ deps }) =>
    obtenirListeDossiers({ data: { page: deps.page, recherche: deps.q || null } }),
  component: PageListeLois,
});

const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});
const nombre = new Intl.NumberFormat("fr-FR");

function formaterDate(iso: string): string {
  return dateLongue.format(new Date(iso));
}

function PageListeLois() {
  const donnees = Route.useLoaderData();
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [saisie, setSaisie] = useState(q);

  function lancerRecherche(valeur: string) {
    void navigate({ search: (precedent) => ({ ...precedent, q: valeur, page: 1 }) });
  }

  return (
    <Container size="md" py={64}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Les dossiers législatifs</Title>
          <Text mt="sm" c="dimmed">
            {nombre.format(donnees.total)} dossiers de la XVIe législature, triés par score
            institutionnel décroissant. Ce score ne mesure que l&apos;attention institutionnelle
            reçue par un texte (vote sur l&apos;ensemble, loi de finances, promulgation, saisine du
            Conseil constitutionnel) : il ne couvre ni la couverture médiatique ni la portée du
            texte, deux dimensions pas encore calculées (docs/SCORING.md).
          </Text>
        </Box>

        <TextInput
          placeholder="Rechercher un dossier par titre"
          leftSection={<IconSearch size={16} />}
          defaultValue={q}
          onChange={(evenement) => setSaisie(evenement.currentTarget.value)}
          onKeyDown={(evenement) => {
            if (evenement.key === "Enter") lancerRecherche(saisie);
          }}
        />

        <TableDossiers donnees={donnees} />

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

function TableDossiers({ donnees }: { donnees: ListeDossiers }) {
  if (donnees.dossiers.length === 0) {
    return (
      <Text c="dimmed">
        Aucun dossier ne correspond à cette recherche parmi les dossiers dotés d&apos;un score
        institutionnel.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={640}>
      <Table verticalSpacing="sm" horizontalSpacing="sm" withRowBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Dossier</Table.Th>
            <Table.Th>Résultat</Table.Th>
            <Table.Th>Dernière étape connue</Table.Th>
            <Table.Th ta="right">Score institutionnel</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {donnees.dossiers.map((dossier) => (
            <Table.Tr key={dossier.uid}>
              <Table.Td maw={360}>
                <Anchor href={`/lois/${dossier.uid}`}>{dossier.titre ?? dossier.uid}</Anchor>
              </Table.Td>
              <Table.Td>
                {dossier.statut && (
                  <Badge
                    variant={dossier.statut.adopte ? "filled" : "outline"}
                    color={dossier.statut.adopte ? "encre" : "graphite"}
                    tt="none"
                  >
                    {dossier.statut.libelle}
                  </Badge>
                )}
              </Table.Td>
              <Table.Td c="dimmed">
                {dossier.derniereDate ? formaterDate(dossier.derniereDate) : "-"}
              </Table.Td>
              <Table.Td ta="right">{dossier.scoreInstitutionnel}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
