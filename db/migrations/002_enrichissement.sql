-- Schéma « enrichissement » : produit par calcul ou par IA à partir du schéma
-- officiel. Jamais écrit par les scripts d'import, jamais source de vérité.
-- Voir docs/DATA_MODEL.md section 1 et AGENTS.md section 5.
--
-- Toutes les tables de ce fichier référencent officiel.* par clé étrangère.
-- L'inverse n'existe pas : on peut vider et reconstruire tout ce schéma sans
-- toucher à un seul fait officiel.

CREATE SCHEMA IF NOT EXISTS enrichissement;

-- ---------------------------------------------------------------------------
-- Score d'importance publique (docs/SCORING.md)
-- ---------------------------------------------------------------------------
--
-- Les quatre sous-scores sont des colonnes distinctes, jamais fondues dans un
-- score_total tant que les quatre ne sont pas disponibles (docs/SCORING.md
-- section 1 et section 7). `mediatique` et `portee` restent NULL, pas 0, tant
-- qu'ils n'ont pas été calculés : un score à zéro laisserait croire à une
-- mesure d'absence, alors qu'on n'a rien mesuré.
--
-- `institutionnel` (docs/SCORING.md section 2) est calculable dès aujourd'hui
-- à partir du seul schéma officiel : aucune source externe. Le détail par
-- signal est conservé dans `institutionnel_detail` pour que la page
-- « Comment ça marche ? » puisse afficher la décomposition du barème, pas
-- seulement le total.
--
-- `intensite_parlementaire` (docs/SCORING.md section 4) n'est aujourd'hui
-- calculable que sur 3 composantes sur 5 (scrutins rattachés, séances, durée
-- du parcours) : les amendements et les interventions de débat manquent
-- encore au calcul, même quand la donnée brute existe déjà en base, tant que
-- la formule elle-même n'a pas été étendue et vérifiée (voir
-- docs/CLASSIFICATION.md). `intensite_parlementaire_partiel` porte cette
-- limite de façon lisible en base, pas seulement dans la documentation.
CREATE TABLE IF NOT EXISTS enrichissement.score_importance (
    dossier_uid                        text PRIMARY KEY
        REFERENCES officiel.dossier(uid),

    -- Institutionnel, 35 % (docs/SCORING.md section 2). Barème par points,
    -- plafonné à 100 après somme.
    institutionnel                     integer NOT NULL
        CHECK (institutionnel BETWEEN 0 AND 100),
    -- Détail des signaux ayant contribué, pour audit et affichage :
    -- {"vote_sur_ensemble": bool, "adopte_49_3": bool, "sps": bool,
    --  "loi_finances_ou_financement_secu": bool, "promulgue": bool,
    --  "saisine_cc": bool, "points_avant_plafond": int}
    institutionnel_detail              jsonb   NOT NULL,

    -- Intensité parlementaire, 20 % (docs/SCORING.md section 4). Moyenne de
    -- percentiles (0 à 100) calculés par année de dépôt du dossier, sur les
    -- seules composantes disponibles.
    intensite_parlementaire            numeric(6, 2),
    intensite_parlementaire_partiel    boolean NOT NULL DEFAULT true,
    -- Nombre de composantes entrant dans la moyenne, sur les 5 prévues par la
    -- spécification (docs/SCORING.md section 4). Vaut 3 tant que les
    -- amendements et les interventions de débat ne sont pas branchés au
    -- calcul.
    intensite_parlementaire_composantes smallint NOT NULL DEFAULT 0
        CHECK (intensite_parlementaire_composantes BETWEEN 0 AND 5),
    -- Valeurs brutes et percentiles par composante, pour audit :
    -- {"annee_depot": int, "nb_dossiers_annee": int,
    --  "nb_scrutins": {"brut": int, "percentile": num},
    --  "nb_seances": {"brut": int, "percentile": num},
    --  "duree_jours": {"brut": int, "percentile": num}}
    intensite_parlementaire_detail     jsonb,

    -- Médiatique, 35 % (docs/SCORING.md section 3). Reste NULL tant que GDELT
    -- n'a pas été testé : voir docs/SCORING.md section 3.4. Ne jamais peupler
    -- avec 0, ce qui affirmerait une absence de couverture mesurée.
    mediatique                         numeric(6, 2),

    -- Portée, 10 % (docs/SCORING.md section 5). Estimation IA par nature,
    -- jamais une mesure. Reste NULL tant qu'aucune estimation n'a été
    -- produite et tracée (justification, citation, modèle, date).
    portee                             numeric(6, 2),

    -- Total sur 100, calculé uniquement quand les quatre sous-scores sont
    -- renseignés (docs/SCORING.md section 1 et section 7). NULL sinon : ne
    -- jamais présenter un total partiel comme s'il couvrait les quatre
    -- dimensions.
    score_total                        numeric(6, 2)
        GENERATED ALWAYS AS (
            CASE
                WHEN mediatique IS NOT NULL AND portee IS NOT NULL
                     AND intensite_parlementaire IS NOT NULL THEN
                    round(
                        0.35 * institutionnel
                      + 0.35 * mediatique
                      + 0.20 * intensite_parlementaire
                      + 0.10 * portee
                    , 2)
                ELSE NULL
            END
        ) STORED,

    -- Traçabilité : version de la formule appliquée (renvoie à la version
    -- documentée de docs/SCORING.md) et date du calcul. Pas de lot d'import
    -- au sens officiel.import_lot : ce n'est pas une donnée importée d'une
    -- source externe, mais un calcul rejouable sur la base déjà chargée.
    version_formule                    text NOT NULL,
    calcule_le                         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_importance_institutionnel
    ON enrichissement.score_importance (institutionnel DESC);

COMMENT ON TABLE enrichissement.score_importance IS
    'Score d''importance publique (docs/SCORING.md). Un dossier sans '
    'mediatique ni portee n''a pas de score_total : afficher les sous-scores '
    'disponibles plutot que de calculer un total sur trois dimensions sur '
    'quatre.';

-- ---------------------------------------------------------------------------
-- Classification thématique (docs/SPECIFICATION.md section 8)
-- ---------------------------------------------------------------------------

-- Taxonomie stable, fixée par la spécification. Référentiel, pas une table
-- alimentée par l'import : les 23 lignes sont semées par cette migration.
CREATE TABLE IF NOT EXISTS enrichissement.theme (
    code    text PRIMARY KEY,
    libelle text NOT NULL,
    ordre   smallint NOT NULL
);

INSERT INTO enrichissement.theme (code, libelle, ordre) VALUES
    ('economie',            'Économie',                1),
    ('entreprises',         'Entreprises',              2),
    ('fiscalite',           'Fiscalité',                3),
    ('travail',             'Travail',                  4),
    ('retraites',           'Retraites',                5),
    ('pouvoir_achat',       'Pouvoir d''achat',         6),
    ('sante',               'Santé',                    7),
    ('protection_sociale',  'Protection sociale',       8),
    ('education',           'Éducation',                9),
    ('logement',            'Logement',                10),
    ('securite',            'Sécurité',                11),
    ('justice',             'Justice',                 12),
    ('immigration',         'Immigration',             13),
    ('environnement',       'Environnement',           14),
    ('energie',             'Énergie',                 15),
    ('agriculture',         'Agriculture',             16),
    ('transports',          'Transports',              17),
    ('numerique',           'Numérique',               18),
    ('libertes_publiques',  'Libertés publiques',      19),
    ('institutions',        'Institutions',            20),
    ('defense',             'Défense',                 21),
    ('international',       'International',           22),
    ('europe',              'Europe',                  23)
ON CONFLICT (code) DO NOTHING;

-- Un dossier peut porter plusieurs thèmes. L'IA (ou, à défaut, une
-- classification humaine documentée comme telle) peut suggérer les thèmes,
-- mais jamais sans score de confiance ni justification (spec section 8),
-- et jamais sans un pointeur vers le document source qui l'a motivée
-- (AGENTS.md section 5, règle 6 : « une affirmation sans citation vers une
-- source primaire ne se publie pas »).
CREATE TABLE IF NOT EXISTS enrichissement.dossier_theme (
    id                  bigserial PRIMARY KEY,
    dossier_uid         text NOT NULL REFERENCES officiel.dossier(uid),
    theme_code          text NOT NULL REFERENCES enrichissement.theme(code),
    score_confiance      numeric(3, 2) NOT NULL
        CHECK (score_confiance BETWEEN 0 AND 1),
    justification        text NOT NULL CHECK (length(justification) > 0),
    -- Citation vers le document source ayant servi à la classification.
    -- Nullable en base (un document peut manquer pour un cas limite), mais
    -- son absence doit être un choix documenté ligne par ligne, pas un
    -- défaut silencieux.
    citation_document_uid text REFERENCES officiel.document(uid),
    citation_extrait       text,
    -- 'humain' pour une classification manuelle assumée comme telle (voir
    -- docs/CLASSIFICATION.md), ou le nom du modèle IA utilisé.
    modele                  text NOT NULL,
    genere_le                timestamptz NOT NULL DEFAULT now(),
    -- Relecture humaine (spec section 8 : « possibilité de correction »).
    valide_par                text,
    UNIQUE (dossier_uid, theme_code)
);

CREATE INDEX IF NOT EXISTS idx_dossier_theme_dossier
    ON enrichissement.dossier_theme (dossier_uid);
CREATE INDEX IF NOT EXISTS idx_dossier_theme_theme
    ON enrichissement.dossier_theme (theme_code);

COMMENT ON TABLE enrichissement.dossier_theme IS
    'Classification thematique d''un dossier (spec section 8). Score de '
    'confiance et justification obligatoires par ligne. modele = ''humain'' '
    'signale une classification manuelle, a distinguer d''une suggestion IA.';
