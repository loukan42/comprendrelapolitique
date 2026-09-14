-- ---------------------------------------------------------------------------
-- Bilan des engagements presidentiels
-- ---------------------------------------------------------------------------
--
-- Repond a une seule question, et pas a une autre : la mesure annoncee a-t-elle
-- ete mise en oeuvre ? Ni son efficacite, ni son opportunite politique ne sont
-- evaluees ici. Une reforme peut etre realisee et ses resultats contestes ;
-- une politique peut produire des resultats sans avoir ete promise.
--
-- Structure generique des le depart : rien n'est propre a un president. La
-- meme table servira pour un autre mandat ou un autre pays si besoin.
--
-- Aucune ligne n'est ecrite sans source. Un engagement sans extrait de
-- programme et une evaluation sans piece justificative n'ont pas leur place :
-- c'est ce que les contraintes NOT NULL ci-dessous imposent, plutot que de
-- s'en remettre a la discipline de celui qui saisit.

CREATE TABLE enrichissement.president (
    id          text PRIMARY KEY,        -- 'emmanuel-macron'
    nom         text NOT NULL,
    prenom      text NOT NULL
);

CREATE TABLE enrichissement.mandat_presidentiel (
    id           text PRIMARY KEY,       -- 'macron-2017-2022'
    president_id text NOT NULL REFERENCES enrichissement.president(id) ON DELETE CASCADE,
    libelle      text NOT NULL,          -- '2017-2022'
    date_debut   date NOT NULL,
    date_fin     date,                   -- NULL = mandat en cours
    -- Programme de campagne dont les engagements sont tires. Un engagement ne
    -- peut venir que de la : une declaration en cours de mandat, une
    -- interview ou une phrase prononcee ailleurs n'est pas un engagement de
    -- campagne, et l'y verser fausserait le bilan.
    programme_titre text NOT NULL,
    programme_url   text NOT NULL,
    programme_date  date
);

-- Statuts. Le choix de six valeurs plutot que deux est ce qui rend le bilan
-- honnete : « fait / pas fait » force a trancher des situations qui ne se
-- tranchent pas, et l'arbitraire se loge la.
CREATE TYPE enrichissement.statut_engagement AS ENUM (
    'realise',              -- mis en oeuvre dans des conditions correspondant a l'engagement
    'partiellement',        -- une partie significative, pas l'integralite
    'en_cours',             -- lance officiellement, mise en oeuvre non terminee
    'non_realise',          -- delai depasse ou mandat termine sans mise en oeuvre
    'abandonne',            -- abandon explicite annonce
    'inevaluable'           -- trop vague ou qualitatif pour etre tranche objectivement
);

-- Solidite des elements disponibles pour etablir le statut. Distincte du
-- statut : on peut etre sur qu'une mesure n'a pas ete prise.
CREATE TYPE enrichissement.confiance_evaluation AS ENUM ('haute', 'moyenne', 'basse');

CREATE TABLE enrichissement.engagement (
    id            text PRIMARY KEY,      -- '2017-education-01'
    mandat_id     text NOT NULL REFERENCES enrichissement.mandat_presidentiel(id) ON DELETE CASCADE,
    theme         text NOT NULL,
    titre         text NOT NULL,
    -- Extrait fidele du programme. Obligatoire : c'est ce qui distingue un
    -- engagement d'une intention qu'on prete au candidat.
    extrait_programme text NOT NULL,
    -- Reformulation courte, comprehensible sans connaissance prealable.
    reformulation     text NOT NULL,
    page_programme    text,

    statut     enrichissement.statut_engagement NOT NULL,
    confiance  enrichissement.confiance_evaluation NOT NULL,

    -- Ce qui a ete fait, puis ce qui a ete obtenu. Les deux sont separes
    -- exprès : une loi votee permettant de creer 10 000 postes n'est pas
    -- 10 000 postes crees, et confondre le moyen et le resultat est la faute
    -- la plus frequente de ce type d'exercice.
    action_menee text,
    resultat     text,

    -- Deux ou trois phrases disant pourquoi ce statut a ete retenu.
    justification text NOT NULL,
    -- Quand plusieurs lectures de l'engagement sont defendables, elles sont
    -- exposees ici plutot que tranchees en silence.
    interpretations text,

    verifie_le date NOT NULL
);

CREATE INDEX idx_engagement_mandat ON enrichissement.engagement (mandat_id);
CREATE INDEX idx_engagement_statut ON enrichissement.engagement (statut);
CREATE INDEX idx_engagement_theme ON enrichissement.engagement (theme);

-- Chronologie des actes : lois, decrets, decisions. Une date et une source.
CREATE TABLE enrichissement.engagement_action (
    id            bigserial PRIMARY KEY,
    engagement_id text NOT NULL REFERENCES enrichissement.engagement(id) ON DELETE CASCADE,
    date_action   date NOT NULL,
    description   text NOT NULL,
    url           text
);

CREATE INDEX idx_engagement_action_engagement
    ON enrichissement.engagement_action (engagement_id, date_action);

-- « Ne nous croyez pas sur parole : verifiez. » Chaque affirmation porte sa
-- source, et la source institutionnelle prime sur la presse quand elle existe.
CREATE TABLE enrichissement.engagement_source (
    id            bigserial PRIMARY KEY,
    engagement_id text NOT NULL REFERENCES enrichissement.engagement(id) ON DELETE CASCADE,
    titre         text NOT NULL,
    organisme     text NOT NULL,         -- Legifrance, INSEE, Assemblee nationale...
    url           text NOT NULL,
    date_source   date,
    -- true pour une source institutionnelle ou primaire, false pour la presse.
    institutionnelle boolean NOT NULL DEFAULT true,
    verifie_le    timestamptz
);

CREATE INDEX idx_engagement_source_engagement
    ON enrichissement.engagement_source (engagement_id);

-- ---------------------------------------------------------------------------
-- Mesures importantes absentes du programme
-- ---------------------------------------------------------------------------
--
-- Table separee, et non un statut de plus sur `engagement`, pour une raison de
-- fond : une reforme realisee mais non promise ne compense pas une promesse
-- non tenue. Les melanger dans le meme decompte ferait exactement cela.
CREATE TABLE enrichissement.action_hors_programme (
    id          text PRIMARY KEY,
    mandat_id   text NOT NULL REFERENCES enrichissement.mandat_presidentiel(id) ON DELETE CASCADE,
    theme       text NOT NULL,
    titre       text NOT NULL,
    date_mesure date,
    contexte    text NOT NULL,
    decision    text NOT NULL,
    verifie_le  date NOT NULL
);

CREATE TABLE enrichissement.action_hors_programme_source (
    id        bigserial PRIMARY KEY,
    action_id text NOT NULL REFERENCES enrichissement.action_hors_programme(id) ON DELETE CASCADE,
    titre     text NOT NULL,
    organisme text NOT NULL,
    url       text NOT NULL,
    date_source date
);
