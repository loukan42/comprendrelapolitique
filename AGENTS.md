<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# Comprendre la Politique — règles de contribution

Site d'éducation civique en français. Deux règles commandent tout le reste :
**Mantine est la seule bibliothèque d'interface**, et **le site ne doit pas
ressembler à une page générée automatiquement**.

Ces règles valent pour toute contribution, humaine ou agentique, y compris les
générations faites depuis l'éditeur Lovable.

---

## 1. Interface : Mantine, exclusivement

### Autorisé

- Les composants `@mantine/core` et `@mantine/hooks`, plus les paquets Mantine
  officiels selon les besoins : `@mantine/form`, `@mantine/charts`,
  `@mantine/dates`, `@mantine/notifications`, `@mantine/spotlight`.
- La mise en page par `Stack`, `Group`, `Grid`, `SimpleGrid`, `Container`, `Box`.
- Les *style props* Mantine (`mt`, `px`, `w`, `bg`…) pour un ajustement ponctuel.
- Les CSS Modules (`Composant.module.css`) dès qu'une règle dépasse deux ou trois
  propriétés, en consommant les variables Mantine
  (`var(--mantine-spacing-md)`, `var(--mantine-color-dimmed)`).
- `@tabler/icons-react` pour les icônes : c'est le jeu de référence de Mantine,
  et ce sera le seul du projet.

### Interdit

- **`src/components/ui/` (shadcn/ui) : code mort.** Ne rien y importer, ne rien y
  ajouter. Devant un fichier de ce dossier, le supprimer plutôt que le contourner.
- Les imports `@radix-ui/*` directs.
- **Les classes utilitaires Tailwind dans le JSX** (`className="flex gap-4"`).
  Tailwind reste présent dans le build — il est injecté par
  `@lovable.dev/vite-tanstack-config` et ne peut pas en être retiré sans casser la
  configuration — mais on n'écrit plus une seule de ses classes.
- `style={{ … }}` en dur, sauf valeur réellement dynamique : une largeur calculée,
  une position. Jamais pour une couleur ou un espacement.
- Toute autre bibliothèque de composants : MUI, Chakra, Ant Design, Bootstrap,
  HeadlessUI, daisyUI. Et `lucide-react`, à faire disparaître au profit de Tabler.
- Les couleurs, espacements, rayons et tailles de police écrits en dur dans un
  composant.

### Le thème est la source unique

Un seul fichier `src/theme.ts`, construit avec `createTheme`. Une couleur, un
espacement ou une taille absents du thème n'existent pas dans le site : on les
ajoute au thème d'abord, on les utilise ensuite.

### Montage SSR

`src/routes/__root.tsx` doit comporter, dans cet ordre :

1. `import "@mantine/core/styles.css"`, puis les CSS des paquets Mantine utilisés
   — leur ordre compte, le CSS de base vient en premier ;
2. `<ColorSchemeScript />` dans le `<head>` : sans lui, le thème clignote au
   chargement ;
3. `<MantineProvider theme={theme}>` englobant l'`<Outlet />`.

L'`<Outlet />` du root ne doit jamais être retiré : il fait vivre toutes les
routes enfants.

---

## 2. Ce qui est banni

L'esthétique par défaut des générateurs signale « contenu automatique » avant
même qu'on ait lu une ligne. Sur un site qui prétend expliquer la politique, elle
ruine la crédibilité avant l'argument. Ce qui suit est une liste d'interdictions,
pas de préférences.

### Visuel

| Banni | À la place |
| --- | --- |
| Dégradés décoratifs — violet vers indigo en tête —, *mesh gradients*, halos flous animés | Des aplats. Un fond, un texte. |
| Glassmorphism, `backdrop-filter: blur`, cartes translucides | Des bords nets, un filet à 1px. |
| Emoji en guise d'icône, de puce ou de titre | Une icône Tabler, ou rien. |
| La grille de trois cartes « icône dans un carré arrondi, titre, deux lignes » | Une liste, un tableau, ou du texte suivi. |
| Ombre portée sur tout, rayon maximal sur tout | L'ombre revient à ce qui flotte réellement : menu, modale, popover. |
| Néon et couleurs saturées sur fond sombre | Un contraste sobre et vérifié : AA au minimum, AAA sur le corps de texte. |
| Illustrations 3D génériques, avatars fictifs, logos d'entreprises inventés | Rien, ou un document réel : graphique sourcé, photo d'archive créditée. |
| Chiffres décoratifs invérifiables (« +10 000 citoyens informés ») | Aucun chiffre sans source. |
| Animation d'apparition au défilement sur chaque bloc | Des transitions sur les seules interactions : survol, focus, ouverture. |
| Le hero centré — grand titre, sous-titre qui répète le titre, deux boutons | Une entrée en matière qui annonce le contenu réel et mène quelque part. |

### Rédaction

- Pas de verbe d'accroche : « Découvrez », « Plongez au cœur de », « Explorez
  l'univers de », « Décryptez ».
- Pas de superlatif ni de promesse : « la référence », « enfin simple », « tout
  comprendre en cinq minutes ».
- Pas d'énumération systématique par trois.
- Pas d'attribution vague : « les experts s'accordent », « des études montrent ».
  On nomme la source, on la date, on y renvoie.
- Un titre dit quelque chose de précis. « Le budget de l'État » est un titre ;
  « Comprendre les enjeux du budget » n'en est pas un.
- Le sous-titre n'est pas une reformulation du titre. S'il n'ajoute rien, il saute.
- Pas de tirets cadratins en série.

---

## 3. La direction : éditorial, pas SaaS

La référence n'est pas une page d'accueil de startup, c'est la presse explicative
et les publications de données : Les Décodeurs, Our World in Data, les notes du
Conseil d'analyse économique. Concrètement :

- **La typographie porte la page.** Hiérarchie réelle : un seul `h1`, des niveaux
  qui se distinguent par la taille *et* la graisse. Corps de texte entre 65 et 75
  caractères par ligne, interligne généreux. Une page bien construite reste bonne
  en noir et blanc.
- **Palette sobre.** Presque-noir sur blanc cassé. Un accent unique, réservé à
  l'interaction — lien, focus, état actif — jamais à la décoration.
- **La densité est permise.** Un site qui explique a le droit d'être dense. Un
  tableau lisible vaut mieux qu'un carrousel.
- **Des graphiques quand ils portent une information**, via `@mantine/charts` :
  axes nommés, unités visibles, source et date sous la figure.
- **De l'asymétrie.** Une colonne de texte avec une marge de notes vaut mieux que
  tout centrer.

---

## 4. Contraintes propres à un site politique

- **L'accent ne doit pas être un marqueur partisan.** En France, le bleu, le rouge,
  le rose et le vert se lisent comme des appartenances. L'accent du site reste
  neutre : gris-ardoise, bleu-encre très désaturé, ocre. Les couleurs de partis ne
  servent **que** dans les visualisations où elles représentent effectivement ces
  partis, selon une convention écrite dans le thème.
- **Aucune donnée inventée sur une personne, un parti, un scrutin ou un vote.** Pas
  de chiffre « à titre d'exemple » sur un sujet réel. Si la donnée manque, le
  composant affiche un état vide, jamais un substitut plausible.
- **Chaque affirmation factuelle porte sa source** : institution, date, lien.
- **Le ton reste descriptif.** On explique un mécanisme ; on ne qualifie pas une
  politique.

---

## 5. Données : six règles non négociables

Le détail et les mesures sont dans [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md)
et [docs/DATA_MODEL.md](docs/DATA_MODEL.md). **Les lire avant d'écrire une ligne
de code touchant aux données.** Ce qui suit est le minimum à ne jamais enfreindre.

1. **Ne jamais déduire le vote d'un député de la position de son groupe.** Le
   champ `positionMajoritaire` existe dans la source et rend cette faute facile.
   Il ne peuple jamais un vote individuel.
2. **L'absence n'est pas une abstention, et le non-votant n'est pas un absent.**
   Un député absent ne figure dans aucune liste de la source : son absence est
   une déduction, pas une donnée. Le non-votant, lui, est enregistré : c'est une
   position.
3. **Une motion de censure n'enregistre que les votes POUR.** L'afficher avec un
   gabarit POUR / CONTRE / ABSTENTION affiche « 0 contre » et produit un
   contresens. Gabarit dédié obligatoire, et exclusion du quiz de proximité.
4. **Un texte adopté par 49.3 n'a pas de vote sur son ensemble.** C'est le cas de
   la réforme des retraites de 2023, et une recherche fondée sur les votes finaux
   la manque entièrement. Le dossier de la loi ne porte **pas** `AN21` : le 49.3
   vit dans un dossier séparé, et le lien ne se lit que dans les actes que les
   deux dossiers partagent (vue `officiel.dossier_adopte_sans_vote`). Ni le
   titre, ni `AN21` sur le dossier du texte ne sont des détecteurs. Trois états à
   distinguer sur une page loi : voté sur l'ensemble, adopté sans vote par 49.3,
   adopté à main levée.
5. **Vérifier les données officielles entre elles.** Deux erreurs vérifiées sur
   556 liens scrutin ↔ dossier de la source. En cas de désaccord entre lien
   officiel et lien reconstruit, conserver les deux et signaler le conflit —
   jamais trancher en silence.
6. **Séparation physique `officiel` / `enrichissement`.** Une donnée produite par
   IA ne peut pas écrire dans le schéma officiel, et une affirmation sans
   citation vers une source primaire ne se publie pas.

Un chiffre affiché sans source est un bug, pas une imperfection.

## 6. Avant chaque commit

- [ ] Aucune classe Tailwind, aucun import depuis `src/components/ui/`, aucun
      `@radix-ui/*`, aucun `lucide-react`.
- [ ] Aucune couleur ni aucun espacement en dur : tout passe par `src/theme.ts`.
- [ ] Rien de la liste des bannis (section 2).
- [ ] Chaque chiffre affiché a sa source.
- [ ] `npm run lint` passe.
- [ ] La page tient à 320px de large et au zoom 200 %.
- [ ] `main` compile : Lovable synchronise cette branche, voir l'encadré en tête
      de fichier.

Ces règles gagnent à être opposables plutôt que déclaratives. Une entrée
`no-restricted-imports` dans `eslint.config.js` visant `@/components/ui/*`,
`@radix-ui/*` et `lucide-react` transforme la première ligne de cette liste en
erreur de lint.
