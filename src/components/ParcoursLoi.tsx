import { Accordion, Box, Group, Table, Text, Title, VisuallyHidden } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { useMemo } from "react";
import type { ActeLoi } from "../queries/lois";
import classes from "./ParcoursLoi.module.css";

/**
 * Le parcours d'un texte : une frise des grandes étapes, puis le détail des
 * actes regroupés par lecture (docs/SPECIFICATION.md section 6).
 *
 * La frise est reconstituée à partir des codes d'actes publiés par
 * l'Assemblée nationale (docs/DATA_MODEL.md, table `acte_legislatif`). C'est
 * une lecture des codes, pas un référentiel officiel des étapes, et la page le
 * dit. Deux règles la gardent honnête :
 *
 * - une étape n'est cochée que si un acte la prouve ; une étape non cochée
 *   peut n'avoir pas été franchie ou ne pas être renseignée ;
 * - l'adoption définitive ne se déduit pas des votes, dont plusieurs jalonnent
 *   une navette sans être définitifs : elle n'est cochée que si le texte est
 *   passé devant le Conseil constitutionnel ou a été promulgué, ce qui suppose
 *   un texte définitivement adopté.
 */

type CleEtape =
  | "depot"
  | "commission"
  | "assemblee"
  | "senat"
  | "navette"
  | "adoption"
  | "conseil"
  | "promulgation";

const ETAPES: { cle: CleEtape; libelle: string }[] = [
  { cle: "depot", libelle: "Dépôt" },
  { cle: "commission", libelle: "Commission" },
  { cle: "assemblee", libelle: "Séance à l'Assemblée" },
  { cle: "senat", libelle: "Séance au Sénat" },
  { cle: "navette", libelle: "Navette ou CMP" },
  { cle: "adoption", libelle: "Adoption définitive" },
  { cle: "conseil", libelle: "Conseil constitutionnel" },
  { cle: "promulgation", libelle: "Promulgation" },
];

/**
 * Acte qui prouve chaque étape. `AN20` et `AN21` (engagement de
 * responsabilité) commencent par « AN2 » sans être une deuxième lecture : la
 * navette n'est reconnue qu'à un code de la forme `AN2-…`, `SN3-…`.
 */
const PREUVE: Record<Exclude<CleEtape, "adoption">, (code: string) => boolean> = {
  depot: (c) => c.includes("DEPOT"),
  commission: (c) => c.includes("-COM") && !c.startsWith("CMP"),
  assemblee: (c) => c.startsWith("AN") && c.includes("DEBATS"),
  senat: (c) => c.startsWith("SN") && c.includes("DEBATS"),
  navette: (c) => c.startsWith("CMP") || /^(AN|SN)[2-9]-/.test(c) || /^(AN|SN)(NLEC|LDEF)/.test(c),
  conseil: (c) => c.startsWith("CC"),
  promulgation: (c) => c.startsWith("PROM"),
};

/** Libellé d'une lecture d'après le préfixe du code. Un préfixe inconnu reste affiché tel quel. */
function libelleLecture(prefixe: string): string {
  const numero = /^(AN|SN)([1-9])$/.exec(prefixe);
  if (numero) {
    const rang = numero[2] === "1" ? "1re" : `${numero[2]}e`;
    return `${rang} lecture ${numero[1] === "AN" ? "à l'Assemblée nationale" : "au Sénat"}`;
  }
  const connus: Record<string, string> = {
    ANLUNI: "Lecture unique à l'Assemblée nationale",
    ANNLEC: "Nouvelle lecture à l'Assemblée nationale",
    SNNLEC: "Nouvelle lecture au Sénat",
    ANLDEF: "Lecture définitive à l'Assemblée nationale",
    CMP: "Commission mixte paritaire",
    AN21: "Engagement de la responsabilité du Gouvernement (article 49)",
    CC: "Conseil constitutionnel",
    PROM: "Promulgation",
  };
  return connus[prefixe] ?? `Autres étapes (code ${prefixe})`;
}

// Les dates d'acte portent un fuseau : lues à l'heure de Paris, pour que le
// jour affiché soit celui de la source, quel que soit le fuseau du lecteur.
const dateLongue = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** « 1er avril 2026 » : Intl écrit « 1 avril », l'usage veut l'ordinal. */
function formater(date: string | null): string {
  return date ? dateLongue.format(new Date(date)).replace(/^1 /, "1er ") : "";
}

function horodatage(date: string | null): number {
  return date ? new Date(date).getTime() : Number.POSITIVE_INFINITY;
}

export function ParcoursLoi({ actes }: { actes: ActeLoi[] }) {
  const etapes = useMemo(() => {
    const trouvees = new Map<CleEtape, string | null>();
    for (const [cle, prouve] of Object.entries(PREUVE) as [
      Exclude<CleEtape, "adoption">,
      (c: string) => boolean,
    ][]) {
      const preuves = actes.filter((a) => prouve(a.codeActe ?? ""));
      if (preuves.length > 0) {
        const premiere = [...preuves].sort(
          (x, y) => horodatage(x.dateActe) - horodatage(y.dateActe),
        )[0];
        trouvees.set(cle, premiere?.dateActe ?? null);
      }
    }
    if (trouvees.has("conseil") || trouvees.has("promulgation")) trouvees.set("adoption", null);
    return ETAPES.map((e) => ({
      ...e,
      franchie: trouvees.has(e.cle),
      date: trouvees.get(e.cle) ?? null,
    }));
  }, [actes]);

  const lectures = useMemo(() => {
    const groupes = new Map<string, ActeLoi[]>();
    for (const acte of actes) {
      const prefixe = (acte.codeActe ?? "?").split("-")[0] ?? "?";
      groupes.set(prefixe, [...(groupes.get(prefixe) ?? []), acte]);
    }
    return [...groupes.entries()]
      .map(([prefixe, liste]) => ({
        prefixe,
        libelle: libelleLecture(prefixe),
        actes: [...liste].sort((x, y) => horodatage(x.dateActe) - horodatage(y.dateActe)),
      }))
      .sort(
        (x, y) =>
          horodatage(x.actes[0]?.dateActe ?? null) - horodatage(y.actes[0]?.dateActe ?? null),
      );
  }, [actes]);

  if (actes.length === 0) {
    return (
      <Box>
        <Title order={2}>Parcours du texte</Title>
        <Text c="dimmed" mt="sm">
          Aucune étape de procédure n&apos;est enregistrée pour ce dossier dans la source.
        </Text>
      </Box>
    );
  }

  return (
    <Box>
      <Title order={2}>Parcours du texte</Title>
      <Box component="ol" className={classes["frise"]} mt="md">
        {etapes.map((e) => (
          <Box
            component="li"
            key={e.cle}
            className={`${classes["etape"]} ${e.franchie ? classes["franchie"] : ""}`}
          >
            <Group gap={6} wrap="nowrap" align="flex-start">
              {e.franchie && <IconCheck size={16} aria-hidden className={classes["coche"]} />}
              <Text size="sm" fw={e.franchie ? 600 : 400} c={e.franchie ? "inherit" : "dimmed"}>
                {e.libelle}
                <VisuallyHidden>
                  {e.franchie ? " : étape franchie" : " : non franchie ou non renseignée"}
                </VisuallyHidden>
              </Text>
            </Group>
            {e.date && (
              <Text size="xs" c="dimmed" mt={2}>
                {formater(e.date)}
              </Text>
            )}
          </Box>
        ))}
      </Box>
      <Text size="xs" c="dimmed" mt="sm" maw="var(--mesure-texte)">
        Frise reconstituée à partir des actes de procédure publiés par l&apos;Assemblée nationale.
        Une étape non cochée n&apos;a pas été franchie ou n&apos;est pas renseignée dans la source.
      </Text>

      <Accordion variant="separated" multiple mt="lg">
        {lectures.map((l) => (
          <Accordion.Item key={l.prefixe} value={l.prefixe}>
            <Accordion.Control>
              <Text fw={600} size="sm">
                {l.libelle}
                <Text span c="dimmed" fw={400}>
                  {" "}
                  · {l.actes.length} acte{l.actes.length > 1 ? "s" : ""}
                </Text>
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Table.ScrollContainer minWidth={320}>
                <Table verticalSpacing={6} horizontalSpacing="sm">
                  <Table.Tbody>
                    {l.actes.map((a) => (
                      <Table.Tr key={a.uid}>
                        <Table.Td c="dimmed" w="11rem">
                          {formater(a.dateActe)}
                        </Table.Td>
                        <Table.Td>{a.libelleCanonique ?? a.libelleCourt ?? a.codeActe}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Box>
  );
}
