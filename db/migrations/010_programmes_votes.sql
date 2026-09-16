-- Rapprochements éditoriaux, séparés des votes officiels.
CREATE TABLE IF NOT EXISTS enrichissement.programme_vote (
    id text PRIMARY KEY,
    position_id text NOT NULL REFERENCES enrichissement.programme_position(id),
    scrutin_uid text NOT NULL REFERENCES officiel.scrutin(uid),
    parti_uid text NOT NULL REFERENCES officiel.organe(uid),
    constat text NOT NULL CHECK (constat IN ('ecart', 'convergence', 'nuance')),
    explication text NOT NULL CHECK (length(trim(explication)) > 0),
    limites text NOT NULL CHECK (length(trim(limites)) > 0),
    source_texte text NOT NULL CHECK (source_texte ~ '^https://'),
    source_perimetre text NOT NULL CHECK (source_perimetre ~ '^https://'),
    perimetre text NOT NULL CHECK (length(trim(perimetre)) > 0),
    verifie_le date NOT NULL,
    valide_par text NOT NULL CHECK (length(trim(valide_par)) > 0),
    publie boolean NOT NULL DEFAULT false,
    UNIQUE(position_id, scrutin_uid, parti_uid)
);

COMMENT ON TABLE enrichissement.programme_vote IS
'Chaque rapprochement requiert une lecture du texte et une vérification du périmètre de groupe parlementaire. Les compteurs affichés viennent de scrutin_groupe, jamais d’une position déduite.';
