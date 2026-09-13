# Comprendre la Politique

Les règles de contribution du projet sont dans `AGENTS.md`, partagé avec l'agent
Lovable : Mantine comme unique bibliothèque d'interface, et les interdits
esthétiques et rédactionnels. Elles s'appliquent ici à l'identique.

@AGENTS.md

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
