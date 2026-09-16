import { Anchor, Avatar, Group, Stack, Text } from "@mantine/core";

interface Portrait {
  image: string;
  source: string;
  credit: string;
}

const portrait = (fichier: string, credit: string): Portrait => ({
  image: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fichier)}?width=240`,
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fichier).replace(/%20/g, "_")}`,
  credit,
});

/** Photos réutilisables publiées sur Wikimedia Commons, avec leur page source. */
const PORTRAITS: Record<string, Portrait> = {
  "Jean-Luc Mélenchon": portrait("Jean-Luc Mélenchon 2009.jpg", "Parlement européen"),
  "Marine Le Pen": portrait("Marine Le Pen 2010.jpg", "Marie-Lan Nguyen"),
  "Fabien Roussel": portrait("Fabien Roussel 2022.jpg", "Parti communiste français"),
  "Gabriel Attal": portrait("Gabriel Attal.jpg", "Antoine Lamielle"),
  "Édouard Philippe": portrait("Edouard Philippe(0).jpg", "Wasasaq8"),
  "Bruno Retailleau": portrait(
    "Bruno Retailleau, portrait 2024 (cropped).jpg",
    "Andy Taylor / UK Home Office",
  ),
  "David Lisnard": portrait("David Lisnard.jpg", "Marie Tavares"),
  "Marine Tondelier": portrait("Marine Tondelier.jpg", "François Nicolas"),
  "Raphaël Glucksmann": portrait("Raphaël Glucksmann.jpg", "Librairie Mollat"),
  "Jérôme Guedj": portrait("Jérôme Guedj 2010.jpg", "Audrey AK"),
  "Philippe Brun": portrait(
    "LOUVIERS - 4e circo Eure - Philippe Brun nouveau député 22 juin 2022 (1) (cropped).jpg",
    "Pierre2777",
  ),
  "Fabien Verdier": portrait("Fabien Verdier Primaire socialiste.jpg", "Wikimedia Commons"),
  "Emmanuel Maurel": portrait("Emmanuel Maurel en 2016.jpg", "Echwander"),
  "François Ruffin": portrait("François Ruffin (cropped).jpg", "Thinkerview"),
  "Delphine Batho": portrait("Delphine Batho (cropped).png", "DeuxSevres79"),
};

interface Logo {
  image: string;
  source: string;
}

const logo = (fichier: string): Logo => ({
  image: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fichier)}?width=240`,
  source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fichier).replace(/%20/g, "_")}`,
});

/** Logos de formations, avec un repli textuel si Commons est indisponible. */
const LOGOS: Record<string, Logo> = {
  "La France insoumise": logo("Logo France Insoumise.svg"),
  "Rassemblement National": logo("Logo Rassemblement National.svg"),
  "Parti socialiste": logo("Logo du Parti socialiste.png"),
  "Parti communiste français": logo("Logo du Parti communiste français.svg"),
  "Les Républicains": logo("Logo Les Républicains.svg"),
  Horizons: logo("Logo Horizons (parti politique).svg"),
  Renaissance: logo("Logo Renaissance (parti).svg"),
  "Place publique": logo("Logo Place publique.svg"),
  "Nouvelle Énergie": logo("Logo Nouvelle Énergie.svg"),
};

const SIGLES: Record<string, string> = {
  "La France insoumise": "LFI",
  "Rassemblement National": "RN",
  "Parti socialiste": "PS",
  "Parti communiste français": "PCF",
  "Les Républicains": "LR",
  Horizons: "H",
  Renaissance: "REN",
  "Place publique": "PP",
  "Nouvelle Énergie": "NE",
};

function initiales(nom: string): string {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((mot) => mot[0])
    .join("")
    .toUpperCase();
}

export function PortraitCandidat({
  nom,
  taille = "md",
  afficherNom = false,
}: {
  nom: string | null | undefined;
  taille?: "sm" | "md" | "lg" | "xl";
  afficherNom?: boolean;
}) {
  if (!nom) return null;
  const p = PORTRAITS[nom];
  const image = (
    <Avatar src={p?.image ?? null} alt={`Portrait de ${nom}`} size={taille} color="graphite">
      {initiales(nom)}
    </Avatar>
  );
  return (
    <Group gap="sm" wrap="nowrap">
      {p ? (
        <Anchor href={p.source} target="_blank" rel="noreferrer" title={`Photo : ${p.credit}`}>
          {image}
        </Anchor>
      ) : (
        image
      )}
      {afficherNom && <Text fw={600}>{nom}</Text>}
    </Group>
  );
}

export function LogoFormation({
  formation,
  taille = "md",
}: {
  formation: string;
  taille?: "sm" | "md" | "lg";
}) {
  const l = LOGOS[formation];
  const image = (
    <Avatar
      src={l?.image ?? null}
      alt={`Logo de ${formation}`}
      size={taille}
      radius="sm"
      color="graphite"
      variant="light"
    >
      {SIGLES[formation] ?? initiales(formation)}
    </Avatar>
  );
  return l ? (
    <Anchor href={l.source} target="_blank" rel="noreferrer" title={`Logo : ${formation}`}>
      {image}
    </Anchor>
  ) : (
    image
  );
}

/** Identité compacte utilisée dans les résultats et les duels. */
export function IdentiteFormation({
  formation,
  candidat,
  taille = "md",
}: {
  formation: string;
  candidat?: string | null;
  taille?: "sm" | "md" | "lg";
}) {
  return (
    <Group gap="sm" wrap="nowrap" align="center">
      <LogoFormation formation={formation} taille={taille === "lg" ? "md" : "sm"} />
      {candidat ? <PortraitCandidat nom={candidat} taille={taille} /> : null}
      <Stack gap={0} style={{ minWidth: 0 }}>
        {candidat && (
          <Text size="sm" fw={700}>
            {candidat}
          </Text>
        )}
        <Text size="xs" c="dimmed" fw={candidat ? 400 : 700} truncate>
          {formation}
        </Text>
      </Stack>
    </Group>
  );
}
