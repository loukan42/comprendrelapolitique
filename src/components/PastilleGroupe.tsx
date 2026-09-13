import { Box } from "@mantine/core";

/**
 * Pastille de couleur d'un groupe parlementaire.
 *
 * La couleur vient de `couleurAssociee` du référentiel des organes de
 * l'Assemblée nationale : c'est la seule convention de couleur de groupe
 * dont le projet dispose avec une source. Aucune teinte n'est choisie ici,
 * et un groupe dont la source ne donne pas de couleur n'en reçoit pas une
 * de remplacement (AGENTS.md section 4).
 *
 * La couleur ne porte jamais seule l'information : le nom du groupe est
 * toujours écrit à côté, pour les lecteurs qui ne distinguent pas ces
 * teintes comme pour ceux qui ne connaissent pas la convention.
 */
export function PastilleGroupe({ couleur }: { couleur: string | null }) {
  if (!couleur) return null;
  return (
    <Box
      aria-hidden
      style={{
        width: 10,
        height: 10,
        borderRadius: "50%",
        backgroundColor: couleur,
        flexShrink: 0,
      }}
    />
  );
}
