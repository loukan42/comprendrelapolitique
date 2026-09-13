# Score institutionnel, intensité parlementaire et classification thématique : état réel

Ce document rend compte de ce qui est **effectivement calculé et vérifié en
base** sur `data/pg16` (XVIe législature : 2943 dossiers, 4106 scrutins,
163 789 amendements), par opposition à ce que fixe
[docs/SCORING.md](SCORING.md), qui reste le document de référence pour les
formules. Il complète aussi [docs/SPECIFICATION.md](SPECIFICATION.md) section 8
(classification thématique) et
[docs/DATA_MODEL.md](DATA_MODEL.md) section 7 (couche d'enrichissement).

Migration : [`db/migrations/002_enrichissement.sql`](../db/migrations/002_enrichissement.sql).
Scripts : [`scripts/enrichissement/calculer_scores.ts`](../scripts/enrichissement/calculer_scores.ts)
et [`scripts/enrichissement/classer_echantillon.ts`](../scripts/enrichissement/classer_echantillon.ts).

Aucune de ces tables n'écrit dans `officiel` : toutes référencent
`officiel.dossier` par clé étrangère, dans `enrichissement`, conformément à
AGENTS.md section 5 et DATA_MODEL.md section 1.

---

## 1. Score institutionnel (35 %), calculé et vérifié

Implémente exactement le barème de [SCORING.md section 2](SCORING.md).
Colonnes : `enrichissement.score_importance.institutionnel` (0 à 100, entier)
et `institutionnel_detail` (jsonb, un booléen par signal du barème plus le
total avant plafonnement, pour que l'interface puisse afficher la
décomposition plutôt qu'un chiffre opaque).

| Signal | Requête | Points |
| --- | --- | --- |
| Vote sur l'ensemble | `EXISTS` un scrutin rattaché (`officiel.scrutin_dossier`) avec `est_vote_sur_ensemble` | 30 |
| Adopté par 49.3 | `EXISTS` dans `officiel.dossier_adopte_sans_vote` | 30 |
| Scrutin public solennel | `EXISTS` un scrutin rattaché de type `SPS` | +20 |
| Loi de finances / financement de la Sécurité sociale | `procedure_libelle ILIKE '%finances%'` ou `ILIKE '%financement de la sécurité sociale%'` | +20 |
| Promulgué | `EXISTS` un acte `PROM` ou `PROM-PUB` du dossier | +15 |
| Saisine du Conseil constitutionnel | `EXISTS` un acte `CC-SAISIE-%` du dossier | +10 |

Les deux premières lignes ne s'additionnent jamais : le script prend
`vote_sur_ensemble OR adopte_49_3`, comme l'exige SCORING.md (« mutuellement
exclusifs par construction »). Le total est plafonné à 100.

**Les dossiers d'engagement de responsabilité (49.3) ne reçoivent pas de
score.** `procedure_libelle = 'Engagement de la responsabilité
gouvernementale'` est exclu du calcul : DATA_MODEL.md section 4 est explicite,
« ces dossiers d'engagement ne doivent jamais apparaître comme des lois
autonomes ». Sur la XVIe, cela retire 29 dossiers des 2943, et
`enrichissement.score_importance` compte donc 2914 lignes, pas 2943.

Ces 29 dossiers ne forment pas un groupe homogène : **23 sont des actes
d'engagement de responsabilité sur un texte** (le cas décrit ci-dessus), mais
**6 sont en réalité des motions de censure** déposées en application de
l'article 49, alinéa 2, de la Constitution (initiative parlementaire, pas
gouvernementale), classées sous le même `procedure_libelle` par la source. Ce
sont deux événements de nature différente : un acte d'adoption de texte sans
vote d'un côté, un vote de défiance contre le gouvernement de l'autre. Aucun
des deux groupes ne reçoit de score aujourd'hui, pour la même raison qu'une
motion de censure n'est jamais un dossier de loi, mais la distinction mérite
d'être connue avant d'exploiter cette liste ailleurs (par exemple pour une
page listant les textes adoptés par 49.3, qui ne doit afficher que les 23,
jamais les 6 motions). Fait connexe découvert en vérifiant ce point : la
majorité des scrutins de type `MOC` de la XVIe (34 au total) n'a aucun dossier
rattaché dans `officiel.scrutin_dossier`, y compris ces 6 motions liées à des
49.3 ; ce n'est pas un défaut de ce travail mais une limite déjà connue du
rattachement scrutin/dossier (AGENTS.md section 5, règle 5).

### Vérification sur trois cas connus

Exécutée sur `data/pg16` le 13/09/2026.

**Réforme des retraites (`DLR5L16N47066`, PLFRSS pour 2023).** Institutionnel
= **75** : `adopte_49_3` (30, via `officiel.dossier_adopte_sans_vote`, qui
relie ce dossier au dossier d'engagement `DLR5L16N47408`), `loi_finances` (20,
« financement de la sécurité sociale »), `promulgue` (15), `saisine_cc` (10).
`vote_sur_ensemble` et `sps` sont à `false`, correctement : ce texte n'a
jamais eu de vote sur son ensemble (DATA_SOURCES.md section 7.1). C'est le cas
le plus délicat du produit et il se comporte comme attendu.

**Loi de finances rectificative pour 2022 (`DLR5L16N45943`).**
Institutionnel = **95**, le score le plus élevé de la base : vote sur
l'ensemble, SPS, loi de finances, promulguée, saisine du Conseil
constitutionnel. Les cinq signaux à la fois, cohérent avec un texte budgétaire
d'urgence de l'été 2022.

**Proposition de loi ordinaire jamais examinée (`DLR5L16N46300`,
« Élargissement des droits à la retraite pour les aidants familiaux »).**
Institutionnel = **0**. Aucun des six signaux ne s'applique : pas de vote, pas
de promulgation, pas de saisine. Sur la XVIe, **2713 des 2914 dossiers
scorés** (93 %) sont à 0, ce qui reflète une réalité connue : la grande
majorité des propositions de loi déposées par un parlementaire n'aboutissent
jamais (voir la distribution complète ci-dessous).

Distribution mesurée des scores institutionnels sur `data/pg16` :

| Score | Nombre de dossiers |
| --- | --- |
| 95 | 1 |
| 85 | 1 |
| 75 | 18 |
| 65 | 8 |
| 55 | 9 |
| 50 | 3 |
| 45 | 57 |
| 30 | 51 |
| 25 | 2 |
| 15 | 51 |
| 0 | 2713 |

Cette distribution n'est pas une courbe lisse, et ce n'est pas un défaut : le
barème est une somme de signaux binaires à poids fixes (30/20/20/15/10), donc
seules certaines combinaisons de points sont atteignables. Rappel de
SCORING.md section 2 : ces poids relatifs sont un choix éditorial documenté
comme tel, pas une mesure calibrée.

---

## 2. Intensité parlementaire (20 %), calculée sur 3 composantes sur 5

Implémente [SCORING.md section 4](SCORING.md) sur les trois composantes que
la donnée déjà chargée permet de calculer : nombre de scrutins rattachés
(`officiel.scrutin_dossier`), nombre de séances (actes `%-DEBATS-SEANCE`),
durée du parcours (de la première date d'acte à la promulgation, ou à défaut
à la dernière date d'acte connue).

**Note sur les amendements.** Contrairement à ce que dit SCORING.md section 4
(« pas encore modélisée »), la table `officiel.amendement` de la XVIe est en
réalité chargée dans `data/pg16` (163 789 lignes). Cette tâche n'a **pas**
ajouté les amendements comme quatrième composante du calcul, sur instruction
explicite de rester sur les 3 composantes déjà documentées et parce que
SCORING.md section 4 signale un risque de biais non vérifié : « le nombre
d'amendements est probablement biaisé sans transformation logarithmique »,
l'obstruction parlementaire pouvant produire des milliers d'amendements sur
un seul texte sans rapport avec son importance. Ajouter cette composante
correctement demande de mesurer ce biais d'abord, pas de l'ajouter telle
quelle. `docs/SCORING.md` reste donc la référence à corriger en premier si
cette quatrième composante est ajoutée plus tard : le texte y annonce « pas
encore modélisée », ce qui n'est plus vrai pour la XVIe et induirait en
erreur quiconque le lit après ce travail sans lire aussi ce document.

Chaque composante est normalisée par rang percentile **au sein de l'année de
dépôt du dossier** (année de la première date d'acte trouvée), comme l'exige
SCORING.md section 3.3 par renvoi de la section 4. Formule du rang
percentile, appliquée composante par composante :

```
percentile(x, groupe) = 100 × (nb valeurs < x + 0,5 × nb valeurs = x) / effectif du groupe
```

Cette formule a une propriété utile documentée dans le code : sur un groupe
d'un seul dossier, elle renvoie 50 sans cas particulier à écrire, ni au sommet
ni au bas de l'échelle. `intensite_parlementaire` est ensuite la moyenne des
percentiles disponibles (2 ou 3 selon qu'une durée est calculable),
`intensite_parlementaire_composantes` vaut donc 2 ou 3, et
`intensite_parlementaire_partiel` reste à `true` pour toute la table :
l'interface doit afficher « intensité parlementaire, calculée sur 3
composantes sur 5 » partout où ce score apparaît, jamais comme une mesure
complète.

**Vérification.** La réforme des retraites obtient une intensité
parlementaire de **79,06** sur son année de dépôt (2023, 1429 dossiers dans le
groupe de comparaison) : cohérent avec un texte débattu 21 séances en
première lecture à l'Assemblée (DATA_SOURCES.md section 7.3), très au-dessus
de la médiane des textes déposés la même année.

---

## 3. `mediatique` et `portee` : non calculés, volontairement

Les deux colonnes restent `NULL` pour tous les dossiers, jamais `0`, comme
l'exige SCORING.md sections 3 et 5. Aucun accès à GDELT n'a été mis en place
dans cette tâche, et aucune estimation IA de portée n'a été générée. La
colonne `score_total` de `enrichissement.score_importance` est une colonne
générée (`GENERATED ALWAYS AS ... STORED`) qui ne se calcule que lorsque les
quatre sous-scores sont renseignés : elle reste donc `NULL` pour les 2914
dossiers scorés à ce jour, ce qui est le comportement voulu, pas une panne à
corriger.

---

## 4. Classification thématique : schéma prêt, classification en masse **non faite**

### Ce qui existe

`enrichissement.theme` porte les 23 thèmes fixés par
[SPECIFICATION.md section 8](SPECIFICATION.md), semés par la migration
(`economie`, `entreprises`, `fiscalite`, `travail`, `retraites`,
`pouvoir_achat`, `sante`, `protection_sociale`, `education`, `logement`,
`securite`, `justice`, `immigration`, `environnement`, `energie`,
`agriculture`, `transports`, `numerique`, `libertes_publiques`,
`institutions`, `defense`, `international`, `europe`).

`enrichissement.dossier_theme` porte, par ligne : le dossier, le thème, un
score de confiance entre 0 et 1, une justification texte obligatoire (contrôle
`CHECK (length(justification) > 0)`), une citation vers un document officiel
(`citation_document_uid`, clé étrangère vers `officiel.document`), le modèle
utilisé (`'humain'` pour une classification manuelle, un nom de modèle sinon),
la date de génération et un champ `valide_par` pour une relecture.

### Ce qui a été fait : un échantillon de 10 dossiers, à la main

Aucun accès pratique à un LLM n'était disponible dans cet environnement pour
classifier les 2914 dossiers à grande échelle : pas de clé d'API de fournisseur
LLM exposée aux scripts de ce dépôt, et classifier 2914 titres un par un dans
cette session, sans contrôle programmatique de cohérence ni citation
vérifiable systématique, aurait produit exactement le risque que ce projet
s'interdit : des thèmes plausibles mais non fondés sur une lecture réelle du
texte. Plutôt que d'inventer une classification en masse non vérifiable,
`scripts/enrichissement/classer_echantillon.ts` classe **10 dossiers réels et
vérifiables**, identifiés par requête SQL sur `data/pg16` (titres et uids
constatés, pas supposés), avec justification et citation vers un document
officiel du dossier concerné pour chaque thème :

| Dossier | Titre | Thèmes attribués |
| --- | --- | --- |
| `DLR5L16N47066` | Financement rectificative de la sécurité sociale pour 2023 (réforme des retraites) | retraites (0,95), travail (0,60) |
| `DLR5L16N45988` | Loi de finances pour 2023 | fiscalité (0,90), économie (0,85) |
| `DLR5L16N47118` | Contrôler l'immigration, améliorer l'intégration | immigration (0,95), travail (0,55) |
| `DLR5L16N46539` | Accélération de la production d'énergies renouvelables | énergie (0,95), environnement (0,70) |
| `DLR5L16N48163` | Pour le plein emploi (France Travail) | travail (0,90), protection sociale (0,60) |
| `DLR5L16N47979` | Transposition de l'ANI sur le partage de la valeur | travail (0,85), entreprises (0,65), pouvoir d'achat (0,50) |
| `DLR5L16N48397` | Loi de finances pour 2024 | fiscalité (0,90), économie (0,80) |
| `DLR5L16N48683` | Financement de la sécurité sociale pour 2024 | protection sociale (0,85), santé (0,70) |
| `DLR5L16N46266` | Mesures d'urgence sur le marché du travail (assurance chômage) | travail (0,90), pouvoir d'achat (0,40) |
| `DLR5L16N46346` | Programmation des finances publiques 2023-2027 | économie (0,85), fiscalité (0,50) |

Ces deux exemples correspondent exactement aux cas cités en illustration dans
la consigne de cette tâche (réforme des retraites → retraites + travail, PLF
2023 → fiscalité + économie), ce qui permet de vérifier le schéma sans
inventer de résultat : 21 lignes `dossier_theme` au total, chacune avec une
justification propre et une citation vers un document réel du dossier
(vérifiées ci-dessus en base, section « Vérification » exécutée sur
`data/pg16`).

### Ce qui reste à faire, et pourquoi

**La classification en masse des 2914 dossiers restants n'est pas faite.**
Pour l'implémenter correctement, il faut : un accès programmatique à un modèle
de langage (clé d'API provisionnée pour les scripts, pas seulement pour cet
agent interactif), un prompt fixé et versionné utilisant le titre officiel
plus le résumé quand il existe, une contrainte de sortie structurée
(JSON, thèmes parmi les 23 du référentiel uniquement), une relecture humaine
par échantillonnage avant publication (spec section 8 : « possibilité de
correction »), et une vérification du taux d'erreur sur un échantillon plus
large que les 10 dossiers ici avant d'activer l'affichage en production. Rien
de tout cela n'est fait à ce jour. Le champ `modele` distingue déjà les deux
cas en base (`'humain'` contre un nom de modèle), donc les lignes actuelles
ne seront pas confondues avec une future classification automatique quand
elle existera.

---

## 5. Ce que ces deux scores ne mesurent pas

Rappel de SCORING.md section 6, qui s'applique ici sans changement :
l'institutionnel et l'intensité parlementaire ne mesurent ni la qualité d'une
loi ni son effet réel sur la société. Un texte à `institutionnel = 0` peut
avoir eu des débats significatifs en commission sans jamais franchir l'étape
du vote en séance ; ce score répond à une question précise : combien de
signaux institutionnels formels ce dossier a-t-il reçus, comparé aux autres
dossiers de la même législature.
