import { Anchor, Avatar, Group, Text } from "@mantine/core";

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
