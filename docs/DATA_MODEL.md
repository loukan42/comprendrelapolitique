# Modèle de données

Ce modèle découle de l'inspection réelle des jeux Open Data documentée dans
[DATA_SOURCES.md](DATA_SOURCES.md). Chaque choix qui pourrait surprendre y renvoie.

Il couvre le périmètre du MVP : acteurs, organes, mandats, dossiers, documents,
actes législatifs, scrutins et votes individuels — ainsi que les amendements
(section 5 bis) et les débats (section 5 ter) de la XVIe législature, les
seuls jeux Amendements et Débats inspectés à ce stade. Les médias et les quiz
sont esquissés en fin de document mais pas encore détaillés. Les modéliser
maintenant, avant d'avoir inspecté leurs formats, produirait exactement la
spéculation que ce projet cherche à éviter.

---

## 1. Deux schémas, une frontière

```sql
CREATE SCHEMA officiel;        -- importé d'une source publique. Jamais écrit par l'IA.
CREATE SCHEMA enrichissement;  -- produit par l'IA ou par calcul. Jamais source de vérité.
```

La séparation est physique, pas conventionnelle. Un résumé, un thème, un score
ou une réponse de recherche vit dans `enrichissement` et référence `officiel` par
clé étrangère. L'inverse n'existe pas. Le droit d'écriture sur `officiel` est
réservé aux scripts d'import.

Conséquence pratique : on peut vider et reconstruire tout `enrichissement` sans
toucher à un seul fait, et une régression d'IA ne peut pas corrompre une donnée
officielle.

---

## 2. Traçabilité : le lot d'import

Plutôt que de répéter sept colonnes de provenance sur chaque table, chaque ligne
importée pointe vers le lot qui l'a produite.

```sql
CREATE TABLE officiel.import_lot (
    id                  bigserial PRIMARY KEY,
    jeu                 text        NOT NULL,   -- 'scrutins', 'dossiers', 'acteurs'
    institution         text        NOT NULL,   -- 'AN', 'SENAT', 'PE'
    legislature         smallint,
    url_source          text        NOT NULL,
    last_modified_source timestamptz,           -- en-tête HTTP de l'archive
    taille_octets       bigint,
    sha256              text        NOT NULL,
    demarre_le          timestamptz NOT NULL DEFAULT now(),
    termine_le          timestamptz,
    lignes_inserees     integer,
    lignes_modifiees    integer,
    statut              text        NOT NULL DEFAULT 'en_cours'
);
```

`sha256` porte la détection de changement. Combiné au `Last-Modified` servi par
data.assemblee-nationale.fr, il permet de ne rien retélécharger tant que la
source n'a pas bougé, ce qui compte : les archives des XVe et XVIe étant figées
depuis 2022 et 2024.

**On n'écrase pas l'historique.** Un lot n'est jamais supprimé. Les tables
importées portent `lot_id` (le lot qui a créé la ligne) et `lot_maj_id` (le
dernier qui l'a modifiée) : on sait toujours quand un fait est apparu et quand il
a bougé.

---

## 3. Référentiel

```sql
CREATE TABLE officiel.legislature (
    id           smallint PRIMARY KEY,          -- 15, 16, 17
    institution  text     NOT NULL DEFAULT 'AN',
    date_debut   date     NOT NULL,
    date_fin     date,                          -- NULL = en cours
    archivee     boolean  NOT NULL DEFAULT false
);
```

`archivee` n'est pas décoratif : il commande la stratégie de synchronisation.
Une législature archivée s'importe une fois et n'est plus interrogée.

```sql
CREATE TABLE officiel.acteur (
    uid              text PRIMARY KEY,          -- 'PA1001'
    civilite         text,
    prenom           text,
    nom              text NOT NULL,
    date_naissance   date,
    ville_naissance  text,
    departement_naissance text,
    pays_naissance   text,
    date_deces       date,
    profession       text,
    uri_hatvp        text,
    lot_id           bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id       bigint REFERENCES officiel.import_lot(id)
);
```

Toutes ces colonnes sont nullables à dessein. Dans la XVIe, 420 acteurs sur 1 075
n'ont pas de profession renseignée et 405 pas de ville de naissance, et ces
absences arrivent encodées `{"@xsi:nil": "true"}`, pas `null`. La normalisation
de ces sentinelles est à faire à la lecture, récursivement, avant toute écriture
(voir DATA_SOURCES 6.2). Rappel du second piège du même jeu : `acteur.uid` est un
objet dont il faut lire `["#text"]`.

```sql
CREATE TABLE officiel.organe (
    uid             text PRIMARY KEY,           -- 'PO800538'
    code_type       text NOT NULL,              -- 'GP', 'PARPOL', 'COMPER', 'ASSEMBLEE'…
    libelle         text NOT NULL,
    libelle_abrege  text,
    libelle_abrev   text,
    organe_parent   text REFERENCES officiel.organe(uid),
    legislature     smallint REFERENCES officiel.legislature(id),
    date_debut      date,
    date_fin        date,
    lot_id          bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id      bigint REFERENCES officiel.import_lot(id)
);
CREATE INDEX ON officiel.organe (code_type);
```

`code_type = 'GP'` désigne un groupe parlementaire, `'PARPOL'` un parti
politique. La distinction que la spécification demandait de construire existe
déjà dans la source : 12 groupes et 22 partis en XVIe.

```sql
CREATE TABLE officiel.mandat (
    uid                text PRIMARY KEY,        -- 'PM797718'
    acteur_uid         text NOT NULL REFERENCES officiel.acteur(uid),
    organe_uid         text NOT NULL REFERENCES officiel.organe(uid),
    type_organe        text NOT NULL,           -- 'ASSEMBLEE', 'GP', 'COMPER'…
    date_debut         date NOT NULL,
    date_fin           date,                    -- NULL = en cours
    qualite_code       text,
    qualite_libelle    text,
    nomination_principale boolean,
    legislature        smallint REFERENCES officiel.legislature(id),
    lot_id             bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id         bigint REFERENCES officiel.import_lot(id)
);
CREATE INDEX ON officiel.mandat (acteur_uid, type_organe);
CREATE INDEX ON officiel.mandat (organe_uid);
```

Les mandats `GP` datés servent à afficher l'historique des appartenances sur la
page d'un parlementaire. Ils ne servent **pas** à déterminer le groupe d'un
député lors d'un vote : voir section 5.

---

## 4. Dossiers, documents, actes

```sql
CREATE TABLE officiel.dossier (
    uid                 text PRIMARY KEY,       -- 'DLR5L16N47035'
    legislature         smallint,               -- sans FK, voir ci-dessous
    titre               text,                   -- titre court, éditorialisé
    titre_chemin        text,
    senat_chemin        text,                   -- amorce de la navette
    procedure_code      text,
    procedure_libelle   text,
    acteur_initiateur   text REFERENCES officiel.acteur(uid),
    lot_id              bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id          bigint REFERENCES officiel.import_lot(id)
);
```

`senat_chemin` est renseigné dès la XVe. C'est le point d'accroche de la future
intégration du Sénat, disponible sans rien ajouter.

`legislature` ne porte pas de clé étrangère, et c'est une correction imposée par
les données : **l'archive d'une législature contient des dossiers déposés sous des
législatures antérieures** et toujours vivants. L'archive de la XVIe en contient
jusqu'à la Xe. La contrainte faisait échouer l'import au premier dossier hérité.

```sql
CREATE TABLE officiel.document (
    uid               text PRIMARY KEY,         -- 'PIONANR5L16B0739'
    dossier_uid       text,                     -- sans FK, voir ci-dessous
    legislature       smallint,
    type_document     text,                     -- 'texteLoi_Type', 'rapportParlementaire_Type'…
    denomination      text,                     -- 'Projet de loi', 'Proposition de loi'
    titre_principal   text NOT NULL,
    titre_court       text,
    statut_adoption   text,
    -- Titre normalisé : clé de jointure du rattachement scrutin / dossier.
    -- Stockée plutôt que recalculée, c'est la jointure la plus sollicitée.
    cle_titre         text,
    lot_id            bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id        bigint REFERENCES officiel.import_lot(id)
);
CREATE INDEX ON officiel.document (dossier_uid);
CREATE INDEX ON officiel.document (cle_titre);
```

`dossier_uid` est également sans clé étrangère : un document peut renvoyer à un
dossier absent de l'archive en cours d'import, la référence se résolvant quand
les autres législatures sont chargées. L'intégrité se contrôle après coup : un
seul document orphelin subsiste après l'import de la XVIe.

Cette table n'est pas un confort d'affichage : c'est elle qui porte le titre
légal complet, et donc le rattachement des scrutins aux dossiers (section 6). Le
titre court du dossier ne suffit pas, « Baux ruraux pour les communes d'au plus
3.500 habitants » ne ressemble à aucun libellé de scrutin.

```sql
CREATE TABLE officiel.acte_legislatif (
    dossier_uid       text NOT NULL REFERENCES officiel.dossier(uid),
    uid               text NOT NULL,
    acte_parent_uid   text,
    profondeur        smallint NOT NULL,
    code_acte         text,
    libelle_canonique text,
    libelle_court     text,
    organe_uid        text,
    date_acte         timestamptz,
    lot_id            bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (dossier_uid, uid)
);

CREATE INDEX ON officiel.acte_legislatif (uid);
```

**La clé est `(dossier, uid)`, et ce n'est pas une précaution.** Sur la XVIe,
99 `uid` d'actes apparaissent dans deux dossiers, et ils n'y portent pas le même
code : `CMP-MOTION` dans le dossier de la réforme des retraites, `AN21-MOTION`
dans le dossier d'engagement de responsabilité. Le code décrit le rôle de l'acte
dans cette procédure, pas une propriété de l'événement.

Une clé primaire sur le seul `uid` fait donc disparaître une version sur deux,
sans erreur ni avertissement. C'est ce qui effaçait la motion de censure du
dossier de la réforme, et c'est un contrôle sur un fait connu qui l'a rattrapé,
et non l'import, qui se terminait proprement.

L'auto-référence `acte_parent_uid` est indispensable : `acteLegislatif` est
**récursif** et de profondeur variable dans la source, les références de vote
ayant été constatées à trois et quatre niveaux d'imbrication. Un parseur à
profondeur fixe perd des données en silence. `profondeur` est stockée pour rendre
ce fait visible, et appartient au couple : le même acte n'occupe pas forcément la
même place dans deux dossiers.

Deux colonnes de libellé, parce que `libelleActe` n'est **pas une chaîne** dans
la source mais un objet `{nomCanonique, libelleCourt}`. Le stocker tel quel
produirait un libellé illisible sur toute la frise.

`date_acte` est un `timestamptz` et non une `date` : la source renseigne un
horodatage complet avec fuseau (`2023-03-17T00:00:00.000+01:00`).

C'est cette table qui alimente la frise « Dépôt → Commission → Assemblée →
Sénat → CMP → Conseil constitutionnel → promulgation » de la page loi. Les codes
`CC*` et `PROM*` y sont présents : cette frise se construit **entièrement** à
partir de la donnée Assemblée, sans Légifrance ni connecteur vers le Conseil
constitutionnel.

### Le 49.3 est un concept de premier rang

```sql
-- Un engagement de responsabilite porte le code d'acte AN21.
CREATE VIEW officiel.dossier_49_3 AS
SELECT DISTINCT dossier_uid FROM officiel.acte_legislatif
WHERE code_acte LIKE 'AN21%';

-- Deux dossiers qui partagent un acte decrivent le meme evenement sous deux
-- angles. C'est le seul lien entre un texte et l'engagement qui l'a fait
-- adopter : la source ne l'ecrit nulle part ailleurs.
CREATE VIEW officiel.dossier_lie_par_acte AS
SELECT DISTINCT a.dossier_uid, b.dossier_uid AS dossier_lie_uid
FROM officiel.acte_legislatif a
JOIN officiel.acte_legislatif b ON b.uid = a.uid AND b.dossier_uid <> a.dossier_uid;

CREATE VIEW officiel.dossier_adopte_sans_vote AS
SELECT DISTINCT l.dossier_uid
FROM officiel.dossier_lie_par_acte l
JOIN officiel.dossier_49_3 e ON e.dossier_uid = l.dossier_lie_uid
WHERE l.dossier_uid NOT IN (SELECT dossier_uid FROM officiel.dossier_49_3);
```

Ce n'est pas un raffinement : sans lui, le produit rate sa question fondatrice.
La réforme des retraites de 2023 n'a donné lieu à **aucun vote sur son ensemble**.
Une requête « qu'est-ce qui a été voté sur les retraites ? » fondée sur les
votes finaux renverrait une loi sur les retraites agricoles et manquerait la
réforme (voir DATA_SOURCES 7.1).

Le dossier de la loi ne porte pas `AN21` ; c'est le dossier d'engagement, séparé,
qui le porte. Sur la XVIe, 32 dossiers d'engagement permettent d'identifier
6 textes adoptés sans vote.

Une page loi doit donc distinguer trois états, et non deux :

| État | Ce que le produit affiche |
| --- | --- |
| Voté sur l'ensemble | Le scrutin, sa ventilation par groupe, les votes individuels |
| Adopté sans vote (49.3) | « Adopté sans vote. » Les motions de censure déposées et leur résultat |
| Adopté à main levée | « Vote individuel non disponible », aucun scrutin n'existant |

Ces dossiers d'engagement ne doivent jamais apparaître comme des lois autonomes
dans une liste : ce sont des actes de procédure, rattachés au texte qu'ils visent.

---

## 5. Scrutins et votes

```sql
CREATE TYPE officiel.position_vote AS ENUM ('POUR', 'CONTRE', 'ABSTENTION', 'NON_VOTANT');

CREATE TABLE officiel.scrutin (
    uid                  text PRIMARY KEY,      -- 'VTANR5L17V1'
    legislature          smallint NOT NULL REFERENCES officiel.legislature(id),
    numero               integer NOT NULL,
    date_scrutin         date NOT NULL,
    seance_ref           text,
    session_ref          text,
    type_vote_code       text NOT NULL,         -- 'SPO', 'SPS', 'MOC', 'SSG'
    type_vote_libelle    text,
    sort_code            text,                  -- 'adopté' | 'rejeté'
    sort_libelle         text,
    titre                text NOT NULL,
    objet_libelle        text NOT NULL,
    est_vote_sur_ensemble boolean NOT NULL,     -- dérivé, voir plus bas
    mode_publication     text NOT NULL,
    lieu_vote            text,                  -- n'existe qu'en XVIIe
    nombre_votants       integer,
    suffrages_exprimes   integer,
    suffrages_requis     integer,
    demandeur_texte      text,
    lot_id               bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id           bigint REFERENCES officiel.import_lot(id)
);
CREATE INDEX ON officiel.scrutin (legislature, date_scrutin);
CREATE INDEX ON officiel.scrutin (type_vote_code);
CREATE INDEX ON officiel.scrutin (est_vote_sur_ensemble) WHERE est_vote_sur_ensemble;
```

`est_vote_sur_ensemble` est calculé à l'import à partir du libellé. Il isole les
**801 votes finaux** noyés dans les 16 957 scrutins, dont 71 à 86 % portent sur
des amendements. C'est la colonne la plus sollicitée du produit : toutes les
pages loi, tous les quiz et tout le calcul de proximité partent de là. L'index
partiel la rend gratuite.

`lieu_vote` est nullable parce que le champ n'existe que dans la XVIIe. Le schéma
dérive entre législatures ; le modèle l'absorbe plutôt que de le nier.

```sql
CREATE TABLE officiel.scrutin_groupe (
    scrutin_uid            text NOT NULL REFERENCES officiel.scrutin(uid),
    ordre                  smallint NOT NULL,      -- position dans la source
    organe_uid             text,                   -- NULL = groupe non identifié
    nombre_membres         integer,
    position_majoritaire   text,
    voix_pour              integer NOT NULL DEFAULT 0,
    voix_contre            integer NOT NULL DEFAULT 0,
    voix_abstention        integer NOT NULL DEFAULT 0,
    voix_non_votant        integer NOT NULL DEFAULT 0,
    voix_non_votant_volontaire integer NOT NULL DEFAULT 0,
    nominatif_complet      boolean NOT NULL,
    ecart_constate         text,
    PRIMARY KEY (scrutin_uid, ordre)
);
```

Les colonnes `voix_*` viennent de `decompteVoix` et sont **la** vérité du
décompte. `nominatif_complet` dit si les listes nominatives correspondent à ces
totaux ; `ecart_constate` décrit l'écart le cas échéant.

Ces deux colonnes existent parce que l'incohérence est réelle : 17 catégories
divergentes en XVe, 39 en XVIe, dont un « 21 voix pour, aucun nom listé ».
L'interface doit pouvoir afficher l'agrégat tout en disant que le détail manque,
plutôt que de choisir en silence entre deux chiffres qui se contredisent.

**La clé est `(scrutin, ordre)` et non `(scrutin, organe)`**, parce que l'organe
peut manquer : 14 scrutins de la XVIIe listent leurs douze groupes avec un
`organeRef` de remplissage identique pour tous. Les clefer sur l'organe écrase
onze blocs sur douze (voir DATA_SOURCES 5.6).

```sql
CREATE TABLE officiel.vote (
    scrutin_uid     text NOT NULL REFERENCES officiel.scrutin(uid),
    acteur_uid      text NOT NULL REFERENCES officiel.acteur(uid),
    organe_uid      text,           -- groupe AU MOMENT DU VOTE ; NULL si inconnu
    mandat_uid      text REFERENCES officiel.mandat(uid),
    position        officiel.position_vote NOT NULL,
    par_delegation  boolean,
    lot_id          bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (scrutin_uid, acteur_uid)
);
CREATE INDEX ON officiel.vote (acteur_uid);
CREATE INDEX ON officiel.vote (organe_uid, position);
```

Quatre décisions structurantes tiennent dans cette table.

**La clé primaire `(scrutin_uid, acteur_uid)` est sûre.** Vérifié sur les
2 346 018 votes des trois législatures : aucun acteur n'apparaît deux fois dans
un même scrutin.

**`organe_uid` est nullable, et c'est une règle, pas une tolérance.** Quand la
source n'identifie pas le groupe (1 916 votes de la XVIIe), la colonne reste
vide. Recopier l'identifiant de remplissage `PO0` attribuerait ces votes à un
groupe imaginaire : inventer une appartenance par recopie mécanique n'est pas
moins grave que de la déduire.

**Le groupe au moment du vote n'est pas calculé.** Dans
la source, les votants sont imbriqués dans le bloc de leur groupe : chaque
scrutin enregistre la ventilation telle qu'elle était ce jour-là. Aucune
résolution par intervalle de dates n'est nécessaire, et donc aucun risque de se
tromper de groupe pour un député qui a changé d'appartenance.

**Il n'y a pas de valeur `ABSENT` dans l'énumération, et c'est délibéré.** Un
député absent ne figure dans aucune liste de la source : l'absence n'est pas une
donnée, c'est une déduction (`membres du groupe` moins `votants enregistrés`).
Lui donner une ligne reviendrait à inventer un fait. `NON_VOTANT`, lui, est
enregistré explicitement : c'est une position, celle d'un député présent qui ne
prend pas part au vote. Les deux ne doivent jamais être confondus, ni présentés
comme une abstention.

**`par_delegation` est importé et destiné à être affiché.** Il concerne 15,1 %
des votes de la XVIIe. Écrire « votre député a voté pour » sans mentionner qu'un
collègue a matériellement exprimé ce vote, c'est dire plus que ce que la donnée
dit.

Une colonne absente du modèle, volontairement : `positionMajoritaire` n'est pas
recopiée dans `vote`. Elle vit dans `scrutin_groupe` et nulle part ailleurs.
C'est le champ qui rendrait facile la faute interdite : déduire le vote d'un
député de la position de son groupe.

---

## 5 bis. Amendements (XVIe)

```sql
CREATE TABLE officiel.amendement (
    uid                   text PRIMARY KEY,       -- 'AMANR5L16PO59051B0009P0D1N000001'
    legislature           smallint,
    dossier_uid           text,                   -- sans FK, voir ci-dessous
    document_uid          text NOT NULL,           -- sans FK, voir ci-dessous
    examen_ref            text,
    organe_examen_code    text,                    -- 'AN' (séance) ou code de commission
    numero_long           text,                    -- 'CL1', 'CD16 (Rect)'…
    numero_ordre_depot    integer,
    amendement_parent_uid text,
    type_auteur           text NOT NULL,           -- 'Député' | 'Rapporteur' | 'Gouvernement'
    auteur_acteur_uid     text,                    -- NULL pour un amendement du Gouvernement
    auteur_groupe_uid     text,
    auteur_gouvernement_uid text,                  -- organe, seulement si type_auteur = 'Gouvernement'
    auteur_libelle        text,
    division_type         text,
    division_titre        text,
    division_designation  text,
    article_additionnel   boolean,
    date_depot            date,
    date_publication      date,
    date_sort             timestamptz,
    etat_code              text,
    etat_libelle            text,
    sous_etat_code          text,
    sous_etat_libelle       text,
    sort_brut               text,                  -- NULL si non discuté, voir plus bas
    sort_libelle             text,                 -- COALESCE(sort_brut, etat_libelle)
    soumis_article_40        boolean,
    dispositif                text,
    expose_sommaire           text,
    lot_id                    bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id                bigint REFERENCES officiel.import_lot(id)
);

CREATE TABLE officiel.amendement_cosignataire (
    amendement_uid text NOT NULL REFERENCES officiel.amendement(uid) ON DELETE CASCADE,
    acteur_uid     text NOT NULL,
    lot_id         bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (amendement_uid, acteur_uid)
);
```

**`sort_brut` est NULL pour 53 % des amendements de la XVIe, et ce n'est pas
une absence à corriger.** `cycleDeVie.sort` n'existe dans la source que
lorsque `etatDesTraitements.etat.code = 'DI'` (discuté) : un amendement jugé
irrecevable, retiré avant publication, ou jamais atteint parce que l'examen du
texte s'est arrêté avant, n'a simplement jamais reçu de décision sur le fond.
`etat_code` et `etat_libelle` restent la source de vérité du statut procédural,
et `sort_libelle`, calculé par `COALESCE(sort_brut, etat_libelle)`, donne un
affichage unique sans jamais deviner une valeur absente (voir DATA_SOURCES
section 7 bis.1).

**Le Gouvernement est un organe, jamais un acteur.** `type_auteur =
'Gouvernement'` s'accompagne toujours d'un `auteur_gouvernement_uid` (un
`PO…`) et jamais d'un `auteur_acteur_uid`. Vérifié sur les 1 499 amendements
gouvernementaux de la XVIe : zéro exception. Confondre les deux inventerait un
faux député auteur d'un texte du Gouvernement.

**`dossier_uid` et `document_uid` sont sans clé étrangère, comme
`officiel.document.dossier_uid`.** `dossier_uid` vient du nom de répertoire de
l'archive, pas d'un champ du fichier lui-même : rien ne le porte ailleurs. Il
concorde avec `document.dossierRef` sur l'intégralité du corpus mesuré, mais
peut désigner un dossier hérité d'une législature antérieure (même règle que
`officiel.dossier`, DATA_SOURCES section 4). `document_uid` (`texteLegislatifRef`
dans la source) est renseigné sur 100 % des amendements, mais 47 sur 163 789
(0,03 %) référencent un document absent du jeu Dossiers de la même archive.

**`amendement_cosignataire.acteur_uid` n'a pas de clé étrangère non plus.**
0,12 % des liens de cosignature (3 681 sur 3 148 274) pointent vers un acteur
absent du jeu Acteurs, sans doute des députés sortis de mandat avant
l'instantané `AMO20`. Trop marginal pour bloquer l'import, et cohérent avec le
gradient de qualité déjà observé ailleurs (`officiel.document`, section 4).

```sql
CREATE VIEW officiel.amendement_discute AS
SELECT * FROM officiel.amendement WHERE sort_brut IS NOT NULL;
```

Cette vue isole les 76 523 amendements de la XVIe qui ont effectivement une
décision sur le fond, préalable à toute carte « amendements importants » sur
une page loi.

---

## 5 ter. Débats (XVIe)

```sql
CREATE TABLE officiel.debat_seance (
    uid              text PRIMARY KEY,       -- seanceRef, le meme identifiant que scrutin.seance_ref
    compte_rendu_uid text NOT NULL,
    legislature      smallint NOT NULL REFERENCES officiel.legislature(id),
    session_ref      text,
    session_libelle  text,
    date_seance      timestamptz,
    date_seance_jour text,
    num_seance       integer,
    num_seance_jour  text,
    etat             text,
    diffusion        text,
    lot_id           bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id       bigint REFERENCES officiel.import_lot(id)
);

CREATE TABLE officiel.debat_point (
    seance_uid          text NOT NULL REFERENCES officiel.debat_seance(uid) ON DELETE CASCADE,
    id_syceron          text NOT NULL,
    parent_id_syceron   text,               -- pas de cle etrangere, meme raison que acte_legislatif
    type_conteneur       text NOT NULL,      -- 'point' | 'ouvertureSeance' | 'finSeance'
    nivpoint              smallint,
    ordre_absolu_seance    integer,
    intitule               text,
    lot_id                 bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (seance_uid, id_syceron)
);

CREATE TABLE officiel.intervention (
    id_syceron          text PRIMARY KEY,
    seance_uid           text NOT NULL REFERENCES officiel.debat_seance(uid) ON DELETE CASCADE,
    point_id_syceron      text,             -- FK composite (seance_uid, point_id_syceron) -> debat_point
    ordre_absolu_seance    integer,
    code_grammaire          text,
    code_style               text,
    role_debat                text,
    acteur_uid                 text,        -- pas de cle etrangere, voir plus bas
    mandat_uid                  text,
    texte                        text,
    lot_id                       bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id                   bigint REFERENCES officiel.import_lot(id)
);

CREATE TABLE officiel.intervention_orateur (
    intervention_id_syceron text NOT NULL REFERENCES officiel.intervention(id_syceron) ON DELETE CASCADE,
    ordre                   smallint NOT NULL,
    orateur_id_brut          text,
    nom                       text,
    qualite                   text,
    lot_id                    bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (intervention_id_syceron, ordre)
);
```

C'est le premier jeu XML natif du modèle, et le seul point d'ancrage vers le
reste des données est `seance_uid` = `seanceRef`, **le même identifiant que**
`officiel.scrutin.seance_ref`. Rien dans le XML des débats ne référence
directement un dossier ou un document législatif (DATA_SOURCES section
7 ter.1) : joindre un débat à une loi passe par ses scrutins, puis par le
rattachement scrutin ↔ dossier de la section 6.

**`intervention` est le `paragraphe` de la source : la plus petite unité de
parole.** `paragraphe` ne s'imbrique jamais (profondeur maximale 1 vérifiée
sur les 337 041 occurrences du corpus XVIe), contrairement à `point`, qui EST
récursif et de profondeur variable (1 à 5, plus les codes de procédure 99 et
100 pour les suspensions de séance) — même piège que `acteLegislatif`
(section 4), même absence de clé étrangère sur `parent_id_syceron`, pour la
même raison.

**`acteur_uid` est nullable et sans clé étrangère, et c'est une règle, pas une
tolérance.** Deux identifiants de remplissage existent dans la source, jamais
recopiés : `PA0` (« Un député du groupe LR », un orateur que la source
n'identifie pas individuellement, 3 680 occurrences) et une poignée
d'identifiants négatifs (`PA-121449`…, 684 occurrences), ni l'un ni l'autre
n'étant un acteur réel — même logique que `PO0` pour les organes
(DATA_SOURCES section 5.6). Sans clé étrangère parce que 13 des 656 acteurs
distincts référencés par les débats de la XVIe sont absents du jeu Acteurs
(AMO20), gradient de qualité déjà observé ailleurs.

**`intervention_orateur` est une table, pas une colonne, parce que 0,18 % des
interventions (600 sur 337 041) ont deux orateurs** — typiquement deux
députés qui s'expriment au même instant lors d'une interruption. Une colonne
unique en perdrait un sur deux, même raisonnement que pour les cosignataires
d'amendement (section 5 bis). `nom` et `qualite` sont le seul endroit où le
libellé affiché par la source pour un orateur non identifié
(« Un député du groupe LR ») est disponible : il ne se déduit d'aucune autre
table.

Ce que ce modèle importe volontairement, et ce qu'il n'ajoute pas : `texte`
est le contenu brut de l'intervention, aplati (balises de mise en forme
retirées, `<br/>` converti en retour à la ligne), mais **aucune tentative
n'est faite ici de qualifier un argument comme favorable ou défavorable** —
cette lecture appartient au schéma `enrichissement`, pas à celui-ci. Ce
module fournit la matière première citable (`intervention.id_syceron`),
pas l'interprétation.

---

## 6. Rattachement scrutin ↔ dossier

```sql
CREATE TYPE officiel.methode_rattachement AS ENUM ('OFFICIEL', 'RECONSTRUIT', 'CONFLIT');

CREATE TABLE officiel.scrutin_dossier (
    scrutin_uid          text PRIMARY KEY REFERENCES officiel.scrutin(uid),
    dossier_uid          text REFERENCES officiel.dossier(uid),   -- retenu, NULL si conflit
    methode              officiel.methode_rattachement NOT NULL,
    dossier_officiel_uid text REFERENCES officiel.dossier(uid),
    dossier_reconstruit_uid text REFERENCES officiel.dossier(uid),
    note                 text,
    lot_id               bigint NOT NULL REFERENCES officiel.import_lot(id)
);
```

Cette table est le cœur technique du produit, parce que le lien n'existe pas dans
la source pour les XVe et XVIe : `objet.dossierLegislatif` y est vide à 100 %.
La méthode de reconstitution et ses mesures, précision de 100 % et couverture portée
de 69,6 % à 95,5 %, sont documentées en DATA_SOURCES section 4.

Trois colonnes de dossier plutôt qu'une, parce que le lien officiel **se trompe
parfois**. Deux erreurs vérifiées sur 556 liens : un vote sur la dématérialisation
de l'état civil rattaché au dossier « ingérences étrangères », un vote sur
l'éthique de l'urgence rattaché au « versement de la prime de naissance ».

Quand les deux méthodes divergent, `methode = 'CONFLIT'`, `dossier_uid` reste
`NULL`, et les deux candidats sont conservés. Le produit signale alors
l'incohérence au lieu de trancher.

Cela donne un corollaire au principe « données officielles d'abord » :
**vérifier les données officielles entre elles**. Une source primaire n'est pas
infaillible ; la traçabilité consiste à pouvoir constater une incohérence, pas à
la recopier proprement. Le rattachement reconstruit doit donc tourner partout, y
compris là où le lien officiel existe, comme contrôle croisé.

---

## 7. Couche d'enrichissement

Esquisse, à préciser quand les formats concernés auront été inspectés.

```sql
CREATE TABLE enrichissement.resume (
    id            bigserial PRIMARY KEY,
    dossier_uid   text NOT NULL REFERENCES officiel.dossier(uid),
    genre         text NOT NULL,              -- 'en_30_secondes', 'mesure', 'argument'
    contenu       text NOT NULL,
    modele        text NOT NULL,
    prompt_hash   text NOT NULL,
    genere_le     timestamptz NOT NULL DEFAULT now(),
    valide_par    text,                       -- relecture humaine
    CONSTRAINT resume_non_vide CHECK (length(contenu) > 0)
);

-- Sans citation, pas d'affirmation : la table de citations est obligatoire.
CREATE TABLE enrichissement.citation (
    resume_id     bigint NOT NULL REFERENCES enrichissement.resume(id) ON DELETE CASCADE,
    document_uid  text REFERENCES officiel.document(uid),
    scrutin_uid   text REFERENCES officiel.scrutin(uid),
    acte_uid      text REFERENCES officiel.acte_legislatif(uid),
    extrait       text,
    CHECK (num_nonnulls(document_uid, scrutin_uid, acte_uid) >= 1)
);
```

La contrainte `CHECK` sur `citation` est le garde-fou anti-hallucination rendu
structurel : une citation qui ne pointe vers aucune source officielle ne peut pas
être insérée. Un résumé sans citation associée ne doit pas être publié, règle à
faire respecter par une vue ou un déclencheur, pas seulement par convention.

`theme`, `dossier_theme` et `score_importance` sont modélisés depuis
`db/migrations/002_enrichissement.sql` et documentés dans
[docs/CLASSIFICATION.md](CLASSIFICATION.md) : score de confiance et
justification obligatoires par ligne de `dossier_theme` (spec §8), quatre
sous-scores de `score_importance` conservés dans des colonnes distinctes,
`score_total` calculé seulement quand les quatre sont renseignés (§9).
`score_importance.institutionnel` et `.intensite_parlementaire` sont
effectivement calculés sur `data/pg16` ; `theme`/`dossier_theme` n'ont qu'un
échantillon de 10 dossiers classés à la main, la classification en masse
restant à faire (voir CLASSIFICATION.md section 4).

Restent à modéliser, une fois leurs sources inspectées : `quiz` et
`question` (§10-11), `mention_media` (§17).

---

## 8. Idempotence de l'import

Toutes les tables importées ont pour clé primaire l'identifiant de la source
(`PA…`, `PO…`, `PM…`, `DLR…`, `VTANR…`). L'import est donc un `INSERT … ON
CONFLICT (uid) DO UPDATE`, rejouable autant de fois que voulu sans créer de
doublon, comme l'exige la spécification §22.

Pour `vote`, dont la clé est composite, le rejeu d'un scrutin supprime puis
réinsère l'ensemble de ses votes dans une transaction : un scrutin est un tout
cohérent, pas une collection de lignes indépendantes.

`amendement_cosignataire` a lui aussi une clé composite, mais suit une règle
plus simple : `ON CONFLICT DO NOTHING`, sans suppression préalable. Les archives
XVe et XVIe étant figées depuis 2022 et 2024 (section 1.2), rejouer l'import ne
change jamais la liste des cosignataires d'un amendement déjà chargé ; la seule
situation où cela compterait, un cosignataire retiré entre deux imports de la
XVIIe en cours, laisserait une ligne périmée. Accepté pour l'instant, à
corriger si l'import d'amendements de la XVIIe est mis en place.

`intervention_orateur` suit la même logique que `scrutin_groupe` plutôt que
celle de `amendement_cosignataire` : `ON CONFLICT DO UPDATE`, parce que
c'est la seule table de ce module où le contenu (nom, qualité affichés) peut
avoir un sens à corriger sans changer de clé.

Ordre d'import imposé par les clés étrangères :

```
legislature → organe → acteur → mandat
            → dossier → document → acte_legislatif
            → amendement → amendement_cosignataire
            → scrutin → scrutin_groupe → vote
            → scrutin_dossier
            → debat_seance → debat_point → intervention → intervention_orateur
```

Les organes avant les acteurs, et les acteurs avant les mandats, faute de quoi
les références de mandat échouent.

---

## 9. Ce que ce modèle ne fait pas encore

Les amendements de la XVIe sont modélisés (section 5 bis) ; ceux de la XVe et
de la XVIIe ne le sont pas encore, leurs formats n'ayant pas été inspectés
(DATA_SOURCES section 8). Ne pas supposer qu'ils partagent la structure de la
XVIe : c'est justement l'erreur que l'inspection avant modélisation vise à
éviter, et déjà commise une fois côté XVe pour les scrutins et les dossiers
(nommage `_XV`, dossier `amendements_legis`).

Les débats de la XVIe sont modélisés (section 5 ter) ; ceux de la XVe et de
la XVIIe ne le sont pas, leurs formats n'ayant pas été inspectés
(DATA_SOURCES section 8). Avec les amendements des deux autres législatures,
c'est l'essentiel du volume restant hors du MVP, pour une part marginale du
produit. Le modèle importe le texte brut des interventions, mais ne qualifie
aucun argument comme favorable ou défavorable : cette lecture reste entière à
construire dans `enrichissement`, à partir de `intervention.id_syceron` comme
citation.

Le Sénat, Légifrance et le Parlement européen ne sont pas modélisés non plus,
mais le modèle ne leur ferme pas la porte : `import_lot.institution`,
`dossier.senat_chemin` et l'absence d'hypothèse « Assemblée » dans les tables de
votes suffisent à les accueillir. La vraie question ouverte reste l'identifiant
qui permettra de raccrocher un texte sénatorial à son dossier Assemblée pour
reconstituer la navette. Elle ne se tranchera qu'en inspectant DOSLEG.
