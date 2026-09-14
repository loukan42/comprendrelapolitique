-- ---------------------------------------------------------------------------
-- Programmes politiques publies
-- ---------------------------------------------------------------------------
--
-- Ce que cette table contient : des REFERENCES vers des documents publies par
-- les partis eux-memes, jamais leur contenu. Un programme est une oeuvre
-- protegee : on peut y renvoyer, en citer des extraits courts avec leur
-- source, pas le recopier.
--
-- Ce qu'elle ne contient pas : de position resumee. Attribuer a un parti une
-- proposition reformulee, a partir d'un resume ecrit par un tiers, revient a
-- lui faire dire ce qu'il n'a pas ecrit. Les extraits cites viendront dans
-- `programme_position`, chacun avec sa citation exacte et son ancrage dans le
-- document (table a creer quand le comparateur sera construit).
--
-- La `nature` est obligatoire et c'est le champ qui evite le contresens le
-- plus probable : plusieurs partis n'ont pas de programme presidentiel 2027 a
-- ce jour, et ce qu'ils publient est un programme legislatif de 2024 ou un
-- projet en cours d'ecriture. Les presenter comme des programmes 2027 serait
-- faux.

CREATE TYPE enrichissement.nature_programme AS ENUM (
    'presidentiel_2027',   -- programme pour l'election presidentielle de 2027
    'legislatif_2024',     -- programme des legislatives de 2024
    'europeen_2024',       -- programme des europeennes de 2024
    'projet_en_cours',     -- projet du parti, en cours d'ecriture ou permanent
    'aucun'                -- rien de publie a ce jour : l'absence est une information
);

CREATE TABLE enrichissement.programme (
    id           text PRIMARY KEY,
    -- Formation politique. Texte libre et non une cle vers
    -- `enrichissement.formation` : plusieurs partis publiant un programme
    -- n'ont aucun groupe a l'Assemblee, et l'inverse existe aussi.
    formation    text NOT NULL,
    -- Personne mise en avant par cette formation, quand il y en a une.
    candidat     text,
    titre        text,
    nature       enrichissement.nature_programme NOT NULL,
    -- Date de publication du document, quand elle est connue.
    date_publication date,
    url          text,
    -- Date du dernier controle d'accessibilite de l'URL. Un lien mort sur une
    -- page qui pretend documenter est pire que pas de lien.
    verifie_le   timestamptz,
    note         text
);

CREATE INDEX idx_programme_formation ON enrichissement.programme (formation);

-- ---------------------------------------------------------------------------
-- Positions tirees d'un programme
-- ---------------------------------------------------------------------------
--
-- Une seule table sert les deux usages, parce qu'ils demandent exactement la
-- meme chose : un comparateur affiche cote a cote les positions de deux
-- formations sur un theme, un QCM affiche les positions de plusieurs
-- formations sur un theme en masquant leur origine. Les separer ferait
-- diverger deux corpus qui doivent rester identiques.
--
-- `extrait` est une CITATION, reprise mot pour mot du document. Jamais une
-- reformulation : resumer la position d'un parti puis l'afficher comme sienne
-- revient a lui faire dire ce qu'il n'a pas ecrit, et c'est la faute la plus
-- couteuse sur un site politique. `page_ou_section` et l'URL du programme
-- permettent de retrouver le passage et de contester la selection.
--
-- `resume_affichage` existe parce qu'une citation brute est parfois trop
-- longue pour une case de QCM. Quand il est renseigne, l'interface doit
-- afficher la citation a cote, jamais le resume seul.
CREATE TABLE enrichissement.programme_position (
    id             text PRIMARY KEY,
    programme_id   text NOT NULL REFERENCES enrichissement.programme(id) ON DELETE CASCADE,
    -- Theme commun aux deux usages, aligne sur la classification du site.
    theme          text NOT NULL,
    sous_theme     text,
    -- Citation exacte du programme.
    extrait        text NOT NULL,
    -- Formulation courte pour l'affichage en QCM, facultative. Toujours
    -- accompagnee de `extrait` a l'ecran.
    resume_affichage text,
    page_ou_section  text,
    -- Ancre precise dans le document quand elle existe.
    url_ancre        text,
    saisi_le         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_programme_position_theme ON enrichissement.programme_position (theme);
CREATE INDEX idx_programme_position_programme
    ON enrichissement.programme_position (programme_id);
