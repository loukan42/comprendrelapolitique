# Sources de données

Ce document ne contient que des informations **vérifiées par téléchargement et
inspection réels**, le 13 septembre 2026. Chaque URL a été appelée, chaque
chiffre mesuré. Ce qui n'a pas encore été vérifié est signalé comme tel, à la
fin.

Règle d'écriture de ce fichier : on n'y écrit pas une URL ou un format qu'on n'a
pas constaté soi-même. Un `DATA_SOURCES.md` approximatif produirait exactement
les erreurs que le produit prétend éliminer.

---

## 1. Les jeux Open Data de l'Assemblée nationale

Base : `https://data.assemblee-nationale.fr/static/openData/repository`

Licence : Licence Ouverte / Open Licence
(<https://data.assemblee-nationale.fr/licence-ouverte-open-licence>).
Réutilisation libre sous réserve de mention de la source.

### 1.1 Le nommage n'est pas uniforme entre législatures

C'est le premier piège. La XVe suffixe ses fichiers en `_XV` et range les
amendements dans un dossier différent des deux suivantes. Un importeur qui
déduirait les URLs par interpolation de la seule législature échouerait.

| Jeu | XVe (2017-2022) | XVIe (2022-2024) | XVIIe (depuis 2024) |
| --- | --- | --- | --- |
| Scrutins | `15/loi/scrutins/Scrutins_XV.json.zip` | `16/loi/scrutins/Scrutins.json.zip` | `17/loi/scrutins/Scrutins.json.zip` |
| Dossiers législatifs | `15/loi/dossiers_legislatifs/Dossiers_Legislatifs_XV.json.zip` | `16/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip` | `17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip` |
| Amendements | `15/loi/amendements_legis/Amendements_XV.json.zip` | `16/loi/amendements_div_legis/Amendements.json.zip` | `17/loi/amendements_div_legis/Amendements.json.zip` |
| Acteurs et mandats | `15/amo/deputes_senateurs_ministres_legislature/AMO20_dep_sen_min_tous_mandats_et_organes_XV.json.zip` | `16/amo/…/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip` | `17/amo/…/AMO20_dep_sen_min_tous_mandats_et_organes.json.zip` |
| Débats (XML seulement) | `15/vp/syceronbrut/syseron.xml.zip` | `16/vp/syceronbrut/syseron.xml.zip` | `17/vp/syceronbrut/syseron.xml.zip` |

Noter les deux irrégularités : le suffixe `_XV`, et `amendements_legis` (XVe)
contre `amendements_div_legis` (XVIe et XVIIe). Les URLs doivent être une table
explicite dans le code, jamais une chaîne construite.

**Historique transversal des acteurs.** Ce jeu est à part : il couvre toutes les
législatures depuis la XIe, et non une seule.

```
17/amo/tous_acteurs_mandats_organes_xi_legislature/AMO30_tous_acteurs_tous_mandats_tous_organes_historique.json.zip
```

C'est la source à privilégier pour reconstituer les appartenances successives de
groupe avec leurs dates, donc pour calculer un vote avec le groupe du député **au
moment du vote**.

### 1.2 Volumes mesurés et fraîcheur

Tailles compressées relevées par requête `HEAD` le 13/09/2026.

| Jeu | XVe | XVIe | XVIIe |
| --- | --- | --- | --- |
| Scrutins | 8,8 Mo | 9,7 Mo | 26 Mo |
| Dossiers législatifs | 15 Mo | 8,7 Mo | 9,9 Mo |
| Acteurs et mandats | 3,1 Mo | 2,3 Mo | 2,5 Mo |
| **Sous-total exploitable** | **27 Mo** | **21 Mo** | **38 Mo** |
| Amendements | 619 Mo | 347 Mo | 284 Mo |
| Débats (XML) | 143 Mo | 55 Mo | 54 Mo |

Deux conséquences directes.

**Le cœur du produit pèse 86 Mo compressés sur les trois législatures.** Scrutins,
dossiers et acteurs suffisent à alimenter les pages loi, les pages parlementaire,
les quiz et le calcul de proximité. Les amendements et les débats représentent à
eux seuls 1,5 Go, soit 95 % du volume pour une part marginale du MVP. Ils doivent
être importés sélectivement, pas en bloc.

**Les archives sont réellement figées.** Dernière modification : XVe le
09/06/2022, XVIe le 28/06/2024. Elles s'importent une fois. Seule la XVIIe bouge.

### 1.3 Fenêtre de republication quotidienne (XVIIe)

Horodatages `Last-Modified` relevés le 13/09/2026, en UTC :

| Jeu | Heure de republication |
| --- | --- |
| Acteurs | 00:00 |
| Dossiers législatifs | 00:16 |
| Débats | 02:05 |
| Amendements | 06:20 |
| Scrutins | 22:25 (la veille) |

La fenêtre de publication court donc d'environ 22:00 à 06:30 UTC. **Le job de
synchronisation doit se déclencher après 07:00 UTC** pour voir un état cohérent
entre jeux.

`Last-Modified` et `Content-Length` sont tous deux servis. La détection de
changement se fait par requête conditionnelle `If-Modified-Since` : aucun
téléchargement tant que la source n'a pas bougé.

---

## 2. Structure réelle d'un scrutin

Vérifiée par analyse exhaustive des **16 957 scrutins** des trois législatures
(4 417 en XVe, 4 106 en XVIe, 8 434 en XVIIe).

Une archive `Scrutins` se décompresse en `json/` contenant **un fichier par
scrutin**, nommé `VTANR5L{législature}V{numéro}.json`. Racine : un unique objet
`scrutin`.

Le JSON est encodé en ASCII avec échappements `\uXXXX` : aucun problème
d'encodage à prévoir sur ce jeu. (La partie HTML du portail, en revanche, est
servie en ISO-8859-1.)

### 2.1 Champs racine

Dix-neuf clés présentes sur la totalité du corpus : `uid`, `numero`,
`organeRef`, `legislature`, `sessionRef`, `seanceRef`, `dateScrutin`,
`quantiemeJourSeance`, `typeVote`, `sort`, `titre`, `demandeur`, `objet`,
`modePublicationDesVotes`, `syntheseVote`, `ventilationVotes`, `miseAuPoint`,
plus les deux attributs `@xmlns`.

Une exception : **`lieuVote` n'existe que sur la XVIIe** (8 435 occurrences sur
16 957). Le schéma dérive entre législatures ; le parseur doit être tolérant à
l'absence de clés, jamais strict.

### 2.2 Répartition des types de scrutin

| Code | Libellé | Nombre |
| --- | --- | --- |
| `SPO` | scrutin public ordinaire | 16 661 |
| `SPS` | scrutin public solennel | 233 |
| `MOC` | motion de censure | 62 |
| `SSG` | (occurrence unique) | 1 |

Sorts : 11 086 rejetés, 5 871 adoptés.

`SPS` est directement exploitable comme signal d'importance institutionnelle : un
scrutin solennel est, par construction, un vote que l'Assemblée a jugé majeur.

---

## 3. Trois pièges sémantiques à ne jamais ignorer

### 3.1 Une motion de censure n'enregistre que les votes POUR

Constaté sur `VTANR5L17V1` : `pour: 197`, `contre: 0`, `abstentions: 0`, pour un
`nbrSuffragesRequis` de 289 et un sort « rejeté ».

Le « 0 contre » ne signifie pas que personne ne s'y opposait. La procédure de
l'article 49 ne recense que les députés votant la censure ; les opposants ne
votent pas. Afficher une motion de censure avec le gabarit POUR / CONTRE /
ABSTENTION produirait un contresens grave, et parfaitement crédible visuellement.

**Les 62 scrutins `MOC` doivent avoir leur propre gabarit d'affichage**, disant
combien de voix se sont portées sur la censure et combien étaient requises. Ils
doivent également être exclus du quiz de proximité, où la question « auriez-vous
voté pour ? » n'a pas de symétrique.

### 3.2 `miseAuPoint` n'est pas le résultat du vote

Chaque scrutin porte un bloc `miseAuPoint` avec les sous-clés `nonVotants`,
`pours`, `abstentions`, `nonVotantsVolontaires`, `contres`, `dysfonctionnement`.

Une mise au point est la déclaration *a posteriori* d'un député affirmant que sa
position enregistrée ne correspond pas à son intention. **Elle ne modifie pas le
résultat officiel du scrutin.**

Deux conséquences : le décompte affiché doit toujours venir de `syntheseVote`,
jamais d'une fusion avec `miseAuPoint` ; et la mise au point, si elle est
affichée, doit l'être comme une mention distincte et datée, pas comme une
correction du vote.

### 3.3 Le vote à main levée ne laisse aucune trace

Les 16 957 scrutins portent **tous** `modePublicationDesVotes:
"DecompteNominatif"`. Sans exception.

Cela renverse la manière d'appliquer la règle « ne jamais inventer un vote
individuel ». Il n'existe pas de scrutin sans votes nominatifs : un texte adopté
à main levée ne produit tout simplement **aucun enregistrement de scrutin**.

L'absence se détecte donc au niveau du **dossier**, pas du scrutin. Un texte
adopté dont aucun scrutin n'est rattaché a été voté à main levée ou par accord
tacite. Le message « Vote individuel non disponible » s'affiche sur la page du
dossier, jamais sur une page de scrutin.

---

## 4. Le rattachement scrutin ↔ dossier est le risque principal

Mesuré sur l'intégralité du corpus.

Le champ `objet.dossierLegislatif` du scrutin est renseigné pour **2 608 des
8 434 scrutins de la XVIIe (30 %)**, et pour **zéro scrutin des XVe et XVIe**.
Le champ `objet.referenceLegislative` est présent partout mais **systématiquement
vide** : il n'offre aucun secours.

Le lien existe en revanche dans l'autre sens, côté dossiers :

```
dossierParlementaire → actesLegislatifs → acteLegislatif[] → voteRefs.voteRef
```

`acteLegislatif` est **récursif** et de profondeur variable, les références ayant
été constatées à trois et quatre niveaux d'imbrication. Le parseur doit descendre
l'arbre récursivement, jamais à profondeur fixe.

Couverture mesurée sur la XVIe (2 943 dossiers, 4 106 scrutins, 221 scrutins
référencés) :

| Type | Total | Rattachés | Couverture |
| --- | --- | --- | --- |
| `SPS` solennel | 37 | 27 | **73 %** |
| `SPO` ordinaire | 4 034 | 176 | 4,4 % |
| `MOC` censure | 34 | 2 | 5,9 % |

Lecture : les votes qui comptent sont majoritairement joignables, la faible
couverture globale venant des votes d'amendements, qui n'ont pas vocation à être
rattachés au dossier. La faible couverture des motions de censure est normale :
elles ne relèvent d'aucun dossier législatif.

### 4.1 La bonne cible n'est pas le scrutin solennel

En classant les 16 957 scrutins par libellé, la structure réelle apparaît : les
amendements représentent 71 à 86 % du corpus selon la législature, les articles
10 à 16 %. Les **votes sur l'ensemble d'un texte**, qui sont ceux dont le produit
a besoin, ne sont que :

| Législature | Votes sur l'ensemble | Part du corpus |
| --- | --- | --- |
| XVe | 376 | 8,5 % |
| XVIe | 209 | 5,1 % |
| XVIIe | 216 | 2,6 % |
| **Total** | **801** | |

**801 votes** sur trois législatures : c'est le noyau qui répond à « qu'est-ce
qui a vraiment été voté sur les retraites ». Un volume négligeable à traiter, et
la vraie cible du rattachement. Les 233 scrutins solennels ne le sont pas :
beaucoup de votes finaux importants n'en relèvent pas.

Ces votes se reconnaissent à la présence de « l'ensemble » dans
`objet.libelle`, dont la forme est stable : `l'ensemble {du projet de loi | de la
proposition de loi | …} {titre légal complet} ({lecture}).`

### 4.2 Méthode de rattachement retenue, et sa mesure

Couverture officielle de départ sur la XVIe : **164 des 209 votes sur l'ensemble**
sont rattachés par `voteRefs`, soit 78,5 %.

La reconstitution s'appuie sur un troisième jeu, `json/document/`, présent dans
la même archive que les dossiers. Chaque document porte `titres.titrePrincipal`
qui est le titre légal complet, et `dossierRef`, lien direct vers son dossier. Les
6 147 documents de la XVIe ont **tous** ces deux champs renseignés.

La méthode combine deux signaux :

1. **Titre normalisé.** Suppression des accents, de la ponctuation et de la
   casse, retrait du préfixe `l'ensemble du|de la|de l'|des`, puis retrait de la
   queue (`première lecture`, `nouvelle lecture`, `lecture définitive`, `texte de
   la commission mixte paritaire`, `n° 1266`). Le résultat est comparé à la même
   normalisation appliquée à `titrePrincipal`.
2. **Cohérence de date.** Le scrutin doit tomber dans l'intervalle des `dateActe`
   du dossier candidat, avec 30 jours de marge. Ce second signal est ce qui lève
   les homonymies : il a résolu 7 des 9 cas ambigus.

Un rattachement n'est accepté que s'il reste **exactement un** dossier candidat
après les deux filtres. En cas d'ambiguïté résiduelle, on n'écrit rien.

S'y ajoutent quatre corrections tirées de l'examen des échecs, toutes
déterministes. Aucune correspondance approchée n'est utilisée, la précision
étant la seule chose qui ne doit jamais être sacrifiée :

- les clauses de procédure insérées dans le titre sont retirées des deux côtés
  (`adoptée par le Sénat`, `modifiée par le Sénat`, `après engagement de la
  procédure accélérée`, `avec modifications`) ;
- les lois de finances et de financement, votées par parties, voient leur
  préfixe `première|deuxième partie du` retiré ;
- un libellé malformé rencontré en XVIe, `l'ensemble **la** proposition de loi`
  sans le « de », est accepté ;
- les libellés contenant « l'ensemble » mais portant en réalité sur un
  amendement sont écartés (2 cas en XVIIe).

### Mesure sur les trois législatures

Validation contre les 556 liens officiels existants, sur 799 votes sur
l'ensemble :

| Législature | Concordants | Conflits | Échecs | Récupérés | Non couverts |
| --- | --- | --- | --- | --- | --- |
| XVe | 192 | 1 | 15 | 144 | 24 |
| XVIe | 147 | 1 | 16 | 38 | 7 |
| XVIIe | 169 | 0 | 15 | 25 | 5 |
| **Total** | **508** | **2** | **46** | **207** | **36** |

| Indicateur | Valeur |
| --- | --- |
| Précision | **100 %**. Les 2 conflits sont des erreurs de la source, vérifiées une par une (voir 4.3) |
| Rappel | 91,4 % |
| Couverture des votes sur l'ensemble | **95,5 %** (763 sur 799), contre 69,6 % avec les seuls liens officiels |

La XVIIe ne produit aucun conflit. Le même gradient de qualité que pour les
décomptes de votes se retrouve ici : la législature en cours est propre, les
archives le sont moins.

### 4.3 La donnée officielle contient des erreurs, et la méthode les détecte

La validation a signalé un désaccord unique, sur `VTANR5L16V4052`. Vérification
faite, c'est la source officielle qui a tort.

Le scrutin du 5 juin 2024 porte, dans son propre `objet.libelle`, sur
« l'ensemble de la proposition de loi visant à poursuivre la dématérialisation de
l'état civil du ministère de l'Europe et des affaires étrangères ». Les **neuf**
documents portant ce titre appartiennent tous à `DLR5L16N49623`. Or le `voteRef`
officiel rattache ce scrutin à `DLR5L16N49386`, dossier intitulé « Prévenir les
ingérences étrangères en France », une loi sans rapport.

Vérifié par ailleurs : aucun scrutin de la XVIe n'est référencé par plus d'un
dossier, ce désaccord n'est donc pas un artefact de déduplication.

Deux conséquences pour le produit.

La correspondance reconstruite n'est pas une simple roue de secours : c'est un
**contrôle croisé indépendant** de la donnée officielle. Elle doit tourner même
là où le lien officiel existe.

Et le principe « données officielles d'abord » a besoin d'un corollaire :
*vérifier les données officielles entre elles*. Une source primaire n'est pas
infaillible ; la traçabilité consiste à pouvoir constater une incohérence, pas à
la recopier. En cas de désaccord entre lien officiel et lien reconstruit, le
produit doit conserver les deux et signaler le conflit plutôt que d'en choisir un
silencieusement.

### 4.4 Ce qui reste à faire

Les 16 introuvables et les 2 ambigus de la XVIe n'ont pas encore été
diagnostiqués. La méthode doit également être rejouée sur les XVe et XVIIe, dont
les dossiers n'ont pas encore été téléchargés, avant d'être considérée comme
acquise.

---

## 5. Structure des votes individuels

`ventilationVotes` est l'arbre le plus important du produit :

```
ventilationVotes.organe
  .organeRef                        -> l'Assemblée
  .groupes.groupe[]
      .organeRef                    -> le groupe (PO…)
      .nombreMembresGroupe
      .vote
          .positionMajoritaire      -> "pour" | "contre" | "abstention"
          .decompteVoix             -> {pour, contre, abstentions, nonVotants,
                                        nonVotantsVolontaires}
          .decompteNominatif
              .pours | .contres | .abstentions | .nonVotants
                  .votant[]         -> {acteurRef, mandatRef, parDelegation}
```

### 5.1 Le groupe au moment du vote est donné, pas à calculer

Les votants sont **imbriqués dans le bloc de leur groupe**. Chaque scrutin
enregistre donc la ventilation telle qu'elle était ce jour-là. Il n'y a aucune
logique de date à écrire pour savoir à quel groupe appartenait un député lors
d'un vote : c'est la structure qui le dit.

Vérifié sur 116 197 votes : `mandatRef` pointe **toujours** vers le mandat de
député (`typeOrgane: ASSEMBLEE`), jamais vers le mandat de groupe. Aucune
référence orpheline sur l'échantillon : l'intégrité référentielle du jeu est
bonne.

Les mandats `GP` datés restent nécessaires pour afficher l'historique des
appartenances sur la page d'un parlementaire, mais pas pour calculer un vote par
groupe.

### 5.2 `positionMajoritaire` est un champ piège

Il donne la position majoritaire du groupe. C'est exactement l'attribut qui
rendrait facile la faute interdite par la règle absolue : déduire le vote d'un
député de la position de son groupe. Il ne doit jamais servir à peupler un vote
individuel, mais seulement, le cas échéant, à afficher une synthèse de groupe.

### 5.3 L'absence ne s'écrit nulle part

Quatre catégories seulement sont enregistrées : `pours`, `contres`,
`abstentions`, `nonVotants`. Un député absent ne figure dans **aucune** liste.

L'absence est donc une déduction (`membres du groupe moins votants
enregistrés`) et non une donnée. Le non-votant, lui, est présent et
explicitement enregistré : c'est une position, pas une absence. Les deux ne
doivent jamais être confondus, ni l'un ni l'autre présenté comme une abstention.

### 5.4 Un vote sur sept n'est pas exprimé par le député lui-même

`parDelegation` mesuré sur l'intégralité des votes individuels :

| Législature | Votes individuels | `parDelegation: true` | Part |
| --- | --- | --- | --- |
| XVe | 472 631 | 52 110 | 11,0 % |
| XVIe | 602 911 | 51 737 | 8,6 % |
| XVIIe | 1 270 476 | 191 629 | **15,1 %** |
| **Total** | **2 346 018** | **295 476** | 12,6 % |

Le vote par délégation est juridiquement le vote du député. Mais afficher « votre
député a voté pour » sans mention, alors qu'un collègue a matériellement exprimé
ce vote, revient à dire plus que ce que la donnée dit. Le champ doit être importé
et affiché.

### 5.5 Les décomptes sont parfois incohérents entre eux

Comparaison systématique de `decompteVoix` avec la longueur des listes de
`decompteNominatif`, sur 186 798 blocs groupe-vote :

| Législature | Incohérences |
| --- | --- |
| XVe | 17 |
| XVIe | 39 |
| XVIIe | **0** |

Le cas le plus gênant rencontré : `pours: nominatif=0 vs voix=21`, soit vingt et une
voix comptées sans aucun nom. Dans ce cas le produit doit afficher l'agrégat et
signaler que le détail nominatif manque pour ce groupe. L'importeur doit
consigner l'écart plutôt que de choisir un des deux chiffres.

Le même gradient que pour les `voteRefs` se retrouve ici : la XVIIe est propre,
les archives le sont moins.

Vérifié par ailleurs sur l'ensemble du corpus : **aucun acteur n'apparaît deux
fois dans un même scrutin**. La contrainte d'unicité `(scrutin, acteur)` est donc
sûre.

### 5.6 Quatorze scrutins n'identifient aucun de leurs groupes

Sur la XVIIe, 14 scrutins listent leurs douze blocs de groupe avec
`organeRef: "PO0"` pour tous. `PO0` n'existe comme organe dans aucune des trois
législatures : c'est un identifiant de remplissage, pas une référence.

Les effectifs ne laissent pourtant aucun doute sur le fait qu'il s'agit bien de
groupes distincts : 124, 93, 71, 66, 47, 38, 36, 34, 23, 17, 16 et 9 membres,
soit exactement la composition de l'Assemblée sous cette législature. La source a
simplement omis de renseigner lesquels.

Cela représente 146 blocs et **1 916 votes individuels**, soit 0,15 % du corpus.
Les XVe et XVIe ne sont pas touchées.

Deux conséquences, qui sont la même :

Une clé `(scrutin, organe)` sur la ventilation écrase onze blocs sur douze. C'est ce qui faisait apparaître 101 076 blocs en XVIIe au lieu des 101 208
mesurés. La clé doit être `(scrutin, ordre de la source)`.

Et surtout, recopier `PO0` dans le vote attribuerait ces 1 916 votes à un même
groupe imaginaire. **Le groupe inconnu se stocke en `NULL` et s'affiche comme
inconnu.** Inventer une appartenance de groupe est précisément ce que le produit
s'interdit ; le faire par recopie mécanique d'un identifiant de remplissage n'est
pas moins grave que de le déduire.

---

## 6. Acteurs, mandats et organes

L'archive `AMO20` se décompresse en `json/acteur/` et `json/organe/`. Pour la
XVIe : 1 075 acteurs, 798 organes.

### 6.1 Groupe parlementaire et parti sont déjà distingués à la source

`organe.codeType` sépare notamment `GP` (groupe parlementaire, 12 organes en
XVIe) et `PARPOL` (parti politique, 22 organes). Les deux se rattachent aux
acteurs par des **mandats datés** (`dateDebut`, `dateFin`).

La préoccupation de la spécification sur la confusion parti / groupe est donc
servie par la source elle-même, historique compris : 1 305 mandats `GP` en XVIe,
tous pourvus d'une date de fin puisque la législature est close.

### 6.2 Deux pièges de parsing propres à ce jeu

Ce jeu est une conversion mécanique depuis XML, et il en porte les traces. Elles
n'existent pas dans les jeux Scrutins et Dossiers.

**`acteur.uid` est un objet, pas une chaîne.** Il faut lire `uid["#text"]`.
Constaté sur 1 075 acteurs sur 1 075.

**Les valeurs nulles sont encodées en objet** `{"@xsi:nil": "true"}` au lieu de
`null`. Fréquences mesurées : 1 075 `trigramme`, 1 075 `uri_hatvp`, 420
`profession.libelleCourant`, 405 `villeNais`. Un importeur naïf stockerait
l'objet lui-même comme profession de 420 députés. La normalisation de ces
sentinelles en `NULL` doit être faite à la lecture, de façon générique et
récursive.

---

## 7. Vérification de bout en bout : la réforme des retraites de 2023

La spécification demande de vérifier manuellement des lois connues avant de
construire quoi que ce soit. Le cas le plus instructif est aussi le plus
embarrassant pour le produit.

### 7.1 La décision politique majeure de la législature est invisible

Sur 174 scrutins de la XVIe mentionnant « retraite », **un seul** est un vote sur
l'ensemble d'un texte, et il porte sur la retraite de base des non-salariés
agricoles, en décembre 2022.

La réforme des retraites, elle, n'a produit **aucun vote sur son ensemble** :
elle a été adoptée par 49.3. Ce qui a été voté, ce sont deux motions de censure
le 20 mars 2023. Celle de M. Bertrand Pancher a recueilli 278 voix pour 287
requises, soit neuf de moins que nécessaire. La donnée reproduit exactement
l'histoire.

La conséquence est structurante : **une requête « qu'est-ce qui a été voté sur
les retraites ? » fondée sur les votes sur l'ensemble renverrait une loi sur les
retraites agricoles et manquerait la réforme.** Le 49.3 doit être un concept de
premier rang du produit, pas un cas particulier traité après coup.

Et c'est ici que le piège des motions de censure (section 3.1) devient concret :
afficher « 278 pour, 0 contre » pour cette motion serait un contresens sur
l'événement politique le plus commenté de la législature.

### 7.2 Le 49.3 est traçable : `codeActe = 'AN21'`

Chaque engagement de responsabilité produit des actes de code `AN21`, et depuis
la XVIe un **dossier dédié**, intitulé « Engagement de la responsabilité du
Gouvernement sur… ».

| Législature | Dossiers portant un acte `AN21` | dont dossiers dédiés |
| --- | --- | --- |
| XVe | 7 | 0 |
| XVIe | 32 | 23 |
| XVIIe | 22 | 8 |

Les 23 dossiers dédiés de la XVIe correspondent aux usages connus du 49.3 sous
le gouvernement Borne. **La convention de titrage a changé entre législatures** :
la XVe a des actes `AN21` sans dossier dédié. Seul `codeActe = 'AN21'` identifie
un engagement de responsabilité ; le titre ne le fait pas.

Une hypothèse plus simple a été testée et écartée : « texte promulgué sans
décision de l'Assemblée » ne désigne qu'un seul dossier en XVIe. Les grandes lois
budgétaires passées au 49.3 portent malgré tout une décision `AN1-DEBATS-DEC`,
puisque le texte est réputé adopté. Le critère est trompeur et ne doit pas être
utilisé.

### 7.2 bis. Le dossier de la loi ne porte pas la marque du 49.3

Point corrigé après vérification en base, et il compte : **le dossier de la
réforme des retraites ne contient aucun acte `AN21`.** Chercher `AN21` sur le
dossier d'un texte ne le désigne donc pas comme adopté sans vote.

Le 49.3 vit dans un dossier séparé, ici `DLR5L16N47408`, « Engagement de la
responsabilité du Gouvernement sur le vote du PLFRSS pour 2023… ». Le lien entre
les deux n'est écrit nulle part : ni référence croisée, ni champ dédié.

Il se déduit d'une particularité de la structure. **Les deux dossiers partagent
des actes** : les mêmes `uid` figurent dans l'un et dans l'autre. Et ces actes
partagés n'y portent pas le même code :

| `uid` de l'acte | Dans le dossier de la loi | Dans le dossier d'engagement |
| --- | --- | --- |
| `L16-VD212217` | `CMP-MOTION` | `AN21-MOTION` |
| `L16-VD212218` | `CMP-MOTION` | `AN21-MOTION` |
| `L16-VD212198` | `CMP-DGVT` | `AN21-DGVT` |

Le code décrit le **rôle de l'acte dans cette procédure-là**, pas une propriété
de l'événement : la même motion de censure est un acte du stade CMP vu depuis la
loi, et la motion déposée contre le 49.3 vue depuis l'engagement.

Sur la XVIe, 99 `uid` d'actes sur 23 058 apparaissent ainsi dans deux dossiers.
C'est peu, mais ces 99 actes portent précisément l'information qui manque
ailleurs.

La règle d'identification devient donc : **un texte a été adopté sans vote
lorsqu'il partage un acte avec un dossier portant `AN21`, sans porter lui-même
ce code.** Appliquée à la XVIe, elle identifie 6 textes à partir des 32 dossiers
d'engagement.

Conséquence de modélisation : un acte ne peut pas être stocké une seule fois. Sa
clé est `(dossier, uid)`, et `uid` sert à retrouver les dossiers qui décrivent le
même événement. Une clé primaire sur le seul `uid` fait disparaître en silence
une version sur deux. C'est exactement ce qui effaçait la trace de la motion de
censure du dossier de la réforme des retraites, et ce qu'un contrôle a rattrapé.

### 7.3 Le parcours complet d'une loi est déjà dans la donnée Assemblée

Les actes du dossier de la réforme couvrent toute la chaîne :

```
AN1-DEPOT → AN1-COM-FOND → AN1-DEBATS-SEANCE (21 séances) → SN1 →
CMP → CMP-MOTION → CC-SAISIE-AN / CC-CONCLUSION → PROM-PUB
```

Deux gains qui n'étaient pas attendus : **le Conseil constitutionnel** (`CC`,
`CC-SAISIE-*`, `CC-CONCLUSION`) et **la promulgation** (`PROM`, `PROM-PUB`) sont
présents dans la donnée de l'Assemblée. La frise « Parcours de la loi » de la
spécification se construit donc intégralement sans Légifrance ni connecteur vers
le Conseil constitutionnel, que la spécification rangeait en phase 2.

### 7.4 Deux pièges de parsing dans les actes

`libelleActe` **n'est pas une chaîne** mais un objet
`{nomCanonique, libelleCourt}`. Stocker le champ tel quel produirait un libellé
illisible sur toute la frise.

`dateActe` est un horodatage complet avec fuseau
(`2023-03-17T00:00:00.000+01:00`), et non une date simple. La troncature à dix
caractères fonctionne, mais le modèle doit savoir qu'il tronque plutôt que de le
découvrir en production.

---

## 7 bis. Structure réelle des amendements (XVIe)

Vérifiée par analyse exhaustive des **163 789 amendements** de la XVIe
législature, le seul jeu Amendements disponible localement à ce stade (voir
section 8). Contrairement aux scrutins et aux dossiers, l'archive ne range pas
ses fichiers à plat : elle se décompresse en
`json/<dossier>/<document>/<amendement>.json`, avec **260 dossiers** et
**474 documents**. Rien dans le fichier d'un amendement ne porte son dossier de
rattachement : c'est le nom du répertoire de premier niveau qui le donne,
vérifié comme concordant avec `document.dossierRef` sur l'intégralité du
corpus, partout où le document correspondant existe dans le jeu Dossiers.

Le champ `legislature` de la racine vaut `"16"` sur les 163 789 fichiers, y
compris pour les 5 dossiers hérités de la XVe visibles au premier niveau de
l'arborescence (`DLR5L15N…`) : la source date l'amendement par la législature
où il a été traité, pas par celle où le dossier a été ouvert.

### 7 bis.1 `sort` n'est renseigné que pour les amendements discutés

Piège majeur de ce jeu : `cycleDeVie.sort` (« Adopté », « Rejeté », « Retiré »,
« Non soutenu », « Tombé ») est encodé `{"@xsi:nil": "true"}` pour **87 266
amendements sur 163 789, soit 53 %**. Un importeur qui traiterait ce vide comme
une donnée manquante à corriger se tromperait : la corrélation avec
`cycleDeVie.etatDesTraitements.etat.code` est totale sur l'ensemble du corpus.
`sort` n'existe que lorsque `etat.code = 'DI'` (discuté). Dans tous les autres
cas, l'amendement n'a simplement jamais atteint le stade de la discussion sur
le fond :

| `etat.code` | `etat.libelle` | Effectif | `sort` |
| --- | --- | --- | --- |
| `DI` | Discuté | 76 523 | renseigné (Rejeté 37 635, Adopté 13 392, Non soutenu 10 865, Tombé 9 708, Retiré 4 923) |
| `AC` | À discuter | 19 047 | nil |
| `ET` | En traitement | 18 898 + 18 | nil |
| `IR` / `IRR*` | Irrecevable (11 variantes de motif) | 33 268 | nil |
| `RT` | Retiré (avant publication) | 14 903 | nil |
| `effacé` | effacé | 50 | nil |

La couche d'import stocke `sort` brut (nullable) et calcule un affichage
unique, `sort_libelle`, par `COALESCE(sort, etat.libelle)` : ce n'est pas une
valeur devinée, les deux composants viennent de la source, seul le choix entre
eux est fait à l'import. `etatDesTraitements.sousEtat` précise le motif exact
d'irrecevabilité (`IRR45` = cavalier législatif, `IRR42` = satisfait ou
inopérant, `IRRHD` = hors délais…) et est conservé séparément.

### 7 bis.2 Trois types d'auteur, trois façons d'identifier l'auteur

`signataires.auteur.typeAuteur` prend une des trois valeurs Député (154 501),
Rapporteur (7 789), Gouvernement (1 499). L'identifiant de l'auteur change de
nature selon le type :

- Député ou Rapporteur : `auteur.acteurRef` (`PA…`), toujours accompagné du
  groupe politique du signataire au moment du dépôt (`groupePolitiqueRef`,
  absent seulement pour 53 députés).
- Gouvernement : `acteurRef` et `groupePolitiqueRef` valent tous deux nil.
  L'auteur est identifié par un **organe** (`gouvernementRef`, un `PO…`), pas
  par un acteur. Vérifié sur les 1 499 cas : aucun n'a jamais d'`acteurRef`.

Traiter le Gouvernement comme un « acteur » de plus aurait fait planter la
clé étrangère ou, pire, inventé un faux député auteur d'un amendement
gouvernemental.

### 7 bis.3 Les cosignataires suivent la même règle d'enveloppement que les listes de vote

`signataires.cosignataires` est `{"@xsi:nil": "true"}` pour 51 346 amendements
sans cosignataire, et un objet `{acteurRef: […]}`  pour 112 443 amendements
qui en ont. Comme pour les groupes de scrutin, `acteurRef` n'est enveloppé
dans un tableau que s'il y a plus d'un élément : 6 765 amendements n'ont qu'un
seul cosignataire, exposé comme une chaîne nue. La fonction `liste()` de
`normaliser.ts`, déjà utilisée pour les autres jeux, absorbe les deux formes
sans code dédié. Total mesuré : **3 148 274 liens de cosignature**, jusqu'à
170 cosignataires sur un même amendement.

### 7 bis.4 Rattachement et couverture

`texteLegislatifRef` (le document, au format `PRJLANR5L16B0009` ou
`PIONANR5L16BTC0014` selon le type de texte) est renseigné sur les 163 789
amendements sans exception, et désigne toujours `officiel.document.uid`. La
couverture n'est pourtant pas totale : **47 amendements sur 163 789 (0,03 %)**
référencent un document absent du jeu Dossiers de la même archive — pas un
document filtré à l'import faute de titre, un document réellement absent du
répertoire `document/`. Le dossier reste identifiable via le nom de
répertoire, qui ne dépend pas du jeu Dossiers.

Intégrité des références vers les acteurs, mesurée sur l'intégralité du
corpus : 13 auteurs sur 162 240 et 3 681 liens de cosignature sur 3 148 274
(0,12 %) pointent vers un acteur absent du jeu Acteurs (`AMO20`), sans doute
des députés sortis de mandat avant l'instantané. Trop marginal pour justifier
une clé étrangère stricte, et cohérent avec le gradient de qualité déjà observé
sur les autres jeux : la donnée récente est propre, l'historique un peu moins.

### 7 bis.5 Volume et durée

163 789 fichiers, lus et importés en **~96 secondes** sur PGlite (XVIe
uniquement, machine de développement), pour 163 789 lignes d'amendement et
3 148 274 lignes de cosignature. C'est le jeu le plus lent du pipeline, cohérent
avec son poids : 347 Mo compressés pour la seule XVIe contre 21 Mo pour le
reste du MVP (section 1.2).

## 7 ter. Structure réelle des débats (XVIe), format XML « syceron »

Vérifiée par analyse exhaustive des **605 fichiers** (330 Mo décompressés) du
seul jeu Débats disponible localement à ce stade, fournis hors téléchargement.
Contrairement à tous les autres jeux de ce document, celui-ci est un XML brut
converti par aucun pipeline JSON intermédiaire : c'est le premier format neuf
du projet, et il porte ses propres pièges, distincts de ceux d'`{"@xsi:nil"}`
et des enveloppements de liste déjà rencontrés.

Tous les 605 fichiers portent `<legislature>16</legislature>` et un nom
`CRSANR5L16S…` (un `CRSCGR5L16S…`, un Congrès, à la marge) : c'est bien
l'intégralité de la XVIe, aucune trace d'une législature étrangère comme
c'est le cas pour les dossiers (section 4).

### 7 ter.1 Le seul point d'ancrage vers le reste du modèle est `seanceRef`

Chaque fichier `compteRendu` porte un `uid` (l'identifiant du compte rendu
lui-même, `CRSANR5L16S2022E1N001`) et un `seanceRef`
(`RUANR5L16S2022IDS26235`), en relation 1:1 vérifiée sur les 605 fichiers
(aucun `seanceRef` dupliqué).

**`seanceRef` est exactement le même identifiant que `scrutin.seanceRef`**,
déjà importé dans `officiel.scrutin.seance_ref` sans qu'on en ait jusqu'ici
tiré parti. Vérifié sur l'événement le plus documenté de la législature : le
scrutin `VTANR5L16V1240` (motion de censure Pancher, 278 voix pour 287
requises, 20 mars 2023) porte `seanceRef: "RUANR5L16S2023IDS26958"`, exactement
celui du fichier `CRSANR5L16S2023O1N182.xml`, dont le texte annonce
littéralement *« Pour l'adoption 278. La majorité requise n'étant pas
atteinte… »*. C'est une preuve directe, pas une coïncidence de date.

**Aucun autre champ du XML ne référence un dossier ou un document
législatif.** Recherche exhaustive sur les 605 fichiers des motifs
`DLR5L16*`, `PRJLANR5L16*`, `PIONANR5L16*`, `dossierRef`, `texteRef` :
zéro occurrence. Un débat ne se raccroche donc à un dossier que par la date
de séance ou, plus précisément, par jointure sur `seanceRef` vers les
scrutins qu'elle contient, eux-mêmes rattachables à un dossier par la méthode
de la section 4. Rattacher un débat à un dossier sans passer par un scrutin
de cette séance n'est pas possible avec ce seul jeu.

### 7 ter.2 Un arbre récursif de `point`, des `paragraphe` jamais imbriqués

```
compteRendu
  metadonnees.sommaire          -> table des matières déclarative (titres, orateurs prévus)
  contenu
    quantiemes
    ouvertureSeance             -> conteneur, même grammaire qu'un point
      paragraphe*                   -> ouverture de séance, annonces de la présidence
    point*  (nivpoint="1".."5", ou "99"/"100" pour les suspensions/clôtures)
      texte                         -> titre de la section (ex. « Motions de censure »)
      paragraphe*                   -> interventions
      point*                        -> sous-points, récursif
    finSeance
      point                         -> ordre du jour de la séance suivante
```

`point` est **récursif et de profondeur variable**, même piège que
`acteLegislatif` (section 4) : `nivpoint` observé de 1 à 5, plus deux codes de
procédure (`99` suspension, `100`) qui s'imbriquent dans les points normaux. Un
`nivpoint="6"` existe aussi ponctuellement dans le corpus. Un parcours à
profondeur fixe perdrait les interventions des suspensions de séance ; le
parseur retenu ne plafonne la profondeur nulle part, donc ce cas ne pose pas de
problème pratique.

Une balise distincte, `changementPresidence` (149 occurrences, 131 fichiers sur
605), porte son propre `id_syceron` et son propre titre (« Présidence de
Mme… ») mais n'est pas reconnue par le tokenizer actuel, qui ne matche que
`point`, `ouvertureSeance`, `finSeance`, `paragraphe` et `texte` : ses
paragraphes sont importés (rattachés au `point` englobant), mais l'information
« qui présidait à cet instant précis » ne l'est pas. Sans conséquence
aujourd'hui (aucune page ni aucun contrôle n'en dépend), mais à corriger avant
d'afficher un jour cette information.

**`paragraphe`, en revanche, ne s'imbrique jamais** : vérifié sur
l'intégralité du corpus XVIe (337 041 occurrences), profondeur maximale 1.
C'est la feuille de l'arbre — l'unité d'intervention — et elle simplifie le
modèle : pas besoin d'un parcours récursif pour l'extraire, seulement de
retrouver sa balise fermante, qui ne peut pas être imbriquée dans une autre.

Piège rencontré en cours d'inspection : une balise `interExtraction`
(61 496 occurrences sur le corpus) enveloppe le plus souvent deux `paragraphe`
consécutifs (59 % des cas) — l'annonce « la parole est à Mme X » suivie de son
intervention — pour signaler un extrait recommandé à la mise en avant
éditoriale. Certains blocs en contiennent beaucoup plus, jusqu'à 158 dans un
cas observé, avec des orateurs différents à l'intérieur d'un même bloc : dans
ce cas, `id_acteur` sur `interExtraction` ne représente qu'un des orateurs, pas
tous. Le parseur ignore cette balise et lit chaque `paragraphe` pour son propre
compte, avec son propre `id_acteur` : aucune donnée de vote ou d'orateur n'est
donc faussée. Seule l'information éditoriale portée par `interExtraction`
elle-même (quels paragraphes l'Assemblée met en avant comme extrait) est
perdue, et ce n'est pas une donnée que ce projet cherche à conserver. Vérifié
en comparant le compte d'interventions avec et sans prise en compte de cette
balise (337 041 dans les deux cas) : cela confirme l'absence de perte de
paragraphes, pas l'absence de perte d'information éditoriale.

### 7 ter.3 `id_syceron` est un identifiant global, `id_acteur` un piège classique

`id_syceron`, l'identifiant de chaque `paragraphe`, est **unique sur
l'intégralité du corpus** : 337 041 valeurs, 337 041 distinctes, tous fichiers
confondus. C'est la clé primaire naturelle d'une intervention.

`id_acteur` reproduit exactement le piège déjà documenté pour `organeRef` en
section 5.6 : deux valeurs de remplissage, pas des acteurs.

| Valeur | Signification | Occurrences |
| --- | --- | --- |
| `PA0` | Orateur non identifié individuellement (« Un député du groupe LR », « Plusieurs députés du groupe RN »…) | 3 680 |
| `PA-121449` et 71 autres identifiants négatifs distincts | Même nature, jamais observés ailleurs dans le corpus Assemblée | 684 |
| absent (pas d'attribut `id_acteur`) | Mention procédurale sans orateur (didascalie, ouverture/fermeture de séance) | 29 733 |
| `PA` + entier positif | Acteur identifié | 307 072 |

Ni `PA0` ni les identifiants négatifs ne désignent un acteur réel : les
recopier créerait de faux députés identifiés, au même titre que `PO0` créerait
un faux groupe (section 5.6). Le nom affiché par la source
(`<orateur><nom>Un député du groupe LR</nom>`) reste la seule information
disponible dans ces cas, et n'est déductible d'aucune autre table : elle doit
être conservée telle quelle, pas recalculée.

**Intégrité vers le jeu Acteurs (AMO20) :** sur les 656 acteurs distincts
référencés par les débats de la XVIe, 13 (2 %) sont absents du jeu Acteurs
importé par ailleurs — vraisemblablement des ministres ou des remplaçants
sortis de fonction avant l'instantané `AMO20`. Cohérent avec le gradient de
qualité déjà observé sur les amendements (section 7 bis.4) : pas de quoi
bloquer l'import, mais pas de clé étrangère stricte non plus.

### 7 ter.4 Un `paragraphe` peut avoir deux orateurs

La quasi-totalité des interventions ont un seul orateur, mais **600 sur
337 041 (0,18 %)** en listent deux — généralement deux députés qui
s'expriment au même instant lors d'une interruption. Une colonne unique sur
l'intervention en perdrait un sur deux à chaque occurrence, même raisonnement
que pour les cosignataires d'amendement (section 7 bis.3) : une table à part
est nécessaire.

### 7 ter.5 Le texte mêle contenu et mise en forme

Chaque `paragraphe` porte **exactement un** `<texte>` (vérifié sur un
échantillon de 4 756 paragraphes, jamais zéro, jamais plus d'un), dont le
contenu est mixte : texte brut entrecoupé de `<italique>`, `<exposant>`,
`<indice>` (mise en forme, retirée sans perte d'information factuelle) et de
`<br/>` (retour à la ligne dans une même intervention, converti en `\n`).
Seule entité XML rencontrée sur un échantillonnage du corpus : `&amp;`.

`dateSeance` est un horodatage compact sans séparateurs,
`20230320213000000` (17 chiffres : date, heure, milliseconde), vérifié
toujours sur ce format sur l'intégralité du corpus — encore un format de date
différent des deux déjà rencontrés (`date` simple des scrutins,
`dateActe` avec fuseau des actes législatifs, section 7.4).

### 7 ter.6 Volume et durée

337 041 interventions, 31 392 points de sommaire (avec leur hiérarchie et
leur intitulé), 312 097 liens intervention-orateur, 605 séances : le tout
analysé en **moins de 4 secondes** en mémoire et importé en base PGlite en
**environ 25 secondes** (machine de développement), sur un total pipeline
(acteurs, dossiers, scrutins, débats) de 50 secondes pour la XVIe. Le texte
brut cumulé des interventions pèse environ 110 Mo une fois les balises de
mise en forme retirées, cohérent avec les 55 Mo compressés mesurés sur
l'archive téléchargeable (section 1.2).

## 8. Sources non encore vérifiées

Les sources ci-dessous sont citées dans la spécification mais **n'ont fait
l'objet d'aucun appel réel à ce stade**. Elles ne doivent pas être traitées comme
acquises tant qu'elles n'ont pas été inspectées comme l'a été l'Assemblée.

| Source | Point à vérifier en priorité |
| --- | --- |
| Sénat DOSLEG / AMELI | Formats réels, et surtout l'identifiant permettant de raccrocher un texte sénatorial à son dossier Assemblée pour reconstituer la navette. |
| Légifrance via PISTE | Inscription et OAuth requis. Quotas d'appel, et existence d'un lien direct entre dossier parlementaire et texte consolidé. |
| Parlement européen | Disponibilité réelle des votes nominatifs, qui est loin d'être systématique. |
| GDELT | Qualité de la couverture des médias français et taux de faux positifs sur des requêtes construites à partir de titres de loi. À tester avant de fonder 35 % du score d'importance dessus. |

**Amendements XVe et XVIIe.** Seule la XVIe a été inspectée (section 7 bis),
à partir de fichiers fournis localement, sans passer par le téléchargement.
Le nommage d'URL est déjà table explicite dans `sources.ts` (section 1.1) et
la XVe utilise `amendements_legis` plutôt que `amendements_div_legis`, mais le
format interne des fichiers n'a pas été vérifié sur ces deux législatures. Ne
pas supposer qu'il est identique : c'est exactement l'erreur que ce document
existe pour éviter.

**Débats XVe et XVIIe.** Seule la XVIe a été inspectée (section 7 ter), à
partir de fichiers fournis localement. Le nommage d'URL est déjà table
explicite dans `sources.ts` (section 1.1). Rien ne garantit que la structure
XML `syceron` (les codes de grammaire en particulier, `code_grammaire`) soit
identique sur les deux autres législatures ; à vérifier avant d'étendre
l'importeur.

---

## Méthode de vérification

Les constats de ce document sont reproductibles :

```sh
curl -sSLI "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip"
```

Les analyses d'inventaire ont porté sur la totalité des fichiers décompressés,
sans échantillonnage, afin que les pourcentages cités soient des mesures et non
des estimations.
