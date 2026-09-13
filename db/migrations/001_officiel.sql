-- Schéma « officiel » : données importées de sources publiques.
-- Rien de ce qui est produit par IA n'écrit ici. Voir docs/DATA_MODEL.md.

CREATE SCHEMA IF NOT EXISTS officiel;

-- ---------------------------------------------------------------------------
-- Traçabilité
-- ---------------------------------------------------------------------------

CREATE TABLE officiel.import_lot (
    id                   bigserial PRIMARY KEY,
    jeu                  text        NOT NULL,
    institution          text        NOT NULL DEFAULT 'AN',
    legislature          smallint,
    url_source           text        NOT NULL,
    last_modified_source timestamptz,
    taille_octets        bigint,
    sha256               text        NOT NULL,
    demarre_le           timestamptz NOT NULL DEFAULT now(),
    termine_le           timestamptz,
    lignes_inserees      integer     NOT NULL DEFAULT 0,
    lignes_modifiees     integer     NOT NULL DEFAULT 0,
    statut               text        NOT NULL DEFAULT 'en_cours'
);

CREATE INDEX idx_lot_jeu ON officiel.import_lot (jeu, legislature, demarre_le DESC);

-- ---------------------------------------------------------------------------
-- Référentiel
-- ---------------------------------------------------------------------------

CREATE TABLE officiel.legislature (
    id          smallint PRIMARY KEY,
    institution text     NOT NULL DEFAULT 'AN',
    date_debut  date     NOT NULL,
    date_fin    date,
    archivee    boolean  NOT NULL DEFAULT false
);

CREATE TABLE officiel.organe (
    uid            text PRIMARY KEY,
    code_type      text NOT NULL,
    libelle        text NOT NULL,
    libelle_abrege text,
    libelle_abrev  text,
    organe_parent  text,
    legislature    smallint,
    date_debut     date,
    date_fin       date,
    lot_id         bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id     bigint REFERENCES officiel.import_lot(id)
);

-- L'auto-référence n'est pas déclarée en FK : l'ordre d'insertion des organes
-- ne garantit pas que le parent existe déjà, et la source contient des
-- références vers des organes absents du périmètre importé.
CREATE INDEX idx_organe_type ON officiel.organe (code_type);
CREATE INDEX idx_organe_parent ON officiel.organe (organe_parent);

CREATE TABLE officiel.acteur (
    uid                   text PRIMARY KEY,
    civilite              text,
    prenom                text,
    nom                   text NOT NULL,
    date_naissance        date,
    ville_naissance       text,
    departement_naissance text,
    pays_naissance        text,
    date_deces            date,
    profession            text,
    uri_hatvp             text,
    lot_id                bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id            bigint REFERENCES officiel.import_lot(id)
);

CREATE INDEX idx_acteur_nom ON officiel.acteur (nom, prenom);

CREATE TABLE officiel.mandat (
    uid                   text PRIMARY KEY,
    acteur_uid            text NOT NULL REFERENCES officiel.acteur(uid),
    organe_uid            text NOT NULL,
    type_organe           text NOT NULL,
    date_debut            date NOT NULL,
    date_fin              date,
    qualite_code          text,
    qualite_libelle       text,
    nomination_principale boolean,
    legislature           smallint,
    lot_id                bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id            bigint REFERENCES officiel.import_lot(id)
);

CREATE INDEX idx_mandat_acteur ON officiel.mandat (acteur_uid, type_organe);
CREATE INDEX idx_mandat_organe ON officiel.mandat (organe_uid);

-- ---------------------------------------------------------------------------
-- Dossiers, documents, actes
-- ---------------------------------------------------------------------------

CREATE TABLE officiel.dossier (
    uid               text PRIMARY KEY,
    -- Pas de cle etrangere : l'archive d'une legislature contient des dossiers
    -- deposes sous des legislatures anterieures et toujours vivants. Constate
    -- jusqu'a la Xe dans l'archive de la XVIe.
    legislature       smallint,
    titre             text,
    titre_chemin      text,
    senat_chemin      text,
    procedure_code    text,
    procedure_libelle text,
    acteur_initiateur text,
    lot_id            bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id        bigint REFERENCES officiel.import_lot(id)
);

CREATE TABLE officiel.document (
    uid             text PRIMARY KEY,
    -- Pas de cle etrangere : un document peut renvoyer a un dossier absent de
    -- l'archive en cours d'import, les archives n'etant pas cloisonnees par
    -- legislature. La reference se resout quand les autres sont importees ;
    -- l'integrite se controle apres coup, pas pendant.
    dossier_uid     text,
    legislature     smallint,
    type_document   text,
    denomination    text,
    titre_principal text NOT NULL,
    titre_court     text,
    statut_adoption text,
    -- Titre normalisé servant au rattachement scrutin / dossier (DATA_SOURCES 4.2).
    -- Stocké plutôt que recalculé : c'est la clé de jointure la plus sollicitée.
    cle_titre       text,
    lot_id          bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id      bigint REFERENCES officiel.import_lot(id)
);

CREATE INDEX idx_document_dossier ON officiel.document (dossier_uid);
CREATE INDEX idx_document_cle_titre ON officiel.document (cle_titre);

-- Un acte est decrit PAR DOSSIER, pas dans l'absolu.
--
-- Mesure sur la XVIe : 99 uid d'actes apparaissent dans deux dossiers, et ils
-- n'y portent pas le meme code. Les actes L16-VD212217 et L16-VD212218 sont
-- 'CMP-MOTION' dans le dossier de la reforme des retraites -- l'evenement a eu
-- lieu au stade de la commission mixte paritaire -- et 'AN21-MOTION' dans le
-- dossier d'engagement de responsabilite, ou ils sont les motions de censure
-- deposees contre le 49.3. Le code decrit le role de l'acte dans cette
-- procedure, pas une propriete de l'evenement.
--
-- La cle est donc (dossier, uid). L'uid identifie l'evenement sous-jacent :
-- c'est par lui qu'on relie une loi au dossier d'engagement qui l'a fait
-- adopter sans vote.
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

CREATE INDEX idx_acte_uid ON officiel.acte_legislatif (uid);
CREATE INDEX idx_acte_dossier_date ON officiel.acte_legislatif (dossier_uid, date_acte);
CREATE INDEX idx_acte_code ON officiel.acte_legislatif (code_acte);

-- Références de vote portées par les actes. C'est le lien officiel
-- scrutin -> dossier, et il est faux dans 2 cas sur 556 (DATA_SOURCES 4.3).
CREATE TABLE officiel.acte_vote_ref (
    -- Pas de cle etrangere : un uid d'acte n'est plus unique, il peut decrire
    -- le meme evenement dans plusieurs dossiers.
    acte_uid    text NOT NULL,
    scrutin_uid text NOT NULL,
    PRIMARY KEY (acte_uid, scrutin_uid)
);

CREATE INDEX idx_acte_vote_scrutin ON officiel.acte_vote_ref (scrutin_uid);

-- ---------------------------------------------------------------------------
-- Scrutins et votes
-- ---------------------------------------------------------------------------

CREATE TYPE officiel.position_vote AS ENUM ('POUR', 'CONTRE', 'ABSTENTION', 'NON_VOTANT');

CREATE TABLE officiel.scrutin (
    uid                   text PRIMARY KEY,
    legislature           smallint NOT NULL REFERENCES officiel.legislature(id),
    numero                integer  NOT NULL,
    date_scrutin          date     NOT NULL,
    seance_ref            text,
    session_ref           text,
    organe_ref            text,
    type_vote_code        text     NOT NULL,
    type_vote_libelle     text,
    sort_code             text,
    sort_libelle          text,
    titre                 text     NOT NULL,
    objet_libelle         text     NOT NULL,
    -- Isole les 801 votes finaux parmi 16 957 scrutins. Colonne la plus
    -- sollicitée du produit : toute page loi et tout quiz partent de là.
    est_vote_sur_ensemble boolean  NOT NULL DEFAULT false,
    cle_titre             text,
    mode_publication      text     NOT NULL,
    lieu_vote             text,
    nombre_votants        integer,
    suffrages_exprimes    integer,
    suffrages_requis      integer,
    demandeur_texte       text,
    lot_id                bigint   NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id            bigint   REFERENCES officiel.import_lot(id)
);

CREATE INDEX idx_scrutin_date ON officiel.scrutin (legislature, date_scrutin);
CREATE INDEX idx_scrutin_type ON officiel.scrutin (type_vote_code);
CREATE INDEX idx_scrutin_ensemble ON officiel.scrutin (est_vote_sur_ensemble)
    WHERE est_vote_sur_ensemble;
CREATE INDEX idx_scrutin_cle_titre ON officiel.scrutin (cle_titre);

-- La cle est (scrutin, ordre) et non (scrutin, organe), parce que l'organe peut
-- manquer : 14 scrutins de la XVIIe listent leurs 12 groupes avec un organeRef
-- factice 'PO0' pour tous. Les effectifs montrent qu'il s'agit bien de groupes
-- distincts -- 124, 93, 71, 66... -- mais la source n'a pas renseigne lesquels.
-- Les cleffer sur l'organe ecraserait 11 blocs sur 12 et attribuerait tous ces
-- votes a un meme faux groupe.
CREATE TABLE officiel.scrutin_groupe (
    scrutin_uid                text     NOT NULL REFERENCES officiel.scrutin(uid) ON DELETE CASCADE,
    ordre                      smallint NOT NULL,
    -- NULL = groupe non identifie par la source. Jamais un identifiant invente.
    organe_uid                 text,
    nombre_membres             integer,
    position_majoritaire       text,
    voix_pour                  integer  NOT NULL DEFAULT 0,
    voix_contre                integer  NOT NULL DEFAULT 0,
    voix_abstention            integer  NOT NULL DEFAULT 0,
    voix_non_votant            integer  NOT NULL DEFAULT 0,
    voix_non_votant_volontaire integer  NOT NULL DEFAULT 0,
    -- false quand les listes nominatives ne correspondent pas aux décomptes.
    -- 17 cas en XVe, 39 en XVIe, 0 en XVIIe (DATA_SOURCES 5.5).
    nominatif_complet          boolean  NOT NULL DEFAULT true,
    ecart_constate             text,
    PRIMARY KEY (scrutin_uid, ordre)
);

CREATE INDEX idx_scrutin_groupe_organe ON officiel.scrutin_groupe (organe_uid);

CREATE TABLE officiel.vote (
    scrutin_uid    text NOT NULL REFERENCES officiel.scrutin(uid) ON DELETE CASCADE,
    acteur_uid     text NOT NULL,
    -- Groupe AU MOMENT DU VOTE. Donne par la structure de la source, jamais
    -- calcule par intervalle de dates (DATA_SOURCES 5.1).
    -- NULL quand la source ne l'a pas renseigne : 1 916 votes de la XVIIe sont
    -- dans ce cas. Un groupe inconnu s'affiche comme inconnu.
    organe_uid     text,
    mandat_uid     text,
    position       officiel.position_vote NOT NULL,
    -- 15,1 % des votes de la XVIIe. À afficher, pas à masquer.
    par_delegation boolean,
    lot_id         bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (scrutin_uid, acteur_uid)
);

CREATE INDEX idx_vote_acteur ON officiel.vote (acteur_uid);
CREATE INDEX idx_vote_groupe ON officiel.vote (organe_uid, position);

-- ---------------------------------------------------------------------------
-- Rattachement scrutin <-> dossier
-- ---------------------------------------------------------------------------

CREATE TYPE officiel.methode_rattachement AS ENUM ('OFFICIEL', 'RECONSTRUIT', 'CONFLIT');

CREATE TABLE officiel.scrutin_dossier (
    scrutin_uid             text PRIMARY KEY REFERENCES officiel.scrutin(uid) ON DELETE CASCADE,
    dossier_uid             text REFERENCES officiel.dossier(uid),
    methode                 officiel.methode_rattachement NOT NULL,
    dossier_officiel_uid    text REFERENCES officiel.dossier(uid),
    dossier_reconstruit_uid text REFERENCES officiel.dossier(uid),
    note                    text,
    lot_id                  bigint NOT NULL REFERENCES officiel.import_lot(id),
    -- Un conflit ne se tranche pas : on garde les deux candidats et on
    -- n'en retient aucun.
    CONSTRAINT conflit_sans_dossier_retenu
        CHECK (methode <> 'CONFLIT' OR dossier_uid IS NULL)
);

CREATE INDEX idx_scrutin_dossier_dossier ON officiel.scrutin_dossier (dossier_uid);
CREATE INDEX idx_scrutin_dossier_methode ON officiel.scrutin_dossier (methode);

-- ---------------------------------------------------------------------------
-- Vues de lecture
-- ---------------------------------------------------------------------------

-- Un engagement de responsabilité (49.3) se reconnaît au code d'acte AN21,
-- jamais au titre : la convention de titrage a changé entre législatures.
CREATE VIEW officiel.dossier_49_3 AS
SELECT DISTINCT dossier_uid
FROM officiel.acte_legislatif
WHERE code_acte LIKE 'AN21%';

-- Deux dossiers qui partagent un acte decrivent le meme evenement sous deux
-- angles. C'est ce partage qui relie un texte au dossier « Engagement de la
-- responsabilite du Gouvernement » qui l'a fait adopter sans vote : le lien
-- n'est ecrit nulle part ailleurs dans la source.
CREATE VIEW officiel.dossier_lie_par_acte AS
SELECT DISTINCT a.dossier_uid, b.dossier_uid AS dossier_lie_uid
FROM officiel.acte_legislatif a
JOIN officiel.acte_legislatif b ON b.uid = a.uid AND b.dossier_uid <> a.dossier_uid;

-- Un texte adopte sans vote : il partage un acte avec un dossier d'engagement
-- de responsabilite, sans porter lui-meme de code AN21.
CREATE VIEW officiel.dossier_adopte_sans_vote AS
SELECT DISTINCT l.dossier_uid
FROM officiel.dossier_lie_par_acte l
JOIN officiel.dossier_49_3 e ON e.dossier_uid = l.dossier_lie_uid
WHERE l.dossier_uid NOT IN (SELECT dossier_uid FROM officiel.dossier_49_3);

-- Scrutins dont la repartition par groupe est inexploitable : la source n'a
-- identifie aucun des groupes. Le produit doit le dire au lieu d'afficher une
-- ventilation fausse.
CREATE VIEW officiel.scrutin_groupe_non_identifie AS
SELECT DISTINCT scrutin_uid
FROM officiel.scrutin_groupe
WHERE organe_uid IS NULL;

-- Les motions de censure n'enregistrent que les votes POUR : les afficher avec
-- un gabarit POUR/CONTRE/ABSTENTION produit un « 0 contre » trompeur.
CREATE VIEW officiel.motion_de_censure AS
SELECT uid, legislature, date_scrutin, titre, sort_code,
       nombre_votants, suffrages_requis
FROM officiel.scrutin
WHERE type_vote_code = 'MOC';

-- ---------------------------------------------------------------------------
-- Amendements
-- ---------------------------------------------------------------------------

-- Un amendement n'a pas de decision (« sort ») tant qu'il n'a pas ete discute
-- en seance ou en commission : mesure sur la XVIe, 87 266 amendements sur
-- 163 789 (53 %) n'ont jamais de sort, et ce sont exactement ceux dont l'etat
-- de traitement n'est pas 'DI' (discute) -- irrecevables, retires avant
-- publication, ou encore a discuter/en traitement quand l'archive a ete
-- figee. Ce n'est pas une donnee manquante a corriger : l'amendement n'a
-- simplement jamais recu de decision sur le fond (DATA_SOURCES section 9).
CREATE TABLE officiel.amendement (
    uid                  text PRIMARY KEY,
    legislature          smallint,
    -- Pas de cle etrangere : le dossier peut avoir ete depose sous une
    -- legislature anterieure (meme regle que officiel.dossier). Deduit du
    -- chemin de l'archive (json/<dossier>/<document>/*.json), jamais present
    -- comme champ dans le fichier de l'amendement lui-meme. Verifie sur
    -- l'integralite du corpus : cette deduction concorde avec document.dossierRef
    -- partout ou le document correspondant existe.
    dossier_uid          text,
    -- Pas de cle etrangere : 47 amendements sur 163 789 (0,03 %) referencent un
    -- document absent du jeu Dossiers legislatifs de la meme archive.
    document_uid         text NOT NULL,
    examen_ref           text,
    -- 'AN' = seance publique ; sinon code de la commission saisie (CION_LOIS,
    -- CION_FIN...).
    organe_examen_code   text,
    numero_long          text,
    numero_ordre_depot   integer,
    -- Regroupe les amendements identiques deposes ensemble par plusieurs
    -- signataires. Pas de cle etrangere : la cible appartient au meme corpus,
    -- mais rien ne garantit qu'elle survit a un import partiel.
    amendement_parent_uid text,
    -- 'Depute' | 'Rapporteur' | 'Gouvernement'. Seul un depute ou un
    -- rapporteur a un acteur_uid ; le Gouvernement est identifie par un
    -- organe (auteur_gouvernement_uid), jamais par un acteur.
    type_auteur          text NOT NULL,
    auteur_acteur_uid    text,
    auteur_groupe_uid    text,
    auteur_gouvernement_uid text,
    auteur_libelle       text,
    division_type        text,
    division_titre       text,
    division_designation text,
    article_additionnel  boolean,
    date_depot           date,
    date_publication     date,
    date_sort            timestamptz,
    etat_code            text,
    etat_libelle         text,
    sous_etat_code        text,
    sous_etat_libelle     text,
    -- NULL quand l'amendement n'a pas ete discute (voir commentaire de table).
    sort_brut             text,
    -- sort_brut si present, sinon etat_libelle : les deux champs sont fournis
    -- par la source, ce n'est pas une valeur devinee. Sert d'affichage unique
    -- du statut d'un amendement, discute ou non.
    sort_libelle           text,
    soumis_article_40      boolean,
    dispositif             text,
    expose_sommaire        text,
    lot_id                 bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id              bigint REFERENCES officiel.import_lot(id)
);

CREATE INDEX idx_amendement_dossier ON officiel.amendement (dossier_uid);
CREATE INDEX idx_amendement_document ON officiel.amendement (document_uid);
CREATE INDEX idx_amendement_auteur ON officiel.amendement (auteur_acteur_uid);
CREATE INDEX idx_amendement_sort ON officiel.amendement (sort_brut);
CREATE INDEX idx_amendement_etat ON officiel.amendement (etat_code);

-- Cosignataires. Cle etrangere vers l'amendement seulement : l'acteur peut
-- manquer du jeu Acteurs (3 681 cas sur 3 148 274 references, 0,12 % --
-- probablement des deputes sortis de mandat avant l'instantane AMO20).
-- L'absence d'un depute de ce jeu ne doit pas faire echouer l'import d'un
-- amendement.
CREATE TABLE officiel.amendement_cosignataire (
    amendement_uid text NOT NULL REFERENCES officiel.amendement(uid) ON DELETE CASCADE,
    acteur_uid     text NOT NULL,
    lot_id         bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (amendement_uid, acteur_uid)
);

CREATE INDEX idx_amendement_cosignataire_acteur ON officiel.amendement_cosignataire (acteur_uid);

-- Amendements dont la decision de fond est connue : exclut les amendements
-- irrecevables, retires avant publication ou jamais discutes.
CREATE VIEW officiel.amendement_discute AS
SELECT * FROM officiel.amendement WHERE sort_brut IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Débats (comptes rendus intégraux de séance, format XML « syceron »)
-- ---------------------------------------------------------------------------

-- Une séance. La cle est `seanceRef`, pas l'uid du compte rendu : c'est ce
-- meme identifiant que porte deja `officiel.scrutin.seance_ref`, verifie
-- concordant (ex. RUANR5L16S2023IDS26958 porte les deux motions de censure du
-- 20 mars 2023 ET le debat qui les a precedees). C'est le seul point d'ancrage
-- entre un debat et le reste du modele : rien dans le XML ne reference
-- directement un dossier ou un document legislatif (DATA_SOURCES section 8).
CREATE TABLE officiel.debat_seance (
    uid              text PRIMARY KEY,       -- seanceRef, 'RUANR5L16S2022IDS26235'
    compte_rendu_uid text NOT NULL,          -- uid du fichier, 'CRSANR5L16S2022E1N001'
    legislature      smallint NOT NULL REFERENCES officiel.legislature(id),
    session_ref      text,
    session_libelle  text,
    date_seance      timestamptz,
    date_seance_jour text,                   -- libelle humain source, ex. 'lundi 20 mars 2023'
    num_seance       integer,
    num_seance_jour  text,                   -- pas toujours numerique ('Unique')
    etat             text,
    diffusion        text,
    lot_id           bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id       bigint REFERENCES officiel.import_lot(id)
);

CREATE INDEX idx_debat_seance_date ON officiel.debat_seance (legislature, date_seance);

-- Sommaire hierarchique d'une seance : un `point` XML (ou le conteneur
-- `ouvertureSeance`/`finSeance`) porte un intitule qui est le sujet en
-- discussion -- utile pour situer une intervention sans avoir a deviner le
-- dossier legislatif concerne. L'arbre est recursif et de profondeur variable
-- (nivpoint observe de 1 a 5, plus les codes de procedure 99 et 100), meme
-- piege que `acte_legislatif` : le parcours doit etre recursif, jamais a
-- profondeur fixe.
CREATE TABLE officiel.debat_point (
    seance_uid         text     NOT NULL REFERENCES officiel.debat_seance(uid) ON DELETE CASCADE,
    id_syceron         text     NOT NULL,
    -- Pas de cle etrangere sur le parent : coherent avec acte_legislatif,
    -- l'ordre d'insertion d'un lot ne garantit pas que le parent precede.
    parent_id_syceron  text,
    type_conteneur     text     NOT NULL,    -- 'point' | 'ouvertureSeance' | 'finSeance'
    nivpoint           smallint,
    ordre_absolu_seance integer,
    intitule           text,
    lot_id             bigint   NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (seance_uid, id_syceron)
);

CREATE INDEX idx_debat_point_parent ON officiel.debat_point (seance_uid, parent_id_syceron);

-- Une intervention est un `paragraphe` du compte rendu : la plus petite unite
-- de parole ou de mention procedurale. `paragraphe` ne s'imbrique jamais dans
-- la source (verifie sur l'integralite du corpus XVIe, profondeur maximale 1) :
-- contrairement a `point`, c'est une feuille, ce qui simplifie le modele.
--
-- `id_syceron` est l'identifiant de la source et sert de cle primaire : verifie
-- unique sur les 337 041 paragraphes de la XVIe, tous fichiers confondus.
CREATE TABLE officiel.intervention (
    id_syceron          text     PRIMARY KEY,
    seance_uid           text    NOT NULL REFERENCES officiel.debat_seance(uid) ON DELETE CASCADE,
    -- Le point (ou ouvertureSeance/finSeance) qui contient directement cette
    -- intervention : c'est le sujet en discussion au moment ou elle a eu lieu.
    -- FK composite vers debat_point, qui partage la meme seance_uid : les
    -- points d'une seance sont toujours importes avant ses interventions.
    point_id_syceron      text,
    ordre_absolu_seance    integer,
    code_grammaire         text,   -- role structurel dans le CR : 'PAROLE_GENERIQUE', 'INTERRUPTION_1_10'...
    code_style             text,
    role_debat             text,  -- 'president' quand qui parle preside la seance
    -- L'acteur identifie par la source. NULL quand la source ne l'identifie
    -- pas elle-meme : 'PA0' ('Un depute du groupe LR', 3 680 occurrences) et
    -- les identifiants negatifs observes ('PA-121449'..., 684 occurrences) ne
    -- sont pas des acteurs, au meme titre que 'PO0' n'est pas un organe. Les
    -- recopier inventerait un faux depute identifie. Pas de cle etrangere :
    -- 13 des 656 acteurs distincts references dans les debats de la XVIe sont
    -- absents du jeu Acteurs (AMO20), gradient de qualite deja observe
    -- ailleurs (DATA_SOURCES).
    acteur_uid              text,
    mandat_uid              text,  -- id_mandat, NULL si source = '-1'
    texte                    text,
    lot_id                   bigint NOT NULL REFERENCES officiel.import_lot(id),
    lot_maj_id               bigint REFERENCES officiel.import_lot(id),
    FOREIGN KEY (seance_uid, point_id_syceron) REFERENCES officiel.debat_point(seance_uid, id_syceron)
);

CREATE INDEX idx_intervention_seance ON officiel.intervention (seance_uid, ordre_absolu_seance);
CREATE INDEX idx_intervention_acteur ON officiel.intervention (acteur_uid);
CREATE INDEX idx_intervention_point ON officiel.intervention (seance_uid, point_id_syceron);

-- La quasi-totalite des interventions ont un seul orateur, mais la source en
-- liste parfois deux, et meme trois, sur le meme paragraphe (0,18 % mesure
-- sur la XVIe, 600 interventions sur 337 041 : deputes s'exprimant en meme
-- temps lors d'une interruption). Une colonne unique sur `intervention`
-- perdrait ces cas en silence ; meme logique que `amendement_cosignataire`.
--
-- `nom` et `qualite` sont conserves tels quels : c'est le seul endroit ou le
-- libelle affiche par la source pour un orateur non identifie ('Un depute du
-- groupe LR', 'Plusieurs deputes du groupe RN') est disponible, et il ne se
-- deduit d'aucune autre table.
CREATE TABLE officiel.intervention_orateur (
    intervention_id_syceron text     NOT NULL REFERENCES officiel.intervention(id_syceron) ON DELETE CASCADE,
    ordre                   smallint NOT NULL,
    orateur_id_brut          text,   -- <id> de la source, pas toujours un acteur valide
    nom                       text,
    qualite                   text,
    lot_id                    bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (intervention_id_syceron, ordre)
);
