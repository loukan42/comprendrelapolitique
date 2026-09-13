"""
Compare les cles de rapprochement produites par TypeScript et par Python.

Garde-fou d'un invariant reel : la methode de rattachement scrutin / dossier a
ete mesuree avec l'implementation Python (precision 100 %, couverture 95,5 %,
voir docs/DATA_SOURCES.md section 4). Le code de production etant en
TypeScript, cette mesure ne vaut pour lui que si les deux implementations
produisent des cles strictement identiques. Un espace d'ecart suffit a faire
tomber un rapprochement.

Usage :
    node scripts/import/verifier-cles.ts <dir_scrutins> <dir_documents> cles_ts.json
    python scripts/exploration/comparer_cles.py <dir_scrutins> <dir_documents> cles_ts.json
"""

from __future__ import annotations

import glob
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from reconcilier_scrutins_dossiers import (  # noqa: E402
    cle_document,
    cle_scrutin,
    est_vote_sur_ensemble,
    lire,
)


def main(dir_scrutins: str, dir_documents: str, chemin_ts: str) -> int:
    ts = json.load(open(chemin_ts, encoding="utf-8"))

    py_scrutins = {}
    for chemin in glob.glob(os.path.join(dir_scrutins, "*.json")):
        s = lire(chemin)["scrutin"]
        libelle = s["objet"]["libelle"]
        if est_vote_sur_ensemble(libelle):
            py_scrutins[s["uid"]] = cle_scrutin(libelle)

    py_documents = {}
    for chemin in glob.glob(os.path.join(dir_documents, "*.json")):
        d = lire(chemin)["document"]
        titre = (d.get("titres") or {}).get("titrePrincipal")
        if titre:
            py_documents[d["uid"]] = cle_document(titre)

    total_ecarts = 0
    for nom, cote_py, cote_ts in (
        ("scrutins", py_scrutins, ts["scrutins"]),
        ("documents", py_documents, ts["documents"]),
    ):
        manquants_ts = set(cote_py) - set(cote_ts)
        manquants_py = set(cote_ts) - set(cote_py)
        differents = [
            (u, cote_py[u], cote_ts[u])
            for u in set(cote_py) & set(cote_ts)
            if cote_py[u] != cote_ts[u]
        ]
        ecarts = len(manquants_ts) + len(manquants_py) + len(differents)
        total_ecarts += ecarts
        print(f"=== {nom} ===")
        print(f"  Python: {len(cote_py)}   TypeScript: {len(cote_ts)}")
        print(f"  absents cote TS  : {len(manquants_ts)}")
        print(f"  absents cote PY  : {len(manquants_py)}")
        print(f"  cles differentes : {len(differents)}")
        for u, a, b in differents[:5]:
            print(f"    {u}")
            print(f"      py: {a!r}")
            print(f"      ts: {b!r}")
        for u in list(manquants_ts)[:3]:
            print(f"    absent TS: {u} -> {cote_py[u]!r}")
        print()

    if total_ecarts == 0:
        print("IDENTIQUE : les deux implementations produisent les memes cles.")
        return 0
    print(f"ECART : {total_ecarts} divergence(s). La mesure de la methode ne vaut")
    print("pas pour l'implementation TypeScript tant qu'elles subsistent.")
    return 1


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2], sys.argv[3]))
