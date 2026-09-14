-- Schéma « officiel » : données importées de sources publiques.
-- Rien de ce qui est produit par IA n'écrit ici. Voir docs/DATA_MODEL.md.

CREATE SCHEMA IF NOT EXISTS officiel;

-- ---------------------------------------------------------------------------
-- Traçabilité
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS officiel.import_lot (
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

CREATE INDEX IF NOT EXISTS idx_lot_jeu ON officiel.import_lot (jeu, legislature, demarre_le DESC);

-- ---------------------------------------------------------------------------
-- Référentiel
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS officiel.legislature (
    id          smallint PRIMARY KEY,
    institution text     NOT NULL DEFAULT 'AN',
    date_debut  date     NOT NULL,
    date_fin    date,
    archivee    boolean  NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS officiel.organe (
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
CREATE INDEX IF NOT EXISTS idx_organe_type ON officiel.organe (code_type);
CREATE INDEX IF NOT EXISTS idx_organe_parent ON officiel.organe (organe_parent);

CREATE TABLE IF NOT EXISTS officiel.acteur (
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

CREATE INDEX IF NOT EXISTS idx_acteur_nom ON officiel.acteur (nom, prenom);

CREATE TABLE IF NOT EXISTS officiel.mandat (
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

CREATE INDEX IF NOT EXISTS idx_mandat_acteur ON officiel.mandat (acteur_uid, type_organe);
CREATE INDEX IF NOT EXISTS idx_mandat_organe ON officiel.mandat (organe_uid);

-- ---------------------------------------------------------------------------
-- Dossiers, documents, actes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS officiel.dossier (
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

CREATE TABLE IF NOT EXISTS officiel.document (
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

CREATE INDEX IF NOT EXISTS idx_document_dossier ON officiel.document (dossier_uid);
CREATE INDEX IF NOT EXISTS idx_document_cle_titre ON officiel.document (cle_titre);

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
CREATE TABLE IF NOT EXISTS officiel.acte_legislatif (
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

CREATE INDEX IF NOT EXISTS idx_acte_uid ON officiel.acte_legislatif (uid);
CREATE INDEX IF NOT EXISTS idx_acte_dossier_date ON officiel.acte_legislatif (dossier_uid, date_acte);
CREATE INDEX IF NOT EXISTS idx_acte_code ON officiel.acte_legislatif (code_acte);

-- Références de vote portées par les actes. C'est le lien officiel
-- scrutin -> dossier, et il est faux dans 2 cas sur 556 (DATA_SOURCES 4.3).
CREATE TABLE IF NOT EXISTS officiel.acte_vote_ref (
    -- Pas de cle etrangere : un uid d'acte n'est plus unique, il peut decrire
    -- le meme evenement dans plusieurs dossiers.
    acte_uid    text NOT NULL,
    scrutin_uid text NOT NULL,
    PRIMARY KEY (acte_uid, scrutin_uid)
);

CREATE INDEX IF NOT EXISTS idx_acte_vote_scrutin ON officiel.acte_vote_ref (scrutin_uid);

-- ---------------------------------------------------------------------------
-- Scrutins et votes
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE officiel.position_vote AS ENUM ('POUR', 'CONTRE', 'ABSTENTION', 'NON_VOTANT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS officiel.scrutin (
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

CREATE INDEX IF NOT EXISTS idx_scrutin_date ON officiel.scrutin (legislature, date_scrutin);
CREATE INDEX IF NOT EXISTS idx_scrutin_type ON officiel.scrutin (type_vote_code);
CREATE INDEX IF NOT EXISTS idx_scrutin_ensemble ON officiel.scrutin (est_vote_sur_ensemble)
    WHERE est_vote_sur_ensemble;
CREATE INDEX IF NOT EXISTS idx_scrutin_cle_titre ON officiel.scrutin (cle_titre);

-- La cle est (scrutin, ordre) et non (scrutin, organe), parce que l'organe peut
-- manquer : 14 scrutins de la XVIIe listent leurs 12 groupes avec un organeRef
-- factice 'PO0' pour tous. Les effectifs montrent qu'il s'agit bien de groupes
-- distincts -- 124, 93, 71, 66... -- mais la source n'a pas renseigne lesquels.
-- Les cleffer sur l'organe ecraserait 11 blocs sur 12 et attribuerait tous ces
-- votes a un meme faux groupe.
CREATE TABLE IF NOT EXISTS officiel.scrutin_groupe (
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

CREATE INDEX IF NOT EXISTS idx_scrutin_groupe_organe ON officiel.scrutin_groupe (organe_uid);

CREATE TABLE IF NOT EXISTS officiel.vote (
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

CREATE INDEX IF NOT EXISTS idx_vote_acteur ON officiel.vote (acteur_uid);
CREATE INDEX IF NOT EXISTS idx_vote_groupe ON officiel.vote (organe_uid, position);

-- ---------------------------------------------------------------------------
-- Rattachement scrutin <-> dossier
-- ---------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE officiel.methode_rattachement AS ENUM ('OFFICIEL', 'RECONSTRUIT', 'CONFLIT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS officiel.scrutin_dossier (
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

CREATE INDEX IF NOT EXISTS idx_scrutin_dossier_dossier ON officiel.scrutin_dossier (dossier_uid);
CREATE INDEX IF NOT EXISTS idx_scrutin_dossier_methode ON officiel.scrutin_dossier (methode);

-- ---------------------------------------------------------------------------
-- Vues de lecture
-- ---------------------------------------------------------------------------

-- Un engagement de responsabilité (49.3) se reconnaît au code d'acte AN21,
-- jamais au titre : la convention de titrage a changé entre législatures.
CREATE OR REPLACE VIEW officiel.dossier_49_3 AS
SELECT DISTINCT dossier_uid
FROM officiel.acte_legislatif
WHERE code_acte LIKE 'AN21%';

-- Deux dossiers qui partagent un acte decrivent le meme evenement sous deux
-- angles. C'est ce partage qui relie un texte au dossier « Engagement de la
-- responsabilite du Gouvernement » qui l'a fait adopter sans vote : le lien
-- n'est ecrit nulle part ailleurs dans la source.
CREATE OR REPLACE VIEW officiel.dossier_lie_par_acte AS
SELECT DISTINCT a.dossier_uid, b.dossier_uid AS dossier_lie_uid
FROM officiel.acte_legislatif a
JOIN officiel.acte_legislatif b ON b.uid = a.uid AND b.dossier_uid <> a.dossier_uid;

-- Un texte adopte sans vote : il partage un acte avec un dossier d'engagement
-- de responsabilite, sans porter lui-meme de code AN21.
CREATE OR REPLACE VIEW officiel.dossier_adopte_sans_vote AS
SELECT DISTINCT l.dossier_uid
FROM officiel.dossier_lie_par_acte l
JOIN officiel.dossier_49_3 e ON e.dossier_uid = l.dossier_lie_uid
WHERE l.dossier_uid NOT IN (SELECT dossier_uid FROM officiel.dossier_49_3);

-- Scrutins dont la repartition par groupe est inexploitable : la source n'a
-- identifie aucun des groupes. Le produit doit le dire au lieu d'afficher une
-- ventilation fausse.
CREATE OR REPLACE VIEW officiel.scrutin_groupe_non_identifie AS
SELECT DISTINCT scrutin_uid
FROM officiel.scrutin_groupe
WHERE organe_uid IS NULL;

-- Les motions de censure n'enregistrent que les votes POUR : les afficher avec
-- un gabarit POUR/CONTRE/ABSTENTION produit un « 0 contre » trompeur.
CREATE OR REPLACE VIEW officiel.motion_de_censure AS
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
CREATE TABLE IF NOT EXISTS officiel.amendement (
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

CREATE INDEX IF NOT EXISTS idx_amendement_dossier ON officiel.amendement (dossier_uid);
CREATE INDEX IF NOT EXISTS idx_amendement_document ON officiel.amendement (document_uid);
CREATE INDEX IF NOT EXISTS idx_amendement_auteur ON officiel.amendement (auteur_acteur_uid);
CREATE INDEX IF NOT EXISTS idx_amendement_sort ON officiel.amendement (sort_brut);
CREATE INDEX IF NOT EXISTS idx_amendement_etat ON officiel.amendement (etat_code);

-- Cosignataires. Cle etrangere vers l'amendement seulement : l'acteur peut
-- manquer du jeu Acteurs (3 681 cas sur 3 148 274 references, 0,12 % --
-- probablement des deputes sortis de mandat avant l'instantane AMO20).
-- L'absence d'un depute de ce jeu ne doit pas faire echouer l'import d'un
-- amendement.
CREATE TABLE IF NOT EXISTS officiel.amendement_cosignataire (
    amendement_uid text NOT NULL REFERENCES officiel.amendement(uid) ON DELETE CASCADE,
    acteur_uid     text NOT NULL,
    lot_id         bigint NOT NULL REFERENCES officiel.import_lot(id),
    PRIMARY KEY (amendement_uid, acteur_uid)
);

CREATE INDEX IF NOT EXISTS idx_amendement_cosignataire_acteur ON officiel.amendement_cosignataire (acteur_uid);

-- Amendements dont la decision de fond est connue : exclut les amendements
-- irrecevables, retires avant publication ou jamais discutes.
CREATE OR REPLACE VIEW officiel.amendement_discute AS
SELECT * FROM officiel.amendement WHERE sort_brut IS NOT NULL;
