/**
 * Libellés d'affichage des thèmes du corpus des programmes, partagés par le
 * comparateur et le QCM.
 *
 * Un thème absent de cette table s'affiche avec son identifiant brut, ce qui
 * se voit : la liste doit suivre les thèmes réellement utilisés dans
 * `enrichissement.programme_position`.
 */
const LIBELLE_THEME: Record<string, string> = {
  retraites: "Retraites",
  travail: "Travail",
  impots: "Impôts",
  energie: "Énergie",
  education: "Éducation",
  sante: "Santé",
  immigration: "Immigration",
  environnement: "Environnement",
  securite: "Sécurité",
  justice: "Justice",
  institutions: "Institutions",
  entreprises: "Entreprises",
  defense: "Défense",
  logement: "Logement",
  europe: "Europe",
  economie: "Économie",
  famille: "Famille",
  finances: "Finances publiques",
};

export function libelleTheme(theme: string): string {
  return LIBELLE_THEME[theme] ?? theme;
}
