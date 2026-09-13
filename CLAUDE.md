# Comprendre la Politique

Les règles de contribution du projet — Mantine comme unique bibliothèque
d'interface, et les interdits esthétiques et rédactionnels — sont dans
`AGENTS.md`, partagé avec l'agent Lovable. Elles s'appliquent ici à l'identique.

@AGENTS.md

## Développement local

Le serveur de dev écoute sur le port **8080** (imposé par
`@lovable.dev/vite-tanstack-config`), pas sur le 5173 par défaut de Vite.

```sh
npm run dev
```

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
