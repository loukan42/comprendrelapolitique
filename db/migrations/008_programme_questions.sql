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
