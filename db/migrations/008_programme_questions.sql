-- ---------------------------------------------------------------------------
-- Questions du QCM des programmes
-- ---------------------------------------------------------------------------
--
-- Un theme ne suffit pas a construire une question. Sous « travail », une
-- formation propose de refondre le code du travail et une autre de relever
-- le SMIC : les mettre en face l'une de l'autre dans un QCM ferait choisir
-- entre deux sujets, pas entre deux reponses a la meme question.
--
-- Une question regroupe donc des citations qui repondent au meme sujet. Le
-- comparateur continue de lire le theme ; le QCM lit la question. Une
-- citation sans question reste visible dans le comparateur et n'entre pas
-- dans le QCM.
--
-- Idempotente : `positions_programme.ts` l'applique sur une base qui a deja
-- la migration 006, et doit pouvoir la rejouer sans erreur.

CREATE TABLE IF NOT EXISTS enrichissement.programme_question (
    id        text PRIMARY KEY,
    theme     text NOT NULL,
    -- Formulation neutre, qui ne laisse deviner aucune des reponses.
    intitule  text NOT NULL,
    ordre     integer NOT NULL
);

ALTER TABLE enrichissement.programme_position
    ADD COLUMN IF NOT EXISTS question_id text
        REFERENCES enrichissement.programme_question(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programme_position_question
    ON enrichissement.programme_position (question_id);

-- Repere affiche sous la question pour comprendre les reponses : l'etat du
-- droit, le sens d'un sigle. Factuel, jamais un argument, et toujours avec
-- l'adresse de sa source officielle.
ALTER TABLE enrichissement.programme_question ADD COLUMN IF NOT EXISTS contexte text;
ALTER TABLE enrichissement.programme_question ADD COLUMN IF NOT EXISTS source_contexte text;

-- Axe du comparateur : les deux poles d'une question, formules sans
-- jugement, et la place de chaque citation entre eux, de -2 a +2. C'est une
-- lecture editoriale du site, ecrite dans positions_programme.ts et affichee
-- a cote de la citation qu'elle resume.
ALTER TABLE enrichissement.programme_question ADD COLUMN IF NOT EXISTS axe_moins text;
ALTER TABLE enrichissement.programme_question ADD COLUMN IF NOT EXISTS axe_plus text;
ALTER TABLE enrichissement.programme_position ADD COLUMN IF NOT EXISTS echelle smallint
    CHECK (echelle BETWEEN -2 AND 2);
