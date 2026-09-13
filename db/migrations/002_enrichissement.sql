-- ---------------------------------------------------------------------------
-- Schema `enrichissement`
-- ---------------------------------------------------------------------------
--
-- Tout ce qui n'est pas publie tel quel par la source vit ici, jamais dans
-- `officiel` (AGENTS.md section 5, regle 6). La separation est physique pour
-- qu'aucune donnee redigee ou calculee ne puisse se faire passer pour une
-- donnee officielle.
--
-- Ce schema est reconstructible : il ne contient aucune verite propre que
-- l'on ne puisse rejouer depuis `officiel` plus les fichiers de reference du
-- depot.

CREATE SCHEMA IF NOT EXISTS enrichissement;

-- ---------------------------------------------------------------------------
-- Formations politiques
-- ---------------------------------------------------------------------------
--
-- Pourquoi cette table existe : un groupe parlementaire ne survit pas a une
-- legislature. « Les Republicains » de la XVIe et « Droite Republicaine » de
-- la XVIIe sont deux organes distincts, avec deux `organe_uid`, et la source
-- ne publie aucun lien entre eux. Un classement couvrant trois legislatures
-- affiche donc la meme famille politique plusieurs fois sous des noms
-- differents, ce qui est illisible.
--
-- Ce que cette table n'est pas : un parti. Un parti est une personne morale
-- avec ses adherents et ses statuts ; une formation est ici la continuite
-- d'une famille politique a l'Assemblee, telle qu'elle se lit dans les
-- groupes successifs. Le mot est different parce que la chose l'est.

CREATE TABLE enrichissement.formation (
    id            text PRIMARY KEY,       -- 'lr', 'lfi', 'rn'
    libelle       text NOT NULL,
    libelle_court text,
    -- Ordre d'affichage stable, pour ne pas dependre d'un tri par effectif
    -- qui changerait le classement a chaque scrutin.
    rang          smallint
);

-- Correspondance formation <-> groupe parlementaire.
--
-- Chaque ligne est une affirmation sur des formations reelles : elle porte
-- donc sa justification. `preuve` cite ce qui la fonde, en pratique la
-- repartition des mandats de parti (`officiel.mandat`, type_organe =
-- 'PARPOL') declares par les membres du groupe, que le script de peuplement
-- reimprime a la demande.
--
-- Un groupe dont le rattachement est discutable n'est pas rattache : il
-- s'affiche sous son propre nom. C'est le cas des groupes charnieres et des
-- groupes sans parti dominant.
CREATE TABLE enrichissement.formation_groupe (
    formation_id text NOT NULL REFERENCES enrichissement.formation(id) ON DELETE CASCADE,
    organe_uid   text NOT NULL,           -- officiel.organe, code_type = 'GP'
    preuve       text NOT NULL,
    PRIMARY KEY (organe_uid)              -- un groupe appartient a une seule formation
);

CREATE INDEX idx_formation_groupe_formation ON enrichissement.formation_groupe (formation_id);
