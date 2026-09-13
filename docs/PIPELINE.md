# Chaîne d'ingestion

Comment charger les données de l'Assemblée nationale en local, et comment
vérifier que le chargement est correct.

Prérequis : Node 24 ou plus. Les scripts sont en TypeScript et Node les exécute
sans transpilation. Aucune base de données à installer : le développement local
utilise PGlite, PostgreSQL compilé en WebAssembly.

## En trois commandes

```bash
npm run data:telecharger 16 data
```

Télécharge les trois jeux du MVP (scrutins, dossiers, acteurs) pour la XVIe
législature, les décompresse dans `data/16/`, et garde les archives et leurs
empreintes dans `data/_archives/`.

Relancée, la commande n'appelle le serveur qu'en `HEAD` et ne retélécharge que
ce qui a bougé. Les archives des XVe et XVIe sont figées depuis 2022 et 2024 ;
seule la XVIIe se republie chaque nuit.

```bash
npm run data:charger 16 data/16 --db data/pg16
```

Applique la migration, puis importe. Sans `--db`, la base est en mémoire et rien
n'est conservé : utile pour vérifier un import, inutile pour travailler dessus.

```bash
npm run data:controler data/pg16
```

Interroge la base sur des faits connus par ailleurs et signale tout écart.

## Durées et volumes constatés

| Législature | Téléchargement | Import | Scrutins | Votes individuels |
| --- | --- | --- | --- | --- |
| XVe | 27 Mo | ~16 s | 4 417 | 472 631 |
| XVIe | 21 Mo | ~16 s | 4 106 | 602 911 |
| XVIIe | 38 Mo | ~30 s | 8 434 | 1 270 476 |

Les amendements et les débats ne font pas partie du MVP : ils pèsent à eux seuls
1,5 Go pour trois législatures, contre 86 Mo pour le reste (voir
[DATA_SOURCES.md](DATA_SOURCES.md) section 1.2). Ils restent hors de
`npm run data:telecharger` par défaut, et hors de `JEUX_MVP`.

## Amendements (XVIe, en option)

Les amendements de la XVIe sont importables, mais pas par défaut : c'est un
jeu de 347 Mo compressés, 163 789 fichiers, pour une part du produit qui reste
secondaire (la carte « Amendements importants » d'une future page loi). Le
format n'a été inspecté et le modèle écrit que pour la XVIe (voir
[DATA_SOURCES.md](DATA_SOURCES.md) section 7 bis et
[DATA_MODEL.md](DATA_MODEL.md) section 5 bis) ; la XVe et la XVIIe restent à
faire.

```bash
npm run data:telecharger 16 data --amendements
npm run data:charger 16 data/16 --db data/pg16 --amendements data/16/amendements/json
```

Le drapeau `--amendements` de `charger.ts` accepte aussi un chemin explicite
vers un répertoire `json/<dossier>/<document>/*.json` situé ailleurs que sous
`<dir_archives>/amendements/json`, utile quand l'archive a été récupérée par un
autre moyen que `data:telecharger`. Sans le drapeau et sans le répertoire par
défaut, `charger.ts` importe les trois jeux du MVP et ignore les amendements
silencieusement, comme avant l'ajout de ce jeu.

Durée mesurée sur la XVIe (machine de développement) : environ 96 secondes
pour les 163 789 amendements et les 3 148 274 liens de cosignature, contre
20 secondes pour les trois jeux du MVP réunis.

Le dossier `data/` n'est pas versionné. Les données sont retéléchargeables ;
c'est le code d'import qui est le livrable.

## Ce que contrôle `data:controler`

Un import qui se termine sans erreur n'est pas un import correct. Les trois
défauts trouvés jusqu'ici l'ont tous été par ces contrôles, jamais par l'import
lui-même, qui se terminait proprement à chaque fois.

**Des volumes**, comparés aux mesures faites sur les fichiers bruts avant tout
import. C'est ce qui a révélé que la XVIIe perdait 132 blocs de groupe.

**Les règles non négociables** d'[AGENTS.md](../AGENTS.md) section 5 : aucune
position `ABSENT` en base, aucun acteur votant deux fois dans un même scrutin,
aucun conflit de rattachement qui retienne malgré tout un dossier, aucun organe
fictif `PO0`.

**L'intégrité référentielle** après coup plutôt que pendant : les archives ne
sont pas cloisonnées par législature, et plusieurs références ne se résolvent
qu'une fois les autres chargées.

**Des faits politiques vérifiables**, pour la XVIe : les deux motions de censure
du 20 mars 2023 avec leurs 278 et 94 voix pour 287 requises, et la réforme des
retraites reconnue comme adoptée sans vote et reliée à son dossier d'engagement
de responsabilité.

**Les amendements**, si le jeu a été chargé : volumes comparés aux 163 789
fichiers et 3 148 274 liens de cosignature mesurés sur l'archive brute de la
XVIe, répartition par type d'auteur, absence systématique d'acteur sur les
amendements du Gouvernement, et intégrité référentielle vers les jeux Dossiers
et Acteurs. Le bloc ne s'exécute que si `officiel.amendement` contient des
lignes : le contrôle reste silencieux sur une base chargée sans ce jeu optionnel.

## Passer à un PostgreSQL de production

`scripts/import/db.ts` expose une interface de quatre méthodes. PGlite en est une
implémentation ; un `pg` ou un Supabase en serait une autre, sans toucher au code
d'import. PGlite exécute le vrai moteur PostgreSQL : types, contraintes et
`ON CONFLICT` s'y comportent à l'identique.

Une différence connue tout de même : PGlite ne sérialise pas les tableaux de type
énuméré. L'insertion en masse passe donc uniformément par `text[]` avec
transtypage côté SQL, ce qui fonctionne des deux côtés.
