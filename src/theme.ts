import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * Thème du site. Source unique : une couleur, un espacement ou une taille qui
 * n'existe pas ici n'existe pas dans le site.
 */

/**
 * L'accent : un bleu d'encre très désaturé.
 *
 * Le choix est contraint par le sujet. En France, le bleu, le rouge, le rose et
 * le vert saturés se lisent comme des appartenances politiques avant d'être lus
 * comme des choix graphiques. Un accent partisan sur un site qui prétend
 * expliquer la politique est un message, pas une décoration.
 *
 * Cette teinte tire vers le gris-ardoise : elle évoque l'encre d'imprimerie
 * plutôt qu'un parti, et reste assez distincte du texte pour signaler un lien ou
 * un état actif.
 *
 * Elle est réservée à l'interaction — lien, focus, état actif, élément
 * sélectionné. Jamais à la décoration.
 */
const encre: MantineColorsTuple = [
  "#f2f4f7",
  "#e3e7ee",
  "#c5ccda",
  "#a4b0c5",
  "#8998b3",
  "#7789a8",
  "#6c80a2",
  "#5b6d8e",
  "#4f6180",
  "#415372",
];

/**
 * Les gris. Presque-noir sur blanc cassé : le blanc pur fatigue en lecture
 * longue, et le noir pur durcit inutilement le contraste.
 */
const graphite: MantineColorsTuple = [
  "#f6f6f5",
  "#e8e8e6",
  "#d1d1cd",
  "#b8b8b2",
  "#a3a39c",
  "#97978f",
  "#90908a",
  "#7d7d76",
  "#6f6f68",
  "#605f59",
];

export const theme = createTheme({
  primaryColor: "encre",
  primaryShade: { light: 8, dark: 4 },
  colors: { encre, graphite },

  white: "#fdfdfc",
  black: "#16161a",

  // Une seule famille, hiérarchisée par la taille et la graisse. Aucune police
  // distante n'est chargée pour l'instant : ce choix se fera en connaissance de
  // son coût, pas par défaut.
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',

  headings: {
    fontWeight: "650",
    sizes: {
      h1: { fontSize: "2.25rem", lineHeight: "1.2" },
      h2: { fontSize: "1.625rem", lineHeight: "1.3" },
      h3: { fontSize: "1.25rem", lineHeight: "1.4" },
      h4: { fontSize: "1.0625rem", lineHeight: "1.45" },
    },
  },

  // Interligne large : le site est fait pour être lu, pas parcouru.
  lineHeights: { xs: "1.5", sm: "1.55", md: "1.65", lg: "1.7", xl: "1.75" },

  // Rayons discrets. L'arrondi maximal sur tout est un marqueur de page générée.
  defaultRadius: "sm",
  radius: { xs: "2px", sm: "3px", md: "5px", lg: "8px", xl: "12px" },

  // Aucune ombre par défaut : elle est réservée à ce qui flotte réellement,
  // menu, modale, popover — que Mantine gère de lui-même.
  shadows: {
    xs: "0 1px 2px rgba(22, 22, 26, 0.06)",
    sm: "0 2px 6px rgba(22, 22, 26, 0.08)",
    md: "0 4px 12px rgba(22, 22, 26, 0.10)",
    lg: "0 8px 24px rgba(22, 22, 26, 0.12)",
    xl: "0 16px 40px rgba(22, 22, 26, 0.14)",
  },

  components: {
    Anchor: {
      defaultProps: { underline: "always" },
    },
    Container: {
      defaultProps: { size: "md" },
    },
  },

  other: {
    /** Mesure de lecture du corps de texte, en accord avec styles.css. */
    mesureTexte: "68ch",

    /**
     * Couleurs des groupes parlementaires — délibérément vide.
     *
     * Ces couleurs n'ont leur place que dans les visualisations où elles
     * représentent effectivement ces groupes, accompagnées de leur nom. Les
     * inventer maintenant reviendrait à attribuer une identité visuelle à des
     * formations réelles sans convention documentée : l'Assemblée n'en publie
     * pas. Elles seront renseignées avec leur source le jour où un graphique en
     * aura besoin.
     */
    couleursGroupes: {} as Record<string, string>,
  },
});
