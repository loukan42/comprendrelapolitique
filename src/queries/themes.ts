/**
 * Attribution thématique des dossiers, par mots-clés sur leur titre.
 *
 * Aucune table `theme` n'existe dans le schéma : c'est un classement
 * automatique et provisoire, pas une donnée officielle. Il sert uniquement à
 * équilibrer les thèmes du grand quiz (spec section 6 : « éviter que 8
 * questions sur 20 parlent du même sujet »), jamais affiché comme une
 * vérité éditoriale. Un dossier peut correspondre à plusieurs thèmes ; on ne
 * retient que le premier trouvé, dans l'ordre de la liste ci-dessous.
 *
 * Les mots-clés matchent sur le mot entier (pas de sous-chaîne) : sans cette
 * précaution, « réemploi » matchait « emploi » (thème travail) et un dossier
 * sur le réemploi de véhicules se retrouvait classé à tort. Même logique
 * pour éviter que « sécurité sanitaire » ou « sécurité sociale » ne
 * matchent le mot isolé « sécurité » (thème sécurité) : les mots-clés visant
 * un thème sensible aux faux positifs sont des expressions plus précises
 * plutôt qu'un mot générique seul.
 */

export interface Theme {
  slug: string;
  libelle: string;
  motsCles: string[];
}

export const THEMES: Theme[] = [
  {
    slug: "sante",
    libelle: "Santé",
    motsCles: ["santé", "hôpital", "hospitali", "médic", "soin", "patient", "pharmac"],
  },
  {
    slug: "securite",
    libelle: "Sécurité",
    motsCles: ["délinquance", "gendarmerie", "terroris", "cambriolage", "pénitentiaire", "polic"],
  },
  {
    slug: "education",
    libelle: "Éducation",
    motsCles: [
      "éducation",
      "école",
      "scolaire",
      "enseignant",
      "université",
      "étudiant",
      "collège",
      "lycée",
    ],
  },
  { slug: "retraites", libelle: "Retraites", motsCles: ["retraite"] },
  {
    slug: "travail",
    libelle: "Travail",
    motsCles: ["travail", "emploi", "chômage", "salarié", "syndical", "licenciement"],
  },
  {
    slug: "logement",
    libelle: "Logement",
    motsCles: ["logement", "loyer", "habitat", "hébergement", "hlm"],
  },
  {
    slug: "immigration",
    libelle: "Immigration",
    motsCles: ["immigration", "étranger", "asile", "expulsion", "régularisation"],
  },
  {
    slug: "justice",
    libelle: "Justice",
    motsCles: ["justice", "tribunal", "magistrat", "pénal", "juridiction"],
  },
  {
    slug: "environnement",
    libelle: "Environnement",
    motsCles: ["environnement", "climat", "biodiversité", "pollution", "écolog"],
  },
  {
    slug: "energie",
    libelle: "Énergie",
    motsCles: ["énergie", "nucléaire", "électricité", "électrique", "renouvelable", "pétrole"],
  },
  {
    slug: "entreprises",
    libelle: "Entreprises",
    motsCles: ["entreprise", "pme", "tpe", "industrie", "commerce"],
  },
  {
    slug: "impots",
    libelle: "Impôts",
    motsCles: ["impôt", "fiscal", "taxe", "tva", "prélèvement"],
  },
  { slug: "pouvoir_achat", libelle: "Pouvoir d'achat", motsCles: ["inflation", "smic"] },
  { slug: "europe", libelle: "Europe", motsCles: ["europe", "européenne", "européen"] },
  {
    slug: "institutions",
    libelle: "Institutions",
    motsCles: ["constitution", "élection", "référendum", "collectivité", "décentralisation"],
  },
  {
    slug: "economie",
    libelle: "Économie",
    motsCles: ["économie", "croissance", "budget", "finances publiques", "dette"],
  },
];

const THEME_PAR_SLUG = new Map(THEMES.map((t) => [t.slug, t]));

export function themeParSlug(slug: string): Theme | undefined {
  return THEME_PAR_SLUG.get(slug);
}

/** Vrai si `mot` apparaît dans `texte` comme mot entier (ou début de mot pour
 *  les racines comme « écolog », qui doivent matcher « écologique »). */
function contientMot(texte: string, mot: string): boolean {
  const echappe = mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![a-zà-ÿ])${echappe}`, "i").test(texte);
}

/** Renvoie le premier thème dont un mot-clé apparaît dans le titre, sinon `null`. */
export function themeDepuisTitre(titre: string | null): string | null {
  if (!titre) return null;
  const t = titre.toLowerCase();
  for (const theme of THEMES) {
    if (theme.motsCles.some((mot) => contientMot(t, mot))) return theme.slug;
  }
  return null;
}
