"""
Rattache les votes sur l'ensemble d'un texte a leur dossier legislatif.

Pourquoi ce script existe
-------------------------
Le champ `objet.dossierLegislatif` d'un scrutin est vide pour 100 % des scrutins
des XVe et XVIe legislatures. Le lien officiel n'existe que dans l'autre sens,
cote dossier (`actesLegislatifs -> voteRefs.voteRef`), et il ne couvre que 78,5 %
des votes sur l'ensemble. Ce script reconstitue le reste, et sert au passage de
controle croise du lien officiel : il a deja mis en evidence un rattachement
errone dans la donnee de l'Assemblee (voir docs/DATA_SOURCES.md, section 4.3).

Mesure sur les trois legislatures (XVe, XVIe, XVIIe), 799 votes sur l'ensemble :

    concordants avec le lien officiel  508
    conflits                             2   <- erreurs de la source, verifiees
    echecs de rappel                    46
    rattachements reconstruits         207
    -> precision 100 %, rappel 91,4 %
    -> couverture portee de 69,6 % (556 liens officiels) a 95,5 % (763)

Les deux conflits ont ete verifies un par un : dans les deux cas c'est la source
officielle qui se trompe, pas ce script. Voir docs/DATA_SOURCES.md section 4.3.

Statut
------
Script d'exploration, volontairement en Python pour rester proche du travail
d'analyse. L'ingesteur de production devra etre reecrit en TypeScript pour
rester dans la stack du projet ; c'est la *methode* mesuree ici qui doit
survivre, pas ce fichier.

Usage
-----
    python reconcilier_scrutins_dossiers.py <dir_scrutins> <dir_dossiers>

ou <dir_scrutins> contient les json/VTANR*.json d'une legislature, et
<dir_dossiers> l'archive Dossiers_Legislatifs decompressee (sous-dossiers
`dossierParlementaire/` et `document/`).
"""

from __future__ import annotations

import collections
import datetime
import glob
import json
import os
import re
import sys
import unicodedata

# Marge autour de l'intervalle des dateActe d'un dossier. Un vote peut tomber
# quelques jours hors des actes enregistres sans que le rattachement soit faux.
MARGE = datetime.timedelta(days=30)

# Toutes ces expressions s'appliquent APRES normalisation, donc sur un texte sans
# parentheses ni virgules : elles ont deja saute.
# Piege rencontre : ecrire QUEUE avec des parentheses la rend totalement
# inoperante, et le rapprochement tombe alors a zero correspondance.
QUEUE = re.compile(
    r"\s+(?:"
    r"(?:premiere|deuxieme|seconde|troisieme|nouvelle)\s+lecture"
    r"|lecture\s+definitive"
    r"|texte\s+de\s+la\s+commission(?:\s+mixte\s+paritaire)?"
    r"|n\s+\d+"
    r")\b.*$"
)

# Le "la|le" final couvre un libelle malforme rencontre en XVIe legislature :
# "l'ensemble la proposition de loi", sans le "de".
PREFIX = re.compile(
    r"^(?:(?:premiere|deuxieme|seconde|troisieme)\s+partie\s+(?:du|de\s+la)\s+)?"
    r"l\s+ensemble\s+(?:du|de\s+la|de\s+l|des|la|le)\s+"
)

# Les lois de finances et de financement sont votees par parties.
PARTIE = re.compile(r"^(?:premiere|deuxieme|seconde|troisieme)\s+partie\s+(?:du|de\s+la)\s+")

# Clauses de procedure inserees au milieu du titre. Elles apparaissent des deux
# cotes, mais pas toujours simultanement : on les retire partout.
INSERT = re.compile(
    r"\s+(?:"
    r"adoptee?\s+par\s+le\s+senat"
    r"|adoptee?\s+par\s+l\s+assemblee\s+nationale"
    r"|modifiee?\s+par\s+le\s+senat"
    r"|apres\s+engagement\s+de\s+la\s+procedure\s+acceleree"
    r"|avec\s+modifications"
    r")\b"
)

# Un libelle comme "l'amendement n° 42 tendant a supprimer l'ensemble de ..."
# contient "l'ensemble" sans etre un vote sur l'ensemble d'un texte.
EST_AMENDEMENT = re.compile(r"\bsous\s+amendements?\b|\bamendements?\b")


def normaliser(texte: str | None) -> str:
    """Minuscules, sans accents ni ponctuation, espaces normalises."""
    s = unicodedata.normalize("NFKD", texte or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    s = s.replace("'", " ").replace("’", " ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def _nettoyer(t: str) -> str:
    return re.sub(r"\s+", " ", INSERT.sub(" ", PARTIE.sub("", t))).strip()


def cle_scrutin(libelle: str) -> str:
    return _nettoyer(QUEUE.sub("", PREFIX.sub("", normaliser(libelle))))


def cle_document(titre: str) -> str:
    return _nettoyer(QUEUE.sub("", normaliser(titre)))


def est_vote_sur_ensemble(libelle: str) -> bool:
    """Ecarte les votes d'amendement dont le libelle contient "l'ensemble"."""
    if "l'ensemble" not in libelle.lower():
        return False
    avant = normaliser(libelle).split("l ensemble")[0]
    return not EST_AMENDEMENT.search(avant)


def lire(chemin: str) -> dict:
    """Le JSON de l'Assemblee est en ASCII avec echappements \\uXXXX."""
    with open(chemin, "rb") as fh:
        return json.loads(fh.read().decode("utf-8"))


def collecter_dates(noeud, sortie: list) -> None:
    if isinstance(noeud, dict):
        for cle, valeur in noeud.items():
            if cle == "dateActe" and isinstance(valeur, str) and len(valeur) >= 10:
                try:
                    sortie.append(datetime.date.fromisoformat(valeur[:10]))
                except ValueError:
                    pass
            else:
                collecter_dates(valeur, sortie)
    elif isinstance(noeud, list):
        for valeur in noeud:
            collecter_dates(valeur, sortie)


def collecter_votes(noeud, uid_dossier: str, sortie: dict) -> None:
    """`acteLegislatif` est recursif et de profondeur variable : on descend tout."""
    if isinstance(noeud, dict):
        for valeur in noeud.values():
            collecter_votes(valeur, uid_dossier, sortie)
    elif isinstance(noeud, list):
        for valeur in noeud:
            collecter_votes(valeur, uid_dossier, sortie)
    elif isinstance(noeud, str) and noeud.startswith("VTANR"):
        sortie.setdefault(noeud, set()).add(uid_dossier)


def indexer(dir_dossiers: str):
    par_titre = collections.defaultdict(set)
    plages = {}
    officiels = {}

    for chemin in glob.glob(os.path.join(dir_dossiers, "dossierParlementaire", "*.json")):
        dossier = lire(chemin)["dossierParlementaire"]
        dates: list = []
        collecter_dates(dossier.get("actesLegislatifs"), dates)
        if dates:
            plages[dossier["uid"]] = (min(dates), max(dates))
        collecter_votes(dossier.get("actesLegislatifs"), dossier["uid"], officiels)

    for chemin in glob.glob(os.path.join(dir_dossiers, "document", "*.json")):
        doc = lire(chemin)["document"]
        ref = doc.get("dossierRef")
        titre = (doc.get("titres") or {}).get("titrePrincipal")
        if ref and titre:
            par_titre[cle_document(titre)].add(ref)

    return par_titre, plages, officiels


def resoudre(libelle, date_scrutin, par_titre, plages):
    """Retourne (uid_dossier, statut). N'accepte qu'un candidat unique."""
    candidats = par_titre.get(cle_scrutin(libelle))
    if not candidats:
        return None, "introuvable"
    retenus = [
        uid
        for uid in candidats
        if uid not in plages
        or (plages[uid][0] - MARGE) <= date_scrutin <= (plages[uid][1] + MARGE)
    ]
    if len(retenus) == 1:
        return retenus[0], "resolu"
    if len(retenus) > 1:
        return None, "ambigu"
    return None, "date incompatible"


def main(dir_scrutins: str, dir_dossiers: str) -> None:
    par_titre, plages, officiels = indexer(dir_dossiers)

    exact = conflit = 0
    echecs = collections.Counter()
    nouveaux = collections.Counter()
    conflits = []

    for chemin in glob.glob(os.path.join(dir_scrutins, "*.json")):
        scrutin = lire(chemin)["scrutin"]
        libelle = scrutin["objet"]["libelle"]
        if not est_vote_sur_ensemble(libelle):
            continue
        date_scrutin = datetime.date.fromisoformat(scrutin["dateScrutin"][:10])
        trouve, statut = resoudre(libelle, date_scrutin, par_titre, plages)

        refs_off = officiels.get(scrutin["uid"])
        officiel = next(iter(refs_off)) if refs_off and len(refs_off) == 1 else None

        if officiel:
            if trouve is None:
                echecs[statut] += 1
            elif trouve == officiel:
                exact += 1
            else:
                conflit += 1
                conflits.append((scrutin["uid"], officiel, trouve, libelle[:70]))
        else:
            nouveaux["recupere" if trouve else statut] += 1

    print("=== Validation contre les liens officiels ===")
    print(f"  concordants          : {exact}")
    print(f"  CONFLITS             : {conflit}")
    print(f"  echecs               : {dict(echecs)}")
    print()
    print("=== Votes sans lien officiel ===")
    print(f"  {dict(nouveaux)}")
    if conflits:
        print()
        print("=== Conflits a examiner un par un : ne jamais trancher automatiquement ===")
        for uid, off, rec, lib in conflits:
            print(f"  {uid}  officiel={off}  reconstruit={rec}")
            print(f"    {lib}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
