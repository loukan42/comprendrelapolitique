# Méthodologie du quiz et du calcul de proximité politique

Ce document détaille la spécification section 10 à 13 : comment un scrutin
devient une question de quiz, comment les quatre types de quiz choisissent
leurs questions, et comment se calcule la proximité politique affichée à
l'utilisateur. Le calcul est écrit ici avec la précision que la spécification
demande section 27 : « publier les formules de scoring, aucune boîte noire ».
Ce document est le brouillon de la future page « Comment ça marche ? ».

État au 13/09/2026 : aucune table `enrichissement.quiz`,
`enrichissement.question` ou `enrichissement.resultat_proximite` n'existe
encore, et `data/` n'est pas peuplé dans ce checkout. Ce document fixe l'
algorithme à implémenter, pas un résultat observé sur des données réelles.

## 1. Contrainte de conception qui domine tout le reste

**Le calcul de proximité s'exécute entièrement dans le navigateur.** Une
réponse à une question de quiz est une opinion politique, donc une donnée
sensible au sens de l'article 9 du RGPD. Les réponses de l'utilisateur ne
doivent jamais atteindre le serveur, ni en clair ni sous une forme qui
permettrait de les reconstituer (pas d'envoi agrégé, pas de journalisation
côté client qui remonterait par un outil d'analytics tiers).

Conséquence directe sur l'architecture : le serveur envoie au client les
données nécessaires au calcul (liste des questions éligibles, distribution des
votes par groupe pour chaque scrutin retenu, poids et thème de chaque question),
et le client fait tout le reste : comparaison, agrégation, affichage. Rien de
ce que l'utilisateur répond ne sert de base à une requête réseau ultérieure. Si
un compte utilisateur existe un jour (spec section 26, phase 2) et propose de
sauvegarder un résultat, ce sera un choix explicite et opt-in de l'utilisateur,
jamais un comportement par défaut.

## 2. D'un scrutin à une question de quiz

### 2.1 Scrutins éligibles

Un scrutin ne devient une question de quiz que s'il remplit toutes les
conditions suivantes :

1. `scrutin.est_vote_sur_ensemble = true`. Les votes d'amendement et d'article
   isolé ne se prêtent pas à une question grand public formulée simplement.
2. `scrutin.type_vote_code <> 'MOC'`. Une motion de censure n'enregistre que
   les votes POUR (DATA_SOURCES.md section 3.1) : la question « auriez-vous
   voté pour ? » n'a pas de symétrique CONTRE observable, donc aucune
   comparaison n'est possible. Exclusion imposée par AGENTS.md section 5.3.
3. Le scrutin est rattaché à un dossier avec `methode <> 'CONFLIT'`
   (`officiel.scrutin_dossier`). Un scrutin dont le rattachement est en
   conflit ne peut pas recevoir de manière fiable le thème et le score
   d'importance de son dossier.
4. Le dossier a au moins un thème assigné (`enrichissement.dossier_theme`),
   nécessaire à l'équilibrage thématique décrit section 3.

Un dossier adopté par 49.3 (`officiel.dossier_49_3`) n'a par construction
aucun scrutin sur l'ensemble : il ne peut donc jamais fournir de question de
quiz, ce qui est cohérent avec l'absence de vote individuel à comparer.

### 2.2 Formulation neutre avant révélation

Chaque question de quiz est rédigée à partir de `scrutin.objet_libelle` et du
résumé du dossier, avec deux contraintes non négociables :

- la formulation est posée en amont de toute révélation d'un vote de groupe.
  Elle ne doit jamais contenir de sigle de parti, de nom de gouvernement, ni de
  date qui trahirait l'issue politique du vote ;
- la formulation ne doit jamais déformer ce qui était réellement soumis au
  vote (spec section 10, dernière phrase). Une question qui simplifie un
  dispositif technique doit rester fidèle à l'alternative réellement posée
  (« faut-il repousser l'âge légal de départ à la retraite », pas « êtes-vous
  pour ou contre la réforme des retraites », qui mélange plusieurs mesures).

La formulation peut être proposée par l'IA mais doit être relue par un humain
avant publication, comme tout contenu d'`enrichissement` engageant une
affirmation sur le contenu d'un texte (voir AGENTS.md section 5, règle 6, et
DATA_MODEL.md section 7 sur les citations obligatoires). La question stockée
référence toujours `scrutin_uid` : c'est la citation qui permet, après
réponse, d'afficher « ce qui était réellement soumis au vote ».

### 2.3 Après la réponse de l'utilisateur

Dans l'ordre imposé par la spécification section 10 : contexte en quelques
lignes, ce qui était réellement soumis au vote (texte, date, lecture), vote des
groupes (voir section 4), lien « en savoir plus » vers la page dossier.

## 3. Sélection des questions par type de quiz

Toute sélection part du même pool : les scrutins éligibles (section 2.1),
chacun portant le `salience_score` de son dossier (docs/SCORING.md) et un ou
plusieurs thèmes hérités de son dossier.

### 3.1 Algorithme commun : sélection pondérée par thème avec plafond par dossier

```
fonction selectionner(pool, n_cible, part_max_par_theme, max_par_dossier):
    trier pool par salience_score décroissant
    retenus = []
    compte_theme = {}
    compte_dossier = {}
    pour chaque scrutin dans pool:
        si len(retenus) == n_cible: arrêter
        theme_principal = thème dominant du dossier du scrutin
        si compte_dossier[dossier] >= max_par_dossier: continuer
        si compte_theme[theme_principal] >= part_max_par_theme × n_cible: continuer
        ajouter scrutin à retenus
        incrémenter compte_theme[theme_principal], compte_dossier[dossier]
    si len(retenus) < n_cible:
        compléter en relâchant d'abord la contrainte de thème, puis celle de dossier,
        toujours par salience_score décroissant
    retourner retenus
```

Le relâchement en cas de sous-remplissage est nécessaire parce qu'un plafond
strict peut ne pas suffire à atteindre `n_cible` si un thème est trop rare
dans le pool (l'immigration, par exemple, produit historiquement moins de
votes sur l'ensemble que l'économie). Relâcher la contrainte de thème avant
celle de dossier préserve la garantie plus importante : ne pas laisser un seul
dossier saturer le quiz (voir section 5.4 sur la corrélation des votes d'un
même texte).

### 3.2 Grand quiz politique, 20 à 30 questions

```
n_cible = 25          (point médian de la fourchette 20-30 de la spec)
part_max_par_theme = 0,30    (interdit à un thème de dépasser 30 % des questions,
                               ce qui répond directement à l'exemple donné par la
                               spec : 15 questions économiques sur 20-30 ne doivent
                               pas monopoliser le résultat)
max_par_dossier = 2
pool = tous les scrutins éligibles, toutes législatures confondues
```

### 3.3 Quiz thématique, 10 à 15 questions

```
n_cible = 12
part_max_par_theme = 1,0     (un seul thème choisi en amont, pas de plafond interne)
max_par_dossier = 2
pool = scrutins éligibles dont le thème choisi figure parmi les thèmes du dossier
```

La liste des thèmes proposés reprend la taxonomie de la spécification section
8 : économie, écologie, immigration, santé, retraites, entreprises, pouvoir
d'achat, libertés publiques, énergie, et les autres thèmes de la taxonomie
selon la disponibilité de questions.

### 3.4 Quiz par période, une fourchette par législature

```
n_cible = 20
part_max_par_theme = 0,30
max_par_dossier = 2
pool = scrutins éligibles dont scrutin.legislature correspond à la période
       (XVe = 2017-2022, XVIe = 2022-2024, XVIIe = depuis 2024)
```

### 3.5 Quiz express, 5 questions

```
n_cible = 5
part_max_par_theme = 0,40    (au plus 2 questions du même thème sur 5)
max_par_dossier = 1          (chaque question vient d'un dossier différent,
                               pour maximiser la diversité des sujets couverts
                               vu le format très court)
pool = tous les scrutins éligibles, salience_score le plus élevé
```

## 4. Vote des groupes affiché après la réponse

Pour chaque question, une fois la réponse donnée, afficher pour chaque groupe
ayant siégé lors du scrutin :

```
pour_pct(g)        = voix_pour(g)        / total_exprime(g)
contre_pct(g)       = voix_contre(g)      / total_exprime(g)
abstention_pct(g)  = voix_abstention(g)  / total_exprime(g)

où total_exprime(g) = voix_pour(g) + voix_contre(g) + voix_abstention(g)
```

`total_exprime` exclut les non-votants (`voix_non_votant`) du dénominateur :
un non-votant occupe une position enregistrée mais n'exprime ni accord ni
désaccord, l'inclure diluerait la lecture du positionnement réel du groupe.
Ce choix doit être documenté à l'écran par une mention du type « parmi les
votes exprimés, hors non-votants ». Les décomptes utilisés sont toujours ceux
de `officiel.scrutin_groupe` (`voix_*`, issus de `decompteVoix`), jamais une
reconstruction à partir des listes nominatives, pour rester cohérent avec la
règle DATA_SOURCES.md section 5.5 : en cas d'écart entre les deux, c'est
l'agrégat officiel qui fait foi et l'écart se signale, il ne se corrige pas en
silence.

Ne jamais présenter un groupe comme unanimement favorable ou défavorable s'il
ne l'était pas (spec section 6). Le taux d'unité défini section 5.2 ci-dessous
doit rester affichable à côté de chaque barre de résultat.

## 5. Calcul de proximité politique

C'est la fonctionnalité la plus délicate du produit parce qu'elle produit un
chiffre sur une personne à partir des votes d'autres personnes. Sa validité
tient à ce qu'elle ne prétend mesurer, et à rien de plus, qu'une concordance
observée : « sur les scrutins étudiés, vos réponses sont les plus proches des
votes observés de… », jamais « vous êtes de tel parti », jamais une
recommandation de vote (spec section 12, première phrase, reprise texto dans
l'encart obligatoire de fin de résultat, section 5.7).

### 5.1 Notation

Pour une question `i` (un scrutin), un groupe `g`, et la réponse de
l'utilisateur `r_i ∈ {POUR, CONTRE, ABSTENTION}` (les réponses « je ne sais
pas / passer » sont exclues de tout calcul, voir section 5.6) :

```
n_pour(i,g), n_contre(i,g), n_abstention(i,g)   -- issus de scrutin_groupe
total_exprime(i,g) = n_pour(i,g) + n_contre(i,g) + n_abstention(i,g)
```

Un groupe qui n'a pas siégé au moment du scrutin `i`, ou dont
`total_exprime(i,g) = 0`, est exclu du calcul pour cette question et ce
groupe seulement (pas un désaccord, une absence de donnée).

### 5.2 Concordance sur une question, et taux d'unité du groupe

La concordance n'est pas une comparaison à la position majoritaire du groupe,
c'est la part de la distribution réelle qui coïncide avec la réponse de
l'utilisateur :

```
concordance(i, g) = n_{r_i}(i, g) / total_exprime(i, g)
```

Où `n_{r_i}(i, g)` désigne le nombre de voix du groupe correspondant
exactement à la réponse de l'utilisateur (par exemple `n_pour(i,g)` si
`r_i = POUR`). Un groupe unanime sur la réponse de l'utilisateur donne 1, un
groupe unanime sur la position opposée donne 0, un groupe partagé donne une
valeur intermédiaire. C'est le comportement recherché par la spécification :
« une réponse POUR doit produire une forte proximité mais pas être considérée
comme une unanimité » quand le groupe vote 82 % POUR.

Le taux d'unité du groupe sur la question mesure, indépendamment de la
réponse de l'utilisateur, à quel point le groupe était lui-même homogène :

```
unite(i, g) = max(n_pour(i,g), n_contre(i,g), n_abstention(i,g)) / total_exprime(i, g)
```

`unite(i,g)` doit rester consultable partout où `concordance(i,g)` est
affichée. C'est lui qui permet au lecteur de juger de la solidité du
rapprochement : une concordance de 0,90 sur un groupe dont `unite = 0,52`
distingue beaucoup moins de choses qu'une concordance de 0,90 sur un groupe
dont `unite = 0,98`. Le produit n'a pas vocation à fondre les deux en un seul
nombre : ils sont publiés côte à côte.

### 5.3 Poids d'une question et plafonnement par dossier

Toutes les questions ne comptent pas également. Le poids brut vient du score
d'importance publique du dossier (docs/SCORING.md) :

```
poids_brut(i) = salience_score(dossier(i))     -- 0 à 100
```

Les votes d'un même dossier sont corrélés : un texte qui passe par deux
lectures et une CMP peut produire plusieurs scrutins sur l'ensemble, et
traiter ces votes comme indépendants gonflerait artificiellement la précision
apparente du résultat pour ou contre ce seul texte. Deux mécanismes de
plafonnement s'appliquent, dans cet ordre :

1. **Atténuation intra-dossier.** Si un dossier `d` contribue `k(d)` questions
   au quiz (k(d) ≥ 1, borné par `max_par_dossier` de la section 3) :

   ```
   poids_attenue(i) = poids_brut(i) / sqrt(k(d))
   ```

   La racine carrée réduit la contribution des questions supplémentaires sans
   les annuler : un dossier apportant 2 questions au lieu d'1 pèse environ 1,41
   fois plus, pas 2 fois plus.

2. **Plafond global par dossier.** Après atténuation, si un dossier représente
   plus de 15 % du poids total du quiz, ses questions sont mises à l'échelle
   pour ramener sa part à 15 % exactement :

   ```
   si Σ_{i ∈ d} poids_attenue(i) > 0,15 × Σ_j poids_attenue(j) :
       facteur = 0,15 × Σ_j poids_attenue(j) / Σ_{i ∈ d} poids_attenue(i)
       poids(i) = poids_attenue(i) × facteur      pour tout i ∈ d
   sinon :
       poids(i) = poids_attenue(i)
   ```

Le plafond de 15 % est un choix éditorial de départ, documenté comme tel,
comme les poids du barème institutionnel de SCORING.md. Il devra être révisé
si un test sur un vrai quiz montre qu'il change trop peu, ou trop, le
classement final.

### 5.4 Proximité globale et proximité par thème

Restreinte aux questions auxquelles l'utilisateur a répondu par POUR, CONTRE
ou ABSTENTION (section 5.6), et pour lesquelles `total_exprime(i,g) > 0` :

```
proximite_globale(g) = Σ_i poids(i) × concordance(i, g)  /  Σ_i poids(i)
```

```
proximite_theme(g, t) = Σ_{i : t ∈ themes(i)} poids(i) × concordance(i, g)
                          / Σ_{i : t ∈ themes(i)} poids(i)
```

Une question multi-thème contribue à chacun de ses thèmes avec son poids
entier, pas divisé entre eux : un dossier économique et environnemental compte
pleinement dans les deux proximités thématiques, ce qui correspond à l'usage
attendu (« Économie : 84 %, Écologie : 55 % » dans l'exemple de la
spécification, calculés indépendamment).

Affichage : pourcentage entier, jamais de décimale, pour la même raison que le
score d'importance. Vingt à trente questions ne portent pas une précision au
dixième de point.

### 5.5 Accords, désaccords, non-réponses

- **Accords principaux** : questions triées par `poids(i) × concordance(i, g)`
  décroissant, pour le groupe affiché.
- **Désaccords principaux** : questions triées par `poids(i) × (1 - concordance(i, g))`
  décroissant.
- **Questions non répondues** : toute question de quiz à laquelle l'utilisateur
  a répondu « je ne sais pas / passer », affichée à part, jamais comptée comme
  un désaccord ni retirée silencieusement du décompte total de questions
  posées.

### 5.6 Le cas de l'abstention

L'abstention de l'utilisateur et l'abstention d'un député ne sont pas le même
acte. La première est souvent une hésitation ou un refus de trancher dans un
contexte de quiz ; la seconde est une position parlementaire parfois
tactique, prise en connaissance du dossier. Le rapprochement retenu ici est un
choix documenté, pas un implicite : `r_i = ABSTENTION` est comparé
exactement comme POUR ou CONTRE, sans pondération réduite ni crédit partiel
envers les votes POUR ou CONTRE. Une conséquence prévisible en découle : un
utilisateur répondant souvent ABSTENTION obtiendra mécaniquement une
proximité plus faible avec la plupart des groupes, qui s'abstiennent
généralement moins souvent qu'ils ne votent POUR ou CONTRE. Ce n'est pas un
défaut à corriger silencieusement en ajoutant du crédit partiel : c'est une
limite à afficher dans la méthodologie publiée, pour que le lecteur puisse en
tenir compte.

« Je ne sais pas / passer » est distinct de l'abstention : cette réponse
retire la question du calcul entièrement (section 5.5), alors que
l'abstention y participe comme une position à part entière.

### 5.7 Mention obligatoire

Chaque résultat de proximité affiche, sans exception et sans pouvoir être
masquée par un réglage d'interface, la mention imposée par la spécification
section 12 :

> Ce résultat compare uniquement vos réponses à des votes parlementaires
> passés. Il ne constitue pas une recommandation électorale et ne tient pas
> compte de l'ensemble des programmes, candidats ou enjeux futurs.

### 5.8 Groupe parlementaire, pas parti

La comparaison se fait contre des groupes parlementaires (`organe.code_type =
'GP'`), pas contre des partis politiques (`code_type = 'PARPOL'`), parce que
c'est au niveau du groupe que le vote est enregistré (spec section 13,
DATA_MODEL.md section 3). Un quiz par période reste à l'intérieur d'une seule
législature, donc d'un seul ensemble de groupes actifs, ce qui évite le
problème des groupes qui changent de nom ou de périmètre entre législatures.
Le grand quiz et les quiz thématiques, en revanche, peuvent mélanger des
scrutins de législatures différentes : dans ce cas, chaque scrutin compare
l'utilisateur au groupe tel qu'il existait au moment de ce vote précis
(`organe_uid` de `officiel.vote`, déjà daté par construction), et le résultat
agrégé par groupe se limite aux groupes ayant existé sous au moins une
législature couverte, affichés avec leur période d'existence. Une couche de
correspondance groupe vers parti, permettant d'agréger par exemple LR et LFI
à travers les changements de sigle entre législatures, n'existe pas encore et
n'est pas nécessaire au MVP ; si elle est ajoutée, elle devra rester
transparente et historisée comme l'exige la spécification section 13, pas une
table de correspondance implicite dans le code de calcul.

## 6. Ce que ce calcul ne mesure pas

Une concordance élevée avec un groupe sur vingt à trente scrutins ne dit rien
sur l'individu qui répond, seulement sur la ressemblance entre ses réponses et
les votes observés du groupe sur cet échantillon précis de scrutins. C'est
une inférence agrégée, pas un profil : comparer une réponse individuelle à la
distribution d'un groupe ne permet aucune inférence sur cette personne
au-delà de la concordance mesurée. Le choix des scrutins détermine le
résultat : un quiz à dominante économique produira un classement de groupes
pertinent pour l'économie, pas une image complète des opinions politiques de
l'utilisateur. C'est la raison d'être de l'équilibrage thématique de la
section 3, qui n'est pas un confort d'affichage mais une condition de
validité du résultat, et qui doit rester publiée avec le résultat (part
maximale par thème effectivement appliquée pour ce quiz).

## 7. Test qui départagerait ce que ce document affirme

Avant de publier ce calcul en production, faire tourner un quiz express (5
questions) sur un jeu de réponses connu à l'avance et vérifier à la main,
scrutin par scrutin, que la concordance et le taux d'unité affichés
correspondent au décompte `scrutin_groupe` du dossier. C'est le même principe
que `data:controler` (docs/PIPELINE.md) : un calcul qui s'exécute sans erreur
n'est pas un calcul correct, seul un contrôle contre un fait connu par
ailleurs le montre.
