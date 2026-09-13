# Moteur de quiz Politiquizz : analyse et conception

Ce document répond à la demande de conception d'un moteur de quiz où une
question représente une **position politique** adossée à plusieurs scrutins,
et non plus un scrutin unique. Il complète `docs/QUIZ_METHODOLOGY.md`, qui
reste la référence pour tout ce qu'il ne contredit pas : contrainte de
confidentialité, concordance, taux d'unité, traitement de l'abstention,
mention obligatoire de fin de résultat.

Rien de ce qui suit n'est implémenté à ce jour. Le document fixe une cible et
les paramètres à trancher, pas un résultat observé.

État des mesures : 13 septembre 2026, base `data/pg16` (législatures XVI et
XVII chargées).

---

## 1. Analyse de l'existant

### 1.1 Ce qui tourne aujourd'hui

| Couche | Fichier | Rôle |
| --- | --- | --- |
| Sélection des questions | `src/queries/quiz.ts` | `createServerFn`, choisit des dossiers votés sur l'ensemble, un par thème, et joint la répartition par groupe |
| Formulation | `src/queries/questionsQuiz.ts` | Dictionnaire de fiches rédigées à la main, environ 35 dossiers couverts, repli générique sinon |
| Calcul | `src/lib/quizCalcul.ts` | Concordance par groupe, entièrement dans le navigateur |
| Écran | `src/routes/quiz.tsx` | Une question à la fois, indicateur du groupe le plus proche en direct, résultat par groupe et question par question |
| Thèmes | `src/queries/themes.ts` | 16 thèmes, rattachement par mots-clés sur le titre du texte |

Modèle actuel : **une question égale un scrutin**, et ce scrutin est toujours
un vote sur l'ensemble d'un texte. C'est précisément ce que la nouvelle
demande remplace.

### 1.2 La contrainte qui commande l'architecture

`docs/QUIZ_METHODOLOGY.md` section 1 : une réponse de quiz est une opinion
politique, donnée sensible au sens de l'article 9 du RGPD. Les réponses ne
doivent jamais atteindre le serveur. `src/lib/quizCalcul.ts` n'importe donc
rien de `src/queries/`, et le calcul se fait dans le navigateur.

Cette contrainte n'est pas un détail de conformité, elle détermine la forme
du moteur : **les positions des groupes doivent être précalculées côté
serveur et livrées au navigateur avec les questions**. Le navigateur ne peut
pas demander au serveur « quelle est la position du groupe X sur la question
Y compte tenu de mes réponses », puisque la question révélerait les réponses.

Conséquence utile : elle rend le quiz adaptatif possible sans aucun
aller-retour. Voir section 5.

### 1.3 Schéma de base

Un seul schéma existe, `officiel`, alimenté par l'import et jamais écrit par
autre chose. Tables utiles au quiz : `scrutin`, `scrutin_groupe`, `vote`,
`organe`, `mandat`, `dossier`, `scrutin_dossier`.

`docs/DATA_MODEL.md` prévoit un schéma `enrichissement` séparé, pour tout ce
qui est produit par une rédaction ou un calcul. **Il n'est pas encore créé.**
C'est là que vivra la banque de questions.

---

## 2. Données réellement disponibles

Chiffres mesurés sur la base courante, pas estimés.

### 2.1 Volumes

| Mesure | XVIe | XVIIe | Total |
| --- | --- | --- | --- |
| Scrutins publics | 4 106 | 8 434 | 12 540 |
| dont votes sur l'ensemble d'un texte | 209 | 214 | 423 |
| Votes individuels | 602 911 | 1 270 476 | 1 873 387 |
| Groupes parlementaires | 12 | 14 | 26 |

Rattachement scrutin vers dossier : 348 officiels, 62 reconstruits, 1 conflit.

### 2.2 Correction importante sur la profondeur historique

La demande part de « environ 10 ans de données ». **La base en contient
quatre**, et de façon discontinue :

- XVIe législature : 11 juillet 2022 au 7 juin 2024
- XVIIe législature : 8 octobre 2024 au 21 juillet 2026

La XVe législature (2017 à 2022) est téléchargeable par la chaîne d'import
existante mais **n'est pas chargée**. La charger porterait la couverture à
environ neuf ans et ferait passer le corpus à près de 17 000 scrutins. C'est
un préalable à la pondération temporelle : une décote sur dix ans n'a pas de
sens sur un corpus qui en couvre quatre.

Aucune donnée n'existe avant 2017 dans la source utilisée.

### 2.3 Le point structurant : les scrutins non finaux

Sur 12 540 scrutins, 423 portent sur l'ensemble d'un texte. Les 12 117 autres
portent sur un article, un amendement, une motion. Ce sont eux qui donnent la
granularité que la demande réclame : la fiscalité des hauts revenus se joue
sur des amendements budgétaires, pas sur le vote final d'une loi de finances.

Leur `objet_libelle` est exploitable, par exemple :

> « l'article 8 quater du projet de loi de finances pour 2026 (nouvelle lecture). »

Mais **aucun scrutin non final n'est rattaché à un dossier** : les 411
rattachements portent tous sur des votes sur l'ensemble. Conséquence de
conception : une question doit référencer des **scrutins** directement
(`scrutin.uid`), jamais des dossiers. Passer par le dossier éliminerait 97 %
du corpus.

### 2.4 Ce qui n'est pas disponible

- `officiel.amendement` et `officiel.intervention` existent dans le schéma
  mais sont **vides** dans la base courante. Le texte des amendements et des
  débats n'est donc pas mobilisable aujourd'hui pour aider à la sélection.
- Aucune donnée de programme politique. La distinction votes contre
  programmes demandée en cible reste à ce stade une place réservée dans le
  modèle, pas une source.
- Aucune donnée de couverture médiatique.

### 2.5 Le problème de continuité des groupes

Un groupe portant le même nom sous deux législatures a deux `organe_uid`
différents, et la source ne publie aucune table reliant les deux. Mesuré :
« Rassemblement National », « Socialistes et apparentés », « Non inscrit » et
d'autres existent en double.

Un quiz couvrant plusieurs législatures et affichant « Rassemblement
National » deux fois dans son classement est inutilisable. Il faut donc une
entité au-dessus du groupe parlementaire. `docs/QUIZ_METHODOLOGY.md` section
5.8 l'anticipe et pose la condition : cette correspondance doit être
explicite, historisée et sourcée, jamais implicite dans le code de calcul.

Effectifs XVIIe pour situer les ordres de grandeur : RN 125, EPR 95, LFI 72,
SOC 69, DR 50, EcoS 38, DEM 37, HOR 35, LIOT 23, UDR 17, GDR 17, NI 12.

---

## 3. Modèle de données proposé

Schéma `enrichissement`, séparé de `officiel` comme l'impose AGENTS.md
section 5 règle 6. Aucune de ces tables n'écrit dans `officiel`.

### 3.1 Formations, au-dessus des groupes

```sql
CREATE TABLE enrichissement.formation (
    id          text PRIMARY KEY,        -- 'rn', 'lfi', 'ps'
    libelle     text NOT NULL,
    libelle_court text,
    actif       boolean NOT NULL DEFAULT true
);

-- Correspondance historisee formation <-> groupe parlementaire.
-- Sourcee et datee : c'est une affirmation sur des formations reelles.
CREATE TABLE enrichissement.formation_groupe (
    formation_id text NOT NULL REFERENCES enrichissement.formation(id),
    organe_uid   text NOT NULL,          -- officiel.organe, code_type = 'GP'
    date_debut   date NOT NULL,
    date_fin     date,
    source       text NOT NULL,          -- d'ou vient l'affirmation
    note         text,
    PRIMARY KEY (formation_id, organe_uid)
);
```

Un groupe sans formation déclarée reste affiché sous son nom de groupe. On
n'invente pas de filiation : « Non inscrit » n'est pas une formation, et le
rattachement d'un groupe dissident à une formation est une décision
éditoriale qui porte sa source.

### 3.2 Banque de questions

```sql
CREATE TABLE enrichissement.question (
    id            text PRIMARY KEY,
    intitule      text NOT NULL,         -- la question posee, neutre
    description   text,                  -- « en savoir plus », facultatif
    theme         text NOT NULL,
    sous_theme    text,
    actif         boolean NOT NULL DEFAULT false,  -- inactive tant que non relue
    version       integer NOT NULL DEFAULT 1,
    note_editoriale text,                -- pourquoi ces scrutins, et pas d'autres
    cree_le       timestamptz NOT NULL DEFAULT now(),
    maj_le        timestamptz
);

CREATE TABLE enrichissement.question_scrutin (
    question_id  text NOT NULL REFERENCES enrichissement.question(id) ON DELETE CASCADE,
    scrutin_uid  text NOT NULL REFERENCES officiel.scrutin(uid),
    -- +1 : voter POUR ce scrutin va dans le sens de la question.
    -- -1 : voter CONTRE ce scrutin va dans le sens de la question.
    -- Jamais deduit : toujours saisi et justifie.
    sens         smallint NOT NULL CHECK (sens IN (-1, 1)),
    poids        numeric(4,2) NOT NULL DEFAULT 1 CHECK (poids > 0),
    justification text NOT NULL,         -- pourquoi ce scrutin represente cette question
    PRIMARY KEY (question_id, scrutin_uid)
);
```

`sens` est le coeur de la demande et la seule protection contre le
contresens : sur un texte qui **baissait** la fiscalité, voter CONTRE est la
position favorable à la question « faut-il davantage taxer les hauts
revenus ». Aucune règle automatique ne peut le deviner. `justification` est
obligatoire pour que la sélection reste relisible.

### 3.3 Paramètres de scoring, versionnés

```sql
CREATE TABLE enrichissement.parametres_scoring (
    id             serial PRIMARY KEY,
    demi_vie_mois  integer NOT NULL,     -- decote temporelle
    seuil_confiance_haute numeric(3,2) NOT NULL,
    seuil_confiance_moyenne numeric(3,2) NOT NULL,
    min_scrutins   integer NOT NULL,     -- en deca, position non publiee
    min_votes      integer NOT NULL,
    poids_sujet_important numeric(3,2) NOT NULL,
    actif          boolean NOT NULL DEFAULT false,
    note           text NOT NULL,
    cree_le        timestamptz NOT NULL DEFAULT now()
);
```

Tout paramètre du calcul vit ici, aucun n'est écrit en dur. Un jeu de
paramètres n'est jamais modifié : on en crée un nouveau et on bascule
`actif`, pour qu'un résultat publié reste rattachable aux paramètres qui
l'ont produit.

### 3.4 Positions calculées, avec leur provenance

```sql
CREATE TABLE enrichissement.question_position (
    question_id   text NOT NULL REFERENCES enrichissement.question(id) ON DELETE CASCADE,
    formation_id  text NOT NULL REFERENCES enrichissement.formation(id),
    position      numeric(4,3) NOT NULL CHECK (position BETWEEN -1 AND 1),
    confiance     numeric(4,3) NOT NULL CHECK (confiance BETWEEN 0 AND 1),
    unite_moyenne numeric(4,3) NOT NULL,
    dispersion    numeric(4,3) NOT NULL,
    n_scrutins    integer NOT NULL,
    n_votes       integer NOT NULL,
    parametres_id integer NOT NULL REFERENCES enrichissement.parametres_scoring(id),
    calcule_le    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (question_id, formation_id)
);
```

Table de cache recalculable à tout moment depuis `officiel` plus la couche
éditoriale. Elle ne contient aucune vérité propre.

### 3.5 Session de quiz : rien en base

La banque de questions est en base. **La session ne l'est pas.** Les réponses
restent dans le navigateur, conformément à la section 1.2. Pas de table
`session`, pas de table `reponse`, pas d'identifiant de session côté serveur.

Si une mesure d'audience devient nécessaire, elle se limitera à des
compteurs agrégés sans lien entre eux, décidés séparément et documentés. Ce
n'est pas dans la cible de la V1.

---

## 4. Algorithme de scoring

### 4.1 Position d'une formation sur une question

Pour un scrutin `s` associé à la question `q`, de sens `σ_s` et de poids
`w_s`, et un groupe `g` :

```
exprimes(s,g) = pour(s,g) + contre(s,g) + abstention(s,g)
```

`non_votant` est exclu du dénominateur, et une absence n'est pas une donnée
(AGENTS.md section 5 règle 2). Un groupe dont `exprimes(s,g) = 0` est exclu
de ce scrutin, ce qui n'est pas un désaccord mais une absence de mesure.

```
brut(s,g) = σ_s × ( pour(s,g) − contre(s,g) ) / exprimes(s,g)      ∈ [−1, +1]
```

L'abstention ne compte ni d'un côté ni de l'autre mais reste au
dénominateur : un groupe qui s'abstient massivement obtient une position
proche de 0, ce qui est le comportement voulu. Un groupe unanime POUR sur un
scrutin de sens +1 obtient +1.

Décote temporelle, appliquée à la date du scrutin :

```
λ(s) = 0,5 ^ ( age_mois(s) / demi_vie_mois )
```

```
Position(q,g) = Σ_s w_s · λ(s) · brut(s,g)  /  Σ_s w_s · λ(s)
```

**Choix de la demi-vie.** Aucune valeur n'est neutre, et la demande est
explicite sur le fait de ne pas trancher sans expliquer. Trois repères :

- demi-vie de 48 mois : un vote de la XVIe législature pèse environ la moitié
  d'un vote récent de la XVIIe. Recommandé comme valeur de départ, parce
  qu'une législature est la vraie unité de changement d'une position de
  groupe, et qu'un changement de législature s'accompagne souvent d'un
  changement de nom, de périmètre et de ligne.
- demi-vie de 24 mois : la XVIe pèse environ un quart. Trop agressif tant que
  la XVe n'est pas chargée, car le corpus se réduirait à la seule XVIIe.
- pas de décote : défendable pour un usage historique, pas pour répondre
  « quel parti me correspond aujourd'hui ».

La valeur est en base, pas dans le code, et le résultat affiché indique
laquelle a servi.

### 4.2 Confiance dans la position

Trois faiblesses différentes doivent baisser la confiance, et elles ne se
confondent pas.

**Couverture** : peu de scrutins ou peu de votants.

```
couverture = min(1, n_scrutins / min_scrutins) × min(1, n_votes / min_votes)
```

**Cohésion interne** : le groupe était-il d'accord avec lui-même.

```
unite(s,g)  = max(pour, contre, abstention) / exprimes(s,g)
cohesion    = Σ_s w_s·λ(s)·unite(s,g) / Σ_s w_s·λ(s)
```

**Constance entre scrutins** : le groupe a-t-il voté dans le même sens sur
tous les scrutins retenus. Un groupe qui vote +1 sur l'un et −1 sur l'autre a
une position moyenne de 0 qui ne veut rien dire.

```
dispersion = écart-type pondéré des brut(s,g) autour de Position(q,g)
constance  = 1 − min(1, dispersion)
```

```
confiance(q,g) = couverture × cohesion × constance
```

Ces trois composantes restent stockées séparément et consultables. Le libellé
public (« élevée », « moyenne », « faible ») vient des seuils en base, et le
détail chiffré reste accessible.

Sous `min_scrutins` ou `min_votes`, la position n'est pas publiée du tout :
elle est marquée « données insuffisantes », jamais remplacée par 0, qui se
lirait comme une position neutre mesurée.

### 4.3 Réponse de l'utilisateur

| Réponse | Valeur |
| --- | --- |
| Tout à fait d'accord | +1 |
| Plutôt d'accord | +0,5 |
| Ni d'accord ni pas d'accord | 0 |
| Plutôt pas d'accord | −0,5 |
| Pas du tout d'accord | −1 |
| Je ne sais pas | question exclue du calcul |

« Ni d'accord ni pas d'accord » est une position mesurée à 0. « Je ne sais
pas » retire la question du numérateur **et** du dénominateur. Les deux ne
doivent jamais être confondus, et le nombre de questions écartées est affiché
avec le résultat.

### 4.4 Compatibilité

Accord sur une question, pour une réponse `r ∈ [−1, 1]` :

```
accord(q,g) = 1 − |r − Position(q,g)| / 2                          ∈ [0, 1]
```

Compatibilité globale, avec `ι_q` le poids d'importance déclaré par
l'utilisateur (1 par défaut, `poids_sujet_important` si le sujet est signalé
comme important) :

```
Compatibilite(g) = Σ_q ι_q · confiance(q,g) · accord(q,g)
                 / Σ_q ι_q · confiance(q,g)
```

La confiance sert de poids : une question sur laquelle la position du groupe
est incertaine pèse moins dans son score, ce qui évite qu'un groupe divisé
soit classé premier par accident.

### 4.5 Exemple chiffré

Question : « Faut-il davantage taxer les personnes ayant les revenus les plus
élevés pour financer les services publics ? »

Trois scrutins retenus, groupe fictif G, demi-vie 48 mois :

| Scrutin | Date | Sens | Poids | pour | contre | abst. | brut | λ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | 2026-01 | +1 | 1,0 | 60 | 5 | 5 | +0,786 | 0,99 |
| B | 2025-06 | −1 | 1,0 | 8 | 55 | 7 | +0,671 | 0,90 |
| C | 2023-03 | +1 | 0,5 | 30 | 30 | 10 | 0,000 | 0,62 |

Scrutin B : le texte baissait la fiscalité, le groupe a voté CONTRE, donc
`σ = −1` et `brut = −1 × (8 − 55)/70 = +0,671`, position favorable à la
question. C'est exactement le cas que la règle de sens protège.

```
Σ w·λ = 0,99 + 0,90 + 0,31 = 2,20
Position = (0,99×0,786 + 0,90×0,671 + 0,31×0,000) / 2,20 = 0,629
```

Unités : A = 0,857, B = 0,786, C = 0,429. Cohésion pondérée = 0,762.
Dispersion des `brut` autour de 0,629 : environ 0,33, donc constance = 0,67.
Avec une couverture pleine, `confiance = 1 × 0,762 × 0,67 = 0,51`, soit
« moyenne ». Le scrutin C, sur lequel le groupe s'est coupé en deux, est ce
qui fait chuter la confiance, et c'est le résultat voulu.

Un utilisateur répondant « Plutôt d'accord » (`r = +0,5`) obtient
`accord = 1 − |0,5 − 0,629| / 2 = 0,935`.

---

## 5. Quiz adaptatif

### 5.1 Pourquoi c'est possible sans serveur

`enrichissement.question_position` est petite : 200 questions × 15 formations
× quelques nombres, soit quelques dizaines de kilo-octets en JSON. Elle est
livrée au navigateur au chargement du quiz, avec la banque de questions
utile. Toute la sélection adaptative se fait donc localement, sans qu'aucune
réponse ne parte.

### 5.2 Sélection

Après `k` réponses, on dispose d'une compatibilité provisoire par formation.
Soit `T` l'ensemble des formations encore en lice (par exemple celles à moins
de 10 points de la première).

La question suivante est celle qui sépare le mieux les formations de `T` :

```
discrimination(q) = Σ_{(g,h) ∈ T²,  g<h}  proximite(g,h)
                    × |Position(q,g) − Position(q,h)|
                    × confiance(q,g) × confiance(q,h)
```

`proximite(g,h)` donne plus de poids aux paires actuellement proches : séparer
les deux premiers vaut mieux que séparer le premier et le dernier, ce qui est
exactement le cas cité dans la demande.

Deux garde-fous s'appliquent par-dessus :

- **Équilibre thématique** : la part maximale par thème de
  `QUIZ_METHODOLOGY.md` section 3 reste appliquée. Sans elle, le moteur
  concentrerait le quiz sur le thème le plus clivant, et le résultat ne
  vaudrait que pour ce thème.
- **Amorçage** : les premières questions (cinq environ) sont tirées pour
  couvrir des thèmes différents, pas pour discriminer. Adapter dès la
  première question sur une compatibilité calculée sur zéro réponse n'a pas
  de sens.

### 5.3 Ce qui doit exister dès la V1

Rien de l'adaptatif n'est nécessaire en V1, mais deux choses doivent être
faites dès le départ pour ne pas avoir à tout reprendre :

1. `question_position` livrée au navigateur pour **toutes** les questions
   candidates, pas seulement pour les questions tirées.
2. La sélection isolée dans un module dédié, appelé à chaque étape et non une
   seule fois au démarrage.

---

## 6. Parcours et écrans

| Écran | Route | Contenu |
| --- | --- | --- |
| Accueil quiz | `/quiz` | Promesse, nombre de questions, durée, ce que le résultat n'est pas |
| Question | `/quiz` (état) | Une question, 6 réponses, « Question 7 / 18 », retour arrière, « En savoir plus » repliable, marquer le sujet comme important |
| Pronostic | `/quiz` (état) | Facultatif, avant le résultat : « quel parti pensiez-vous obtenir ? » |
| Résultat | `/quiz` (état) | Classement des formations avec confiance, profil par thème, mention obligatoire |
| Explication | dépliable par question | Réponse donnée, position de chaque formation, scrutins retenus avec dates, décomptes et liens |
| Partage | image ou page | Top 3 et thèmes, jamais le détail des réponses |
| Administration | `/admin/questions` | Voir section 10, phase 4 |

Règles d'interface, reprises de la demande : une question par écran, pas de
nom de parti ni de candidat pendant le quiz, aucun marqueur « de gauche » ou
« de droite », langage simple, mobile d'abord, lecture possible sans ouvrir
« En savoir plus ».

Le pronostic est demandé **après** la dernière réponse et n'entre dans aucun
calcul. Le stocker dans l'état local suffit.

---

## 7. Risques et biais à surveiller

**La sélection des scrutins détermine le résultat.** C'est le risque
principal, et il n'est pas technique. Choisir trois scrutins plutôt que trois
autres pour représenter « faut-il taxer davantage les hauts revenus » change
le classement. Atténuation : `justification` obligatoire, banque publiée et
versionnée, question inactive par défaut tant qu'elle n'a pas été relue.

**Le vote parlementaire n'est pas une opinion.** Un groupe d'opposition vote
contre un texte dont il partage une partie de l'objectif. Une majorité vote
un texte par solidarité gouvernementale. C'est la menace la plus sérieuse
pour la validité du résultat, et elle ne se corrige pas par la formule : elle
se corrige en écartant les scrutins où le vote était positionnel, ce qui est
un travail éditorial.

**Effet majorité / opposition.** Sur un corpus dominé par une législature, le
moteur mesure en partie l'appartenance à la majorité du moment plutôt qu'une
orientation. Mêler deux législatures de majorités différentes atténue l'effet.

**Groupes petits.** Un groupe de 12 membres produit des positions instables.
Les seuils `min_votes` répondent à cela, pas la formule.

**Correspondance formation vers groupe.** Décider que tel groupe prolonge tel
autre est une affirmation sur des formations réelles. Elle porte sa source ou
elle n'est pas publiée.

**Décote temporelle.** Elle peut effacer un changement de ligne réel autant
qu'elle peut le refléter. Publier la demi-vie utilisée est le minimum.

**Abstention.** Traitée comme tirant vers 0 côté groupe (section 4.1), et
comme position mesurée côté utilisateur. Ce sont deux actes différents, et ce
rapprochement est un choix documenté, pas une évidence.

**Faux sentiment de précision.** Ne jamais afficher de décimale sur une
compatibilité. « 73 % » avec une confiance moyenne est honnête, « 73,4 % » ne
l'est pas.

**Couverture réelle.** Tant que la XVe législature n'est pas chargée, le
moteur parle de quatre ans, pas de dix. Le dire dans la méthodologie publiée.

---

## 8. Tests nécessaires

Le projet tient que rien n'est vérifié tant que ce n'est pas contrôlé contre
un fait connu par ailleurs (`docs/PIPELINE.md`, `CLAUDE.md`).

1. **Contrôle manuel d'une question.** Prendre une question, ses scrutins, et
   recalculer à la main la position d'un groupe depuis les décomptes
   `scrutin_groupe`. C'est le test qui compte.
2. **Inversion de sens.** Une question et sa négation, sur les mêmes
   scrutins avec `sens` inversé, doivent donner des positions opposées.
3. **Décote.** Deux scrutins identiques à dates différentes doivent produire
   la position attendue, et une demi-vie nulle doit annuler la décote.
4. **Abstention et non-votants.** Un groupe unanimement abstentionniste donne
   position 0 et non une absence ; les non-votants ne changent pas le
   dénominateur.
5. **« Je ne sais pas ».** Ajouter une réponse « je ne sais pas » ne doit
   modifier aucune compatibilité, seulement le nombre de questions retenues.
6. **Bornes.** `position ∈ [−1,1]`, `confiance ∈ [0,1]`, `accord ∈ [0,1]`
   pour toute entrée, y compris les cas vides.
7. **Invariant de confidentialité.** Test automatique vérifiant que
   `src/lib/quizCalcul.ts` et le module de sélection n'importent rien de
   `src/queries/`, et qu'aucune fonction serveur ne prend de réponse en
   paramètre. C'est le seul test qui protège la contrainte de la section 1.2.
8. **Données insuffisantes.** Une formation sous les seuils ne doit jamais
   apparaître avec une position de 0.

---

## 9. Fonctions et composants

### Requêtes serveur, `src/queries/`

| Fonction | Rôle |
| --- | --- |
| `chargerBanqueQuiz()` | Questions actives, positions, confiances, formations, paramètres actifs. Données publiques uniquement. |
| `chargerExplicationQuestion(id)` | Scrutins retenus, sens, poids, décomptes par groupe, dates, liens |
| `listerQuestionsAdmin(filtres)` | Banque complète, y compris inactives et signalées |
| `enregistrerQuestion(...)` | Écriture administrateur |

Aucune ne reçoit de réponse d'utilisateur, jamais.

### Calcul, `src/lib/`

| Module | Rôle |
| --- | --- |
| `quizPosition.ts` | `calculerPosition`, `calculerConfiance`, purs, partagés serveur et navigateur |
| `quizScore.ts` | `accord`, `compatibilite`, `profilParTheme` |
| `quizSelection.ts` | `amorcer`, `questionSuivante`, `discrimination` |

`src/lib/quizCalcul.ts` actuel est remplacé par ces trois modules.

### Composants, `src/components/`

À créer : `CarteQuestion`, `EchelleReponse` (les 6 réponses), `BarreConfiance`,
`ExplicationQuestion` (dépliable), `ProfilParTheme`, `CarteResultat`.

À réutiliser : `BarreHorizontale` (accepte déjà une couleur de formation),
`PastilleGroupe`, `Hemicycle` pour l'explication d'un scrutin.

---

## 10. Plan d'implémentation

### Phase 0 : préalables

- **T0.1** Charger la XVe législature, porter la couverture à neuf ans.
- **T0.2** Créer le schéma `enrichissement` et les tables de la section 3.
- **T0.3** Renseigner `formation` et `formation_groupe` pour les groupes des
  trois législatures, avec sources.

### Phase 1 : V1, quiz fixe explicable

- **T1.1** Calcul de position et de confiance (`quizPosition.ts`) et tests 1 à 6.
- **T1.2** Script de recalcul de `question_position`, rejouable.
- **T1.3** Rédiger 20 à 25 questions avec leurs scrutins, sens, poids et
  justifications. C'est le poste le plus lourd, et il est éditorial.
- **T1.4** `chargerBanqueQuiz`, livraison au navigateur.
- **T1.5** Écrans question et résultat, échelle à 6 réponses.
- **T1.6** Explication par question, dépliable jusqu'au scrutin.
- **T1.7** Test d'invariant de confidentialité (test 7).
- **T1.8** Page méthodologie mise à jour : demi-vie, seuils, couverture réelle.

### Phase 2 : V2, banque étendue

- **T2.1** Porter la banque à 100 questions et plus.
- **T2.2** Sélection pondérée par thème sur banque large.
- **T2.3** Marquage « sujet important pour moi » et pondération individuelle.
- **T2.4** Détection des questions fragiles (peu de scrutins, confiance basse
  partout, dispersion forte).

### Phase 3 : V3, adaptatif

- **T3.1** `quizSelection.ts`, amorçage puis discrimination.
- **T3.2** Réglage de la taille de `T` et du nombre de questions d'amorçage.
- **T3.3** Contrôle que l'équilibre thématique tient sous sélection adaptative.

### Phase 4 : administration et partage

- **T4.1** `/admin/questions` : liste, création, association de scrutins,
  sens, poids, aperçu des positions calculées.
- **T4.2** Signalement des questions problématiques.
- **T4.3** Écran de pronostic et carte de partage.

### Phase 5 : V4, programmes

- **T5.1** Source de programmes, à identifier. N'existe pas aujourd'hui.
- **T5.2** Double lecture votes observés contre programme déclaré.

---

## 11. Ce qui reste à trancher

Ces points demandent une décision qui n'est pas technique, et aucun n'est
tranché ici :

1. La demi-vie de la décote temporelle (section 4.1 propose 48 mois).
2. Les seuils `min_scrutins` et `min_votes` sous lesquels une position n'est
   pas publiée.
3. Le poids d'un sujet déclaré important (facteur 2 proposé).
4. La liste des formations et leur correspondance avec les groupes, qui
   suppose des sources.
5. Le nombre de questions du quiz, entre 15 et 20.
6. Si les scrutins d'une même loi doivent être plafonnés dans une question,
   comme `QUIZ_METHODOLOGY.md` section 5.3 le fait par dossier.
