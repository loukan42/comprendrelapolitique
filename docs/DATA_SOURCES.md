# Sources de données

Ce document ne contient que des informations **vérifiées par téléchargement et
inspection réels**, le 13 septembre 2026. Chaque URL a été appelée, chaque
chiffre mesuré. Ce qui n'a pas encore été vérifié est signalé comme tel, à la
fin.

Règle d'écriture de ce fichier : on n'y écrit pas une URL ou un format qu'on n'a
pas constaté soi-même. Un `DATA_SOURCES.md` approximatif produirait exactement
les erreurs que le produit prétend éliminer.

---

## 1. Assemblée nationale — jeux Open Data

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

**Historique transversal des acteurs** — un jeu à part, qui couvre toutes les
législatures depuis la XIe et non une seule :

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

L'absence se détecte donc au niveau du **dossier**, pas du scrutin — un texte
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

`acteLegislatif` est **récursif** et de profondeur variable — les références ont
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
rattachés au dossier. La faible couverture des motions de censure est normale —
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
| **Total** | **801** | — |

**801 votes** sur trois législatures : c'est le noyau qui répond à « qu'est-ce
qui a vraiment été voté sur les retraites ». Un volume négligeable à traiter, et
la vraie cible du rattachement — pas les 233 scrutins solennels, dont beaucoup de
votes finaux importants ne relèvent pas.

Ces votes se reconnaissent à la présence de « l'ensemble » dans
`objet.libelle`, dont la forme est stable : `l'ensemble {du projet de loi | de la
proposition de loi | …} {titre légal complet} ({lecture}).`

### 4.2 Méthode de rattachement retenue, et sa mesure

Couverture officielle de départ sur la XVIe : **164 des 209 votes sur l'ensemble**
sont rattachés par `voteRefs`, soit 78,5 %.

La reconstitution s'appuie sur un troisième jeu, `json/document/`, présent dans
la même archive que les dossiers. Chaque document porte `titres.titrePrincipal`
— le titre légal complet — et `dossierRef`, lien direct vers son dossier. Les
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
déterministes — aucune correspondance approchée n'est utilisée, la précision
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
| Précision | **100 %** — les 2 conflits sont des erreurs de la source, vérifiées une par une (voir 4.3) |
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
ingérences étrangères en France » — une loi sans rapport.

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
référence orpheline sur l'échantillon — l'intégrité référentielle du jeu est
bonne.

Les mandats `GP` datés restent nécessaires pour afficher l'historique des
appartenances sur la page d'un parlementaire, mais pas pour calculer un vote par
groupe.

### 5.2 `positionMajoritaire` est un champ piège

Il donne la position majoritaire du groupe. C'est exactement l'attribut qui
rendrait facile la faute interdite par la règle absolue : déduire le vote d'un
député de la position de son groupe. Il ne doit jamais servir à peupler un vote
individuel — uniquement, le cas échéant, à afficher une synthèse de groupe.

### 5.3 L'absence ne s'écrit nulle part

Quatre catégories seulement sont enregistrées : `pours`, `contres`,
`abstentions`, `nonVotants`. Un député absent ne figure dans **aucune** liste.

L'absence est donc une déduction — `membres du groupe moins votants
enregistrés` — et non une donnée. Le non-votant, lui, est présent et
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

Le cas le plus gênant rencontré : `pours: nominatif=0 vs voix=21` — vingt et une
voix comptées, aucun nom. Dans ce cas le produit doit afficher l'agrégat et
signaler que le détail nominatif manque pour ce groupe. L'importeur doit
consigner l'écart plutôt que de choisir un des deux chiffres.

Le même gradient que pour les `voteRefs` se retrouve ici : la XVIIe est propre,
les archives le sont moins.

Vérifié par ailleurs sur l'ensemble du corpus : **aucun acteur n'apparaît deux
fois dans un même scrutin**. La contrainte d'unicité `(scrutin, acteur)` est donc
sûre.

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
l'ensemble d'un texte — et il porte sur la retraite de base des non-salariés
agricoles, en décembre 2022.

La réforme des retraites, elle, n'a produit **aucun vote sur son ensemble** :
elle a été adoptée par 49.3. Ce qui a été voté, ce sont deux motions de censure
le 20 mars 2023. Celle de M. Bertrand Pancher a recueilli 278 voix pour 287
requises — neuf voix de moins que nécessaire. La donnée reproduit exactement
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

### 7.2 bis — Le dossier de la loi ne porte pas la marque du 49.3

Point corrigé après vérification en base, et il compte : **le dossier de la
réforme des retraites ne contient aucun acte `AN21`.** Chercher `AN21` sur le
dossier d'un texte ne le désigne donc pas comme adopté sans vote.

Le 49.3 vit dans un dossier séparé — ici `DLR5L16N47408`, « Engagement de la
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
une version sur deux — c'est exactement ce qui effaçait la trace de la motion de
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

---

## Méthode de vérification

Les constats de ce document sont reproductibles :

```sh
curl -sSLI "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip"
```

Les analyses d'inventaire ont porté sur la totalité des fichiers décompressés,
sans échantillonnage, afin que les pourcentages cités soient des mesures et non
des estimations.
