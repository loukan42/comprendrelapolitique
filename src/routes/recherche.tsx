import { Box, Container, Loader, Stack, Text, TextInput, Title } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { CarteLien } from "../components/CarteLien";
import { chercherDossiers, type DossierListe } from "../queries/lois";

const rechercheSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/recherche")({
  validateSearch: rechercheSchema,
  component: PageRecherche,
});

function PageRecherche() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [saisie, setSaisie] = useState(q ?? "");
  const [terme] = useDebouncedValue(saisie, 250);
  const [resultats, setResultats] = useState<DossierListe[]>([]);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    navigate({ search: terme ? { q: terme } : {}, replace: true });
    if (terme.trim().length < 2) {
      setResultats([]);
      return;
    }
    let annule = false;
    setEnCours(true);
    chercherDossiers({ data: terme })
      .then((r) => {
        if (!annule) setResultats(r);
      })
      .finally(() => {
        if (!annule) setEnCours(false);
      });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terme]);

  return (
    <Container size="md" py={{ base: 32, sm: 56 }}>
      <Stack gap="xl">
        <Box maw="var(--mesure-texte)">
          <Title order={1}>Chercher une loi</Title>
          <Text mt="sm" c="dimmed">
            Par son titre, parmi les dossiers législatifs importés depuis l&apos;Assemblée
            nationale.
          </Text>
        </Box>

        <TextInput
          size="md"
          maw="var(--mesure-texte)"
          placeholder="Ex. retraites, immigration, formation des sages-femmes…"
          value={saisie}
          onChange={(e) => setSaisie(e.currentTarget.value)}
          leftSection={<IconSearch size={18} />}
          rightSection={enCours ? <Loader size="xs" /> : null}
          autoFocus
        />

        {terme.trim().length >= 2 && !enCours && resultats.length === 0 && (
          <Text c="dimmed">Aucun dossier ne correspond à «&nbsp;{terme}&nbsp;».</Text>
        )}

        <Stack gap="sm" maw="var(--mesure-texte)">
          {resultats.map((d) => (
            <CarteLien key={d.uid} href={`/lois/${d.uid}`} padding="md">
              <Text fw={600}>{d.titre ?? d.uid}</Text>
              {(d.procedureLibelle ?? d.legislature) && (
                <Text size="sm" c="dimmed" mt={2}>
                  {d.procedureLibelle}
                  {d.procedureLibelle && d.legislature !== null && " · "}
                  {d.legislature !== null && `${d.legislature}e législature`}
                </Text>
              )}
            </CarteLien>
          ))}
        </Stack>
      </Stack>
    </Container>
  );
}
