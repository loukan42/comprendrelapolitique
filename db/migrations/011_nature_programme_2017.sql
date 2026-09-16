-- Archives de la présidentielle 2017
-- La valeur est distincte des programmes 2022 et 2027 pour éviter de mélanger
-- les périodes dans le comparateur.
ALTER TYPE enrichissement.nature_programme
  ADD VALUE IF NOT EXISTS 'presidentiel_2017';
