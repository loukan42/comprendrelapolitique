# Score d'importance publique

Ce document décrit le calcul du score demandé par la spécification section 9.
Il s'appelle « score d'importance publique », jamais « impact réel » : la
couverture médiatique d'un texte ne mesure pas son effet sur la société, elle
mesure combien on en a parlé. Le nom du score doit rester fidèle à ce qu'il
mesure.

État au 13/09/2026 : rien de ce score n'est encore calculé en base, parce que
`data/` n'existe pas dans ce checkout et que la table qui le porterait
(`enrichissement.score_importance`, à ajouter selon DATA_MODEL.md section 7)
n'est pas créée. Ce document fixe la formule à implémenter, pas un résultat
observé. Chaque sous-section dit explicitement ce qui est calculable avec les
données déjà importées (scrutins, dossiers, acteurs) et ce qui dépend d'une
source non encore branchée.

Le score est attaché au **dossier législatif** (`officiel.dossier`), pas au
scrutin. C'est le dossier qui représente la loi aux yeux de l'utilisateur, et
c'est lui qui apparaît sur la homepage (« Les grandes décisions depuis 2017 »)
et sur la page loi. Un dossier adopté par 49.3 (`officiel.dossier_49_3`, voir
DATA_MODEL.md section 4) reçoit un score au même titre qu'un dossier voté sur
l'ensemble : l'absence de vote final ne doit pas faire disparaître de
l'importance un texte comme la réforme des retraites de 2023, qui est
précisément le cas que DATA_SOURCES.md section 7 documente comme le plus
embarrassant à rater.

## 1. Formule globale

```
score_importance = 0,35 × institutionnel
                  + 0,35 × mediatique
                  + 0,20 × intensite_parlementaire
                  + 0,10 × portee
```

Chaque sous-score est normalisé sur une échelle de 0 à 100 avant pondération.
Le résultat final est donc lui-même compris entre 0 et 100, arrondi à l'entier
le plus proche. On n'affiche jamais de décimale : « 78 » est défendable, « 78,3 »
laisserait croire à une précision qu'aucune des quatre composantes n'a.

Les quatre sous-scores sont conservés séparément en base, jamais fondus sans
que le détail reste consultable (spec section 9, dernière phrase). La page
« Comment ça marche ? » et toute page affichant le score doivent pouvoir montrer
les quatre valeurs, pas seulement le total.

## 2. Institutionnel, 35 %

C'est le sous-score le plus solide dès aujourd'hui : il ne dépend d'aucune
source externe, seulement de `officiel.dossier`, `officiel.scrutin` et
`officiel.acte_legislatif`, tous déjà modélisés.

Barème par points, plafonné à 100 après somme :

| Signal | Donnée source | Points |
| --- | --- | --- |
| Vote sur l'ensemble d'un texte | `scrutin.est_vote_sur_ensemble` | 30 |
| Adopté par 49.3 (pas de vote sur l'ensemble, mais engagement de responsabilité) | `officiel.dossier_49_3` via `dossier_lie_par_acte` | 30 |
| Scrutin public solennel (`SPS`) | `scrutin.type_vote_code = 'SPS'` | +20 |
| Loi de finances ou de financement de la Sécurité sociale | `dossier.procedure_libelle` contient « finances » ou « financement de la sécurité sociale » | +20 |
| Texte effectivement promulgué | acte de code `PROM` présent dans `acte_legislatif` du dossier | +15 |
| Saisine du Conseil constitutionnel | acte de code `CC-SAISIE-*` présent | +10 |

Un vote sur l'ensemble et une adoption par 49.3 sont mutuellement exclusifs par
construction du dossier (un dossier ne peut pas être les deux), donc les 30
points de départ ne se cumulent jamais entre les deux premières lignes.

Cette liste est un point de départ raisonnable, pas une mesure. Les poids
relatifs (30/20/20/15/10) sont un choix éditorial à documenter comme tel tant
qu'aucune calibration empirique (par exemple contre un jugement d'expert sur un
échantillon de lois connues) n'a été faite. Ils devront être revus après un
premier test sur les 801 votes sur l'ensemble et les 32 dossiers d'engagement
identifiés dans DATA_SOURCES.md section 7.2.

**Calculable dès maintenant** avec les données déjà importées pour la XVIe. À
étendre aux XVe et XVIIe une fois leurs `document` et `acte_legislatif`
chargés.

## 3. Médiatique, 35 %

C'est le sous-score que la spécification pondère le plus lourd, et c'est celui
qui repose entièrement sur une source non testée. Aucune requête GDELT n'a été
faite à ce jour (DATA_SOURCES.md section 8) : ni la couverture des médias
français, ni le taux de faux positifs sur des requêtes construites à partir de
titres de loi n'ont été mesurés. Faire reposer 35 % du score sur une source non
vérifiée serait un défaut de conception. Tant que ce test n'a pas été fait,
`mediatique` reste `NULL` en base, pas `0` : un score à zéro laisserait croire
qu'on a mesuré une absence de couverture, alors qu'on n'a rien mesuré du tout.
Un dossier sans `mediatique` connu doit afficher son score institutionnel et
son intensité parlementaire, et dire explicitement que la composante médiatique
n'est pas disponible, plutôt que de calculer un total sur trois sous-scores
présenté comme s'il en couvrait quatre.

### 3.1 Ce qui sera mesuré

Pour chaque dossier, générer plusieurs requêtes GDELT à partir de : titre
officiel complet, numéro de dossier, nom court reconnu s'il existe, termes
distinctifs du texte (spec section 17). Compter, sur la période courant du
dépôt à un an après la promulgation ou le rejet définitif :

- `n_articles` : nombre d'articles uniques ;
- `n_medias` : nombre de médias français distincts ;
- `n_jours` : nombre de jours distincts où au moins un article est publié.

### 3.2 Pourquoi une transformation logarithmique

Sans elle, un dossier ayant généré un pic médiatique très supérieur à tous les
autres (une réforme des retraites face à un texte technique passé inaperçu)
écraserait l'échelle : tous les autres textes se retrouveraient collés à 0.
Le logarithme comprime les grands écarts sans les annuler : doubler une
couverture déjà forte pèse moins que doubler une couverture faible, ce qui
correspond à l'idée qu'au-delà d'un certain volume, un article de plus ne rend
pas un texte significativement plus important.

```
mediatique_brut = ln(1 + n_articles) + ln(1 + n_medias) + ln(1 + n_jours)
```

### 3.3 Normalisation par année

La spécification demande de comparer un texte aux autres textes de la même
année plutôt qu'à l'ensemble de la période 2017 à aujourd'hui, parce que le
volume global de presse en ligne et la couverture de GDELT évoluent avec le
temps. La normalisation se fait donc par percentile à l'intérieur de l'année de
dépôt du dossier :

```
mediatique = 100 × rang_percentile(mediatique_brut parmi les dossiers de la même année)
```

Un dossier isolé dans une année où très peu d'autres dossiers ont été mesurés
produirait un percentile instable ; en dessous d'un seuil à fixer après test
(proposition de départ : 20 dossiers mesurés dans l'année), afficher le score
médiatique comme provisoire plutôt que définitif.

### 3.4 Ce qui reste à faire avant d'activer ce sous-score

1. Tester GDELT sur un échantillon de dossiers déjà connus (retraites 2023,
   loi immigration 2023-2024, loi Kasbarian-Bergé, etc.) et mesurer le taux de
   faux positifs des requêtes construites par titre.
2. Vérifier la couverture réelle des médias francophones dans GDELT, qui indexe
   majoritairement de la presse anglophone.
3. Documenter la fenêtre temporelle retenue et la justifier.

Rien de tout cela n'est fait à ce jour. `mediatique` reste une hypothèse de
formule, pas une mesure.

## 4. Intensité parlementaire, 20 %

Mesure l'ampleur du débat parlementaire, indépendamment de sa couverture
médiatique ou de son statut institutionnel. Composantes, chacune normalisée par
percentile dans l'année de dépôt comme au paragraphe 3.3, puis moyennées à
poids égal :

| Composante | Donnée source | État |
| --- | --- | --- |
| Nombre de scrutins rattachés au dossier | `officiel.scrutin_dossier` | Calculable dès maintenant |
| Nombre de séances (actes `AN1-DEBATS-SEANCE`) | `officiel.acte_legislatif` | Calculable dès maintenant |
| Durée du parcours (première date d'acte à la promulgation ou au rejet) | `officiel.acte_legislatif.date_acte` | Calculable dès maintenant |
| Nombre d'amendements déposés sur le dossier | table `amendement`, pas encore modélisée (DATA_MODEL.md section 9) | **Non calculable tant que l'import des amendements n'existe pas** |
| Nombre d'interventions en débat | XML des comptes rendus, pas encore parsé | **Non calculable** |

```
intensite_parlementaire = moyenne des composantes normalisées disponibles
```

Tant que les amendements et les débats ne sont pas importés, ce sous-score se
calcule sur les trois premières composantes seulement, et doit être marqué
comme partiel dans l'interface (« intensité parlementaire, calculée sur 3
composantes sur 5 »), pour la même raison que le sous-score médiatique : ne
jamais présenter une mesure incomplète comme si elle était complète.

Le nombre d'amendements est probablement biaisé sans transformation
logarithmique lui aussi (quelques textes très amendés dominent très largement
le corpus, l'obstruction parlementaire pouvant produire des milliers
d'amendements sur un seul texte sans rapport avec son importance réelle). À
vérifier une fois la table peuplée, avant de l'ajouter telle quelle.

## 5. Portée, 10 %

La spécification l'autorise explicitement à reposer sur l'IA, à condition
qu'elle reste identifiable comme une estimation. C'est le seul des quatre
sous-scores qui n'a pas vocation à devenir une mesure : il reste, par nature,
une appréciation.

Principe : demander à un modèle de langage d'estimer, à partir du résumé
officiel du dossier et de la liste de ses thèmes (`enrichissement.theme`),
combien de grands domaines de vie ou catégories de population le texte
concerne, sur une échelle fixée à l'avance (exemple : 1 = un secteur étroit,
5 = l'ensemble de la population). Le résultat doit être stocké avec :

- la justification textuelle produite par le modèle ;
- le score de confiance ;
- le modèle utilisé et la date de génération ;
- une citation vers le document source ayant servi à l'estimation, comme
  l'exige `enrichissement.citation` (DATA_MODEL.md section 7).

```
portee = 100 × (estimation - 1) / 4     -- si l'échelle retenue est 1 à 5
```

Affichage obligatoire : le libellé « Portée (estimation IA) », jamais
« Portée » seul, pour qu'aucun lecteur ne confonde ce sous-score avec une
mesure. Ce sous-score ne doit jamais, à lui seul, faire basculer un texte au
premier plan de la homepage : sa pondération à 10 % le limite déjà, et cette
limite ne doit pas être contournée en aval par un tri qui l'isolerait.

## 6. Ce que ce score ne mesure pas

Le score d'importance publique ne mesure ni la qualité d'une loi, ni son effet
réel sur la société, ni son bien-fondé. Un texte peu débattu et peu médiatisé
peut changer profondément la vie de millions de personnes sans qu'aucune des
quatre dimensions ci-dessus ne le capture bien, en particulier tant que
`portee` reste une estimation grossière. Le score répond à une question précise
et limitée : combien d'attention institutionnelle, médiatique et parlementaire
ce texte a-t-il reçu, comparé aux autres textes de la même année. Toute
formulation qui laisserait entendre davantage doit être corrigée avant mise en
ligne, au même titre qu'une erreur de calcul (AGENTS.md section 5, dernier
paragraphe).

## 7. Récapitulatif : solide versus hypothétique

| Sous-score | Poids | État au 13/09/2026 |
| --- | --- | --- |
| Institutionnel | 35 % | Calculable avec les données déjà modélisées, poids relatifs non calibrés |
| Médiatique | 35 % | Formule fixée, aucune donnée réelle : GDELT non testé |
| Intensité parlementaire | 20 % | Calculable partiellement (scrutins, séances, durée) ; amendements et débats manquants |
| Portée | 10 % | Par nature une estimation IA, jamais une mesure |

Tant que le sous-score médiatique n'a pas de données réelles, le total sur 100
ne doit pas être affiché comme un score unique trompeur : afficher les
sous-scores disponibles, marquer les manquants comme non mesurés, et ne
calculer un total que le jour où les quatre composantes ont au moins une
valeur, fût-elle provisoire pour la composante Portée.
