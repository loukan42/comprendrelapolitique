import { createTheme, type MantineColorsTuple } from "@mantine/core";

/**
 * Thème du site. Source unique : une couleur, un espacement ou une taille qui
 * n'existe pas ici n'existe pas dans le site.
 *
 * Direction visuelle : un fond noir pur, du texte blanc, de très grands titres
 * en graisse normale à l'interlettrage resserré, un corps de texte très léger,
 * des surfaces sans fond, et un seul accent réservé à l'interaction. Elle
 * reprend le système Dala (styles.refero.design), adapté aux contraintes
 * d'AGENTS.md :
 *
 * - l'accent violet saturé de la référence est remplacé par son ambre, de la
 *   famille ocre autorisée par la section 4 : un violet saturé sur noir tombe
 *   sous l'interdit « néon et couleurs saturées sur fond sombre » ;
 * - la constellation de particules animées, image signature de la référence,
 *   n'est pas reprise : c'est une illustration décorative, bannie par la
 *   section 2 ;
 * - rien n'est coloré pour décorer, y compris les petits libellés que la
 *   référence passe en ambre.
 */

/**
 * L'accent : un ambre safran, réservé à l'interaction (bouton principal,
 * lien, focus). Jamais à la décoration.
 *
 * En France, le bleu, le rouge, le rose et le vert saturés se lisent comme
 * des appartenances politiques avant d'être lus comme des choix graphiques.
 * L'ambre n'est la couleur d'aucune grande formation, et sur fond noir il
 * reste lisible : la nuance 6, celle des boutons pleins, porte un texte noir
 * à un contraste supérieur à 11.
 */
const safran: MantineColorsTuple = [
  "#fff8e6",
  "#ffefc2",
  "#ffe29a",
  "#ffd46d",
  "#ffc649",
  "#ffbc33",
  "#ffb829",
  "#e3a120",
  "#c98d17",
  "#ad780c",
];

/**
 * Les gris du thème sombre, que Mantine lit dans la palette `dark` : la
 * nuance 7 est le fond, la 6 celui des champs, la 4 les filets, la 2 le texte
 * atténué, la 0 le texte.
 *
 * Le fond est un noir pur : il sert de matière et non de vide. Le texte
 * atténué (#9a9a9a) garde un contraste de 7,4 sur ce fond, au-dessus du seuil
 * AAA exigé pour le corps de texte.
 */
const dark: MantineColorsTuple = [
  "#ffffff",
  "#bdbdbd",
  "#9a9a9a",
  "#6e6e6e",
  "#262626",
  "#1a1a1a",
  "#0b0b0b",
  "#000000",
  "#000000",
  "#000000",
];

/** L'encre désaturée, ancien accent, conservée pour les usages nommés. */
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
  primaryColor: "safran",
  primaryShade: { light: 8, dark: 6 },
  colors: { safran, dark, encre, graphite, ocre },

  white: "#f7f5f0",
  black: "#0b0b0b",

  // Une seule famille, Inter, substitut désigné du caractère de la référence.
  // Elle est servie par le site lui-même (paquet @fontsource-variable/inter,
  // importé dans __root.tsx), jamais depuis Google Fonts : un chargement
  // distant transmettrait l'adresse IP de chaque lecteur à un tiers, ce que
  // le tribunal régional de Munich a jugé contraire au RGPD le 20 janvier 2022.
  fontFamily:
    '"Inter Variable", Inter, "Helvetica Neue", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',

  // Échelle de la référence : 12, 14, 18, 24, 27 px. Le corps est à 18 px.
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    md: "1.125rem",
    lg: "1.5rem",
    xl: "1.6875rem",
  },

  // La hiérarchie passe par l'échelle et non par la graisse : les titres sont
  // en graisse normale, très grands, et se resserrent (voir styles.css). Le
  // titre de page se réduit sur petit écran pour tenir à 320 px.
  headings: {
    fontWeight: "400",
    sizes: {
      h1: { fontSize: "clamp(2.75rem, 1.5rem + 5vw, 5.5rem)", lineHeight: "1.02" },
      h2: { fontSize: "clamp(1.875rem, 1.4rem + 2vw, 3rem)", lineHeight: "1.1" },
      h3: { fontSize: "1.5rem", lineHeight: "1.25" },
      h4: { fontSize: "1.125rem", lineHeight: "1.35" },
    },
  },

  lineHeights: { xs: "1.5", sm: "1.5", md: "1.6", lg: "1.65", xl: "1.7" },

  // Espacements sur une base de 6 px, comme la référence : 6, 12, 18, 24, 36.
  spacing: {
    xs: "0.375rem",
    sm: "0.75rem",
    md: "1.125rem",
    lg: "1.5rem",
    xl: "2.25rem",
  },

  // La pastille est réservée aux boutons et aux badges, pas étendue à tout ;
  // les surfaces gardent un arrondi modéré.
  defaultRadius: "sm",
  radius: { xs: "2px", sm: "6px", md: "16px", lg: "20px", xl: "24px" },

  // Aucune ombre par défaut : la référence n'en a aucune, et AGENTS.md la
  // réserve à ce qui flotte réellement (menu, modale, popover).
  shadows: {
    xs: "0 1px 2px rgba(0, 0, 0, 0.4)",
    sm: "0 2px 6px rgba(0, 0, 0, 0.45)",
    md: "0 4px 12px rgba(0, 0, 0, 0.5)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.55)",
    xl: "0 16px 40px rgba(0, 0, 0, 0.6)",
  },

  components: {
    Anchor: {
      defaultProps: { underline: "always" },
    },
    Container: {
      defaultProps: { size: "md" },
    },
    // Boutons en pastille, libellé en capitales espacées : c'est ce qui les
    // distingue du texte courant sans couleur supplémentaire.
    Button: {
      defaultProps: { radius: "xl", size: "md" },
      styles: {
        label: { textTransform: "uppercase", letterSpacing: "0.025em", fontWeight: 600 },
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
     * groupes. Elles encodent un sens de vote, pas une appartenance : le
     * vert et le rouge sont ici la convention d'un scrutin (le tableau de
     * vote d'un parlement), pas une couleur de parti, et la légende écrit
     * toujours le mot à côté de la pastille pour que la couleur ne porte
     * jamais seule l'information.
     *
     * Le bleu et le rouge en duo sont écartés : en France, ce couple se lit
     * comme droite/gauche avant de se lire comme pour/contre (AGENTS.md
     * section 4).
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
     * depuis la base à l'affichage (composant `PastilleGroupe`). Un groupe
     * dont la source ne donne pas de couleur n'en reçoit pas une choisie ici,
     * et aucune table de correspondance écrite à la main ne double celle de
     * la source.
     */
  },
});
