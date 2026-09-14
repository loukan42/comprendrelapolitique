-- ---------------------------------------------------------------------------
-- Placement gauche-droite des groupes parlementaires
-- ---------------------------------------------------------------------------
--
-- Un hemicycle se lit de gauche a droite : c'est meme tout ce qu'il apporte
-- par rapport a un tableau de chiffres. Un dessin qui range les groupes par
-- effectif decroissant, comme le faisait la premiere version, invite a une
-- lecture politique fausse, du type « la droite a vote contre » alors que la
-- couleur ne dit que le sens du vote.
--
-- Cette table existe parce que la source ne publie pas cet ordre.
-- `officiel.organe.position_politique` dit « Majoritaire », « Opposition » ou
-- « Minoritaire », c'est-a-dire le rapport au gouvernement et non l'axe
-- gauche-droite, et il est vide pour toute la XVIIe legislature.
--
-- Le placement est donc une affirmation editoriale, pas une donnee. Elle est
-- isolee ici, avec sa justification ligne par ligne, plutot que dispersee
-- dans le code d'affichage : c'est le genre de choix qui doit pouvoir etre
-- conteste sans lire un composant React.
--
-- `rang` n'a pas d'unite et ne mesure rien : seul l'ordre compte. Les
-- intervalles laisses libres permettent d'inserer un groupe sans renumeroter.

CREATE TABLE enrichissement.groupe_ordre (
    organe_uid text PRIMARY KEY,   -- officiel.organe, code_type = 'GP'
    rang       integer NOT NULL,
    -- Pourquoi ce placement. Obligatoire.
    motif      text NOT NULL
);

CREATE INDEX idx_groupe_ordre_rang ON enrichissement.groupe_ordre (rang);
