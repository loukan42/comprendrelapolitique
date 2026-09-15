import { useEffect, useState } from "react";
import { chargerNuageScrutins, type DonneesNuage } from "../queries/nuage";

/**
 * Charge le nuage après l'affichage de la page. Tant qu'il n'est pas là, la
 * page est complète : le nuage n'illustre que ce que le texte dit déjà.
 */
export function useNuageScrutins(): DonneesNuage | null {
  const [donnees, setDonnees] = useState<DonneesNuage | null>(null);
  useEffect(() => {
    let actif = true;
    chargerNuageScrutins()
      .then((d) => {
        if (actif) setDonnees(d);
      })
      .catch(() => undefined);
    return () => {
      actif = false;
    };
  }, []);
  return donnees;
}
