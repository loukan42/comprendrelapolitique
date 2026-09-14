-- ---------------------------------------------------------------------------
-- Banque de questions du quiz
-- ---------------------------------------------------------------------------
--
-- Conception detaillee dans docs/QUIZ_ENGINE.md section 3.
--
-- Une question de quiz represente une POSITION POLITIQUE, pas un scrutin. Elle
-- s'appuie sur plusieurs scrutins, chacun avec le SENS dans lequel il repond a
-- la question. Le modele precedent, une question pour un scrutin, ne permettait
-- ni de couvrir un sujet traite en plusieurs textes, ni d'utiliser les 16 500
-- scrutins qui ne sont pas des votes sur l'ensemble.
--
-- La session de quiz n'est PAS ici, et ne le sera pas : une reponse est une
-- opinion politique, donnee sensible au sens de l'article 9 du RGPD
-- (docs/QUIZ_METHODOLOGY.md section 1). Elle ne quitte pas le navigateur. Ce
-- schema ne porte que des donnees publiques : les questions, les scrutins
-- qu'elles retiennent, et les positions calculees des formations.

-- ---------------------------------------------------------------------------
-- Parametres du calcul, versionnes
-- ---------------------------------------------------------------------------
--
-- Aucun parametre du scoring n'est ecrit en dur dans le code. Un jeu de
-- parametres n'est jamais modifie : on en cree un nouveau et on bascule
-- `actif`, pour qu'un resultat publie reste rattachable aux parametres qui
-- l'ont produit.
CREATE TABLE enrichissement.parametres_scoring (
    id                      serial PRIMARY KEY,
    -- Demi-vie de la decote temporelle. 48 mois = un vote de la legislature
    -- precedente pese environ la moitie d'un vote recent.
    demi_vie_mois           integer NOT NULL CHECK (demi_vie_mois > 0),
    -- En deca, la position d'une formation n'est pas publiee : elle est
    -- marquee « donnees insuffisantes », jamais remplacee par 0, qui se
    -- lirait comme une neutralite mesuree.
    min_scrutins            integer NOT NULL CHECK (min_scrutins > 0),
    min_votes               integer NOT NULL CHECK (min_votes > 0),
    -- Seuils d'affichage du niveau de confiance.
    seuil_confiance_haute   numeric(3,2) NOT NULL CHECK (seuil_confiance_haute BETWEEN 0 AND 1),
    seuil_confiance_moyenne numeric(3,2) NOT NULL CHECK (seuil_confiance_moyenne BETWEEN 0 AND 1),
    -- Poids applique aux questions dont l'utilisateur declare le sujet
    -- important pour lui.
    poids_sujet_important   numeric(3,2) NOT NULL CHECK (poids_sujet_important >= 1),
    actif                   boolean NOT NULL DEFAULT false,
    note                    text NOT NULL,
    cree_le                 timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT seuils_ordonnes CHECK (seuil_confiance_haute > seuil_confiance_moyenne)
);

-- Un seul jeu actif a la fois.
CREATE UNIQUE INDEX idx_parametres_actif ON enrichissement.parametres_scoring (actif)
    WHERE actif;

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------

CREATE TABLE enrichissement.question (
    id              text PRIMARY KEY,
    -- La question posee, comprehensible sans connaissance prealable et sans
    -- nommer de parti, de candidat ni d'orientation (« de gauche », « liberal »).
    intitule        text NOT NULL,
    -- Complement facultatif, derriere un « en savoir plus » : repondre doit
    -- rester possible sans le lire.
    description     text,
    theme           text NOT NULL,
    sous_theme      text,
    -- Inactive tant qu'elle n'a pas ete relue. Le defaut protege contre la
    -- publication d'une question dont le rattachement aux scrutins n'a pas
    -- ete verifie.
    actif           boolean NOT NULL DEFAULT false,
    -- Pourquoi ces scrutins, et pas d'autres. Le choix des scrutins determine
    -- le resultat : il doit rester relisible.
    note_editoriale text,
    cree_le         timestamptz NOT NULL DEFAULT now(),
    maj_le          timestamptz
);

CREATE INDEX idx_question_theme ON enrichissement.question (theme) WHERE actif;

-- ---------------------------------------------------------------------------
-- Scrutins retenus par une question
-- ---------------------------------------------------------------------------

CREATE TABLE enrichissement.question_scrutin (
    question_id   text NOT NULL REFERENCES enrichissement.question(id) ON DELETE CASCADE,
    scrutin_uid   text NOT NULL REFERENCES officiel.scrutin(uid),
    -- +1 : voter POUR ce scrutin va dans le sens de la question.
    -- -1 : voter CONTRE ce scrutin va dans le sens de la question.
    --
    -- Jamais deduit. Sur un texte qui BAISSAIT la fiscalite, voter CONTRE est
    -- la position favorable a la question « faut-il davantage taxer les hauts
    -- revenus ». Aucune regle automatique ne peut le deviner, et se tromper
    -- inverse la position d'un groupe.
    sens          smallint NOT NULL CHECK (sens IN (-1, 1)),
    poids         numeric(4,2) NOT NULL DEFAULT 1 CHECK (poids > 0),
    -- Pourquoi ce scrutin represente cette question. Obligatoire.
    justification text NOT NULL,
    PRIMARY KEY (question_id, scrutin_uid)
);

CREATE INDEX idx_question_scrutin_scrutin ON enrichissement.question_scrutin (scrutin_uid);

-- ---------------------------------------------------------------------------
-- Positions calculees
-- ---------------------------------------------------------------------------
--
-- Table de cache : entierement recalculable depuis `officiel` plus les deux
-- tables ci-dessus. Elle ne porte aucune verite propre.
CREATE TABLE enrichissement.question_position (
    question_id   text NOT NULL REFERENCES enrichissement.question(id) ON DELETE CASCADE,
    formation_id  text NOT NULL REFERENCES enrichissement.formation(id) ON DELETE CASCADE,
    -- -1 totalement oppose, 0 partage ou sans position, +1 totalement favorable.
    position      numeric(4,3) NOT NULL CHECK (position BETWEEN -1 AND 1),
    -- Produit des trois composantes ci-dessous, conservees separement pour
    -- qu'un lecteur puisse voir laquelle fait baisser la confiance.
    confiance     numeric(4,3) NOT NULL CHECK (confiance BETWEEN 0 AND 1),
    couverture    numeric(4,3) NOT NULL,
    cohesion      numeric(4,3) NOT NULL,
    constance     numeric(4,3) NOT NULL,
    n_scrutins    integer NOT NULL,
    n_votes       integer NOT NULL,
    parametres_id integer NOT NULL REFERENCES enrichissement.parametres_scoring(id),
    calcule_le    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (question_id, formation_id)
);
