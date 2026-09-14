-- ---------------------------------------------------------------------------
-- Natures de document ajoutees en septembre 2026
-- ---------------------------------------------------------------------------
--
-- Les candidats publient leur programme de campagne pour 2027 au fil de la
-- campagne. Pour ceux qui ne l'ont pas encore fait, le document cite est le
-- plus recent de leur formation, et il faut pouvoir dire lequel : un
-- programme presidentiel de 2022 reste en ligne, un parti publie des
-- propositions thematiques, un candidat signe une tribune. Aucune de ces
-- natures ne se confond avec un programme 2027.
--
-- Idempotente : `programmes.ts` et `positions_programme.ts` la rejouent a
-- chaque passage.

ALTER TYPE enrichissement.nature_programme ADD VALUE IF NOT EXISTS 'presidentiel_2022';
ALTER TYPE enrichissement.nature_programme ADD VALUE IF NOT EXISTS 'programme_parti';
ALTER TYPE enrichissement.nature_programme ADD VALUE IF NOT EXISTS 'prise_de_position';
