import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * Thème du site. Source unique : une couleur, un espacement ou une taille qui
 * n'existe pas ici n'existe pas dans le site.
 *
 * Direction visuelle : un fond noir pur, du texte blanc, de grands titres en
 * graisse normale à l'interlettrage resserré, un corps de texte léger, des
 * surfaces sans fond. Elle reprend le système Dala (styles.refero.design).
 *
 * Les boutons et les liens reprennent les deux couleurs du logo Politiquizz,
 * le bleu marine et le rouge, à la demande du porteur du projet
 * (14 septembre 2026). C'est un écart assumé avec AGENTS.md section 4, qui
 * déconseille le bleu et le rouge comme accent : ils sont ici l'identité de la
 * marque, déjà portée par le logo, et restent réservés à l'interaction.
 *
 * La constellation de particules animées de la référence n'est pas reprise :
 * c'est une illustration décorative, bannie par AGENTS.md section 2.
 */

/**
 * Le corail de marque, couleur des boutons pleins et du focus. Un texte blanc
 * y garde un contraste suffisant pour les actions.
 */
const rouge: MantineColorsTuple = [
  "#fff1ef",
  "#fbdedb",
  "#f4bcb6",
  "#eb9890",
  "#df786f",
  "#d3675f",
  "#c95750",
  "#bc4b45",
  "#a6403b",
  "#8c3531",
];

/**
 * Le bleu-gris de marque, éclairci pour les liens afin de rester lisible sur
 * la surface sombre.
 */
const bleu: MantineColorsTuple = [
  "#edf2f7",
  "#d9e2ed",
  "#b5c5d7",
  "#8ea4bb",
  "#718aa5",
  "#607b98",
  "#526d8a",
  "#46617d",
  "#3a536f",
  "#2f435a",
];

/**
 * Les gris du thème sombre, que Mantine lit dans la palette `dark` : la
 * nuance 7 est le fond, la 6 celui des champs, la 4 les filets, la 2 le texte
 * atténué, la 0 le texte.
 *
 * Le fond est un bleu-noir doux. Le texte atténué reste contrasté pour le
 * corps de texte.
 */
const dark: MantineColorsTuple = [
  "#f8fafc",
  "#cbd2dc",
  "#9ea8b6",
  "#6f7a89",
  "#3b4552",
  "#28313d",
  "#1c232d",
  "#151b23",
  "#10151c",
  "#0c1117",
];

/** L'encre désaturée, ancien accent, conservée pour les usages nommés. */
const encre: MantineColorsTuple = [
  "#f1f4f7",
  "#e0e6ec",
  "#c3ced9",
  "#a4b3c2",
  "#8c9dad",
  "#778a9c",
  "#687d91",
  "#5b7084",
  "#506579",
  "#45596c",
];

/** Les gris neutres, pour les badges et alertes sans valeur de sens. */
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

/**
 * Ocre : seul accent utilisé pour distinguer visuellement deux catégories de
 * vote (POUR / CONTRE) l'une de l'autre. Choisie dans la liste des teintes
 * explicitement autorisées par AGENTS.md section 4 (« gris-ardoise,
 * bleu-encre très désaturé, ocre »), jamais une couleur de parti.
 */
const ocre: MantineColorsTuple = [
  "#faf6ef",
  "#f0e6d3",
  "#e2cca8",
  "#d2af7a",
  "#c59858",
  "#bc8a43",
  "#b78239",
  "#a06e2b",
  "#8f6122",
  "#7c5111",
];

export const theme = createTheme({
  primaryColor: "rouge",
  primaryShade: { light: 7, dark: 7 },
  colors: { rouge, bleu, dark, encre, graphite, ocre },

  white: "#ffffff",
  black: "#10151c",

  // Une seule famille, Inter, substitut désigné du caractère de la référence.
  // Elle est servie par le site lui-même (paquet @fontsource-variable/inter,
  // importé dans __root.tsx), jamais depuis Google Fonts : un chargement
  // distant transmettrait l'adresse IP de chaque lecteur à un tiers, ce que
  // le tribunal régional de Munich a jugé contraire au RGPD le 20 janvier 2022.
  fontFamily:
    '"Inter Variable", Inter, "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',

  // Corps à 18 px, comme la référence ; les grandes tailles de texte courant
  // restent modérées pour ne pas concurrencer les titres.
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1.125rem",
    lg: "1.3125rem",
    xl: "1.5rem",
  },

  // La hiérarchie passe par l'échelle et non par la graisse. Le plafond du
  // titre de page reste raisonnable : le site a des titres longs (intitulés
  // de loi, questions), qu'une taille d'affiche ferait éclater sur six lignes.
  headings: {
    fontWeight: "400",
    sizes: {
      h1: { fontSize: "clamp(2.125rem, 1.4rem + 2.4vw, 3.5rem)", lineHeight: "1.08" },
      // 42 px au plus, la taille des titres de section de la référence.
      h2: { fontSize: "clamp(1.75rem, 1.2rem + 1.6vw, 2.625rem)", lineHeight: "1.15" },
      h3: { fontSize: "1.375rem", lineHeight: "1.3" },
      h4: { fontSize: "1.125rem", lineHeight: "1.35" },
    },
  },

  lineHeights: { xs: "1.5", sm: "1.5", md: "1.6", lg: "1.6", xl: "1.6" },

  // Espacements sur une base de 6 px, comme la référence : 6, 12, 18, 24, 36.
  spacing: {
    xs: "0.375rem",
    sm: "0.75rem",
    md: "1.125rem",
    lg: "1.5rem",
    xl: "2.25rem",
  },

  // La pastille est réservée aux boutons et aux badges ; les surfaces gardent
  // un arrondi modéré.
  defaultRadius: "sm",
  radius: { xs: "2px", sm: "6px", md: "16px", lg: "20px", xl: "24px" },

  // Aucune ombre par défaut : elle est réservée à ce qui flotte réellement.
  shadows: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.4)",
    sm: "0 2px 6px rgba(0, 0, 0, 0.45)",
    md: "0 4px 12px rgba(0, 0, 0, 0.5)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.55)",
    xl: "0 16px 40px rgba(0, 0, 0, 0.6)",
  },

  components: {
    // Les liens prennent le bleu du logo, éclairci pour rester lisible.
    Anchor: {
      defaultProps: { underline: "always", c: "bleu.3" },
    },
    Container: {
      defaultProps: { size: "md" },
    },
    // Boutons en pastille. Le libellé doit toujours tenir dans le bouton : il
    // passe à la ligne plutôt que de déborder, et la hauteur suit, la hauteur
    // normale du bouton restant le minimum.
    Button: {
      defaultProps: { radius: "xl", size: "md" },
      styles: {
        root: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          height: "auto",
          minHeight: "var(--button-height)",
          paddingBlock: "0.5rem",
        },
        inner: { height: "auto", width: "100%", justifyContent: "center" },
        // Libellé en 14 px, capitales espacées, comme la pastille de la
        // référence : à la taille du corps (18 px), il passait sur deux lignes.
        label: {
          whiteSpace: "normal",
          textAlign: "center",
          justifyContent: "center",
          lineHeight: 1.25,
          fontSize: "var(--mantine-font-size-sm)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          overflow: "visible",
        },
      },
    },
    Badge: {
      defaultProps: { radius: "xl" },
    },
    // Les cartes n'ont pas de fond : le contenu flotte sur le noir, et seul un
    // filet à 1 px, quand la page le demande, sépare les blocs.
    Card: {
      styles: {
        root: { backgroundColor: "transparent" },
      },
    },
  },

  other: {
    /** Mesure de lecture du corps de texte, en accord avec styles.css. */
    mesureTexte: "68ch",

    /**
     * Couleurs des positions de vote : pour, contre, abstention, non-votant.
     *
     * Ce sont les seules couleurs signifiantes du site avec celles des
     * groupes. Elles encodent un sens de vote, pas une appartenance, et la
     * légende écrit toujours le mot à côté de la pastille pour que la couleur
     * ne porte jamais seule l'information.
     *
     * Teintes vérifiées sur fond clair comme sur fond sombre.
     */
    couleursVote: {
      pour: "#2f8a5b",
      contre: "#b4453c",
      abstention: "#c08a2e",
      nonVotant: "transparent",
    },

    /**
     * Les couleurs de groupe ne figurent pas ici : elles sont une donnée, pas
     * un choix graphique. L'Assemblée publie `couleurAssociee` dans son
     * référentiel des organes, importé dans `officiel.organe.couleur` et lu
     * depuis la base à l'affichage (composant `PastilleGroupe`).
     */
  },
});
