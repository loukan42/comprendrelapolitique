# Comprendre la Politique

Les règles de contribution du projet sont dans `AGENTS.md`, partagé avec l'agent
Lovable : Mantine comme unique bibliothèque d'interface, et les interdits
esthétiques et rédactionnels. Elles s'appliquent ici à l'identique.

@AGENTS.md

L'ambition complète du produit, telle que fournie par le porteur du projet, est
dans [docs/SPECIFICATION.md](docs/SPECIFICATION.md). C'est le document que les
autres fichiers de `docs/` citent sous le nom « la spécification ». Il décrit la
cible, pas l'état d'avancement réel.

## Développement local

Le serveur de dev écoute sur le port **8080** (imposé par
`@lovable.dev/vite-tanstack-config`), pas sur le 5173 par défaut de Vite.

```sh
npm run dev
```

**Le tout premier rendu prend environ 80 secondes**, le temps que Vite
pré-bundle les quelques centaines de modules de Mantine. Les rendus suivants
tombent à une vingtaine de millisecondes, et le cache survit aux redémarrages.

Ce délai n'est pas anodin : sans la déclaration `optimizeDeps.include` de
`vite.config.ts`, Vite découvrait Mantine à la première requête et relançait son
pré-bundling pendant le rendu serveur, lequel abandonnait au bout de 60 secondes.
Le premier chargement échouait alors avec une erreur 500.

## Données

La chaîne d'ingestion et ses contrôles sont décrits dans
[docs/PIPELINE.md](docs/PIPELINE.md). Aucune base à installer : le
développement local utilise PGlite.

```sh
npm run data:telecharger 16 data
npm run data:charger 16 data/16 --db data/pg16
npm run data:controler data/pg16
```

`data/` n'est pas versionné : les données sont retéléchargeables, c'est le code
d'import qui est le livrable.

## L'équipe d'agents

Cinq agents spécialisés sont définis dans `.claude/agents/`. Chacun porte ce que
le projet a appris, pour qu'une session neuve n'ait pas à le réapprendre.

| Agent | Quand l'appeler |
| --- | --- |
| `procedure-parlementaire` | Avant d'afficher un vote, un scrutin ou un parcours de loi, et pour trancher si une formulation trahit ce qui s'est passé. |
| `ingestion-donnees` | Pour étendre la chaîne d'import à une nouvelle source, ou maintenir celle de l'Assemblée. |
| `methodologie-quantitative` | Avant d'implémenter une formule qui produit un chiffre public : score d'importance, proximité du quiz, taux d'unité. |
| `vulgarisation` | Pour rédiger un résumé de loi, une fiche « ce qui change », un énoncé de quiz. |
| `verification` | Avant toute mise en ligne d'un contenu qui affiche des données, et après toute modification de l'importeur. |

`verification` ne modifie rien, il signale. Ce rôle existe parce que dans ce
projet, chaque défaut réel a été trouvé par un contrôle sur un fait connu, et
aucun par le code, qui s'exécutait proprement à chaque fois.
