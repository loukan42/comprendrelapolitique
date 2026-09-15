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

Le même défaut est revenu le 14 septembre 2026 avec le cœur du routeur
(`@tanstack/router-core`, `seroval`) : après un changement de lockfile, le
cache reconstruit ne les contenait pas, et toutes les pages répondaient 500,
accueil compris. Ils sont désormais déclarés eux aussi. Le symptôme à
reconnaître est `transport invoke timed out after 60000ms` sur
`src/lib/error-page.ts` dans le journal : le code des pages n'est alors même pas
chargé. Pour trouver le paquet fautif, comparer la liste `optimized` de
`node_modules/.vite/deps/_metadata.json` à celle d'une copie qui fonctionne ;
tout paquet absent de la liste et découvert au rendu est à ajouter à `include`.

Même avec un cache complet, le premier rendu après un démarrage à froid peut
dépasser 60 secondes. L'import expiré reste alors en mémoire dans le rendu
serveur, et chaque requête suivante échoue en quelques millisecondes, alors que
le serveur est prêt. Le remède ne demande pas de redémarrer : modifier le contenu
de `src/server.ts`, faire une requête, puis rétablir le fichier.

```sh
echo "" >> src/server.ts
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/
git checkout -- src/server.ts
```

Le changement de contenu invalide le module, et la requête suivante le
recharge. Sous Windows, `touch` ne suffit pas : le watcher ignore un simple
changement de date, et l'erreur persiste (constaté le 14 septembre 2026).

## Données

La chaîne d'ingestion et ses contrôles sont décrits dans
[docs/PIPELINE.md](docs/PIPELINE.md). Aucune base à installer : le
développement local utilise PGlite.

La chaîne complète, dans l'ordre. Les données officielles d'abord, puis les
couches d'enrichissement qui s'appuient dessus.

```sh
# 1. Données officielles, une législature à la fois, sur la même base.
npm run data:telecharger 15 data
npm run data:charger 15 data/15 --db data/pg16
npm run data:telecharger 16 data
npm run data:charger 16 data/16 --db data/pg16
npm run data:telecharger 17 data
npm run data:charger 17 data/17 --db data/pg16
npm run data:controler data/pg16

# 2. Enrichissement : formations, placement dans l'hémicycle, scores, thèmes.
npm run data:formations -- --db data/pg16
npm run data:ordre-groupes -- --db data/pg16
npm run enrichissement:scores -- --db data/pg16
npm run enrichissement:themes-echantillon -- --db data/pg16

# 3. Quiz des votes : banque de questions puis positions calculées.
npm run data:questions -- --db data/pg16
npm run data:positions -- --db data/pg16

# 4. Programmes : références vers les documents, puis positions citées.
npm run data:programmes -- --db data/pg16
npm run data:positions-programme -- --db data/pg16

# 5. Bilans : engagements présidentiels, extraits vérifiés contre le programme.
npm run data:bilans -- --db data/pg16
```

Jeux facultatifs, hors chaîne minimale parce qu'ils sont lourds :
`--debats` ajoute les comptes rendus de séance (311 Mo pour la XVIIe), d'où
viennent les explications de vote ; `--amendements` ajoute les amendements
(1,1 Go pour la XVIIe). Les deux se passent à `data:telecharger` puis à
`data:charger`.

`data:charger` se rejoue par législature sur la même base : charger la XVe,
la XVIe et la XVIIe à la suite avec le même `--db` les réunit. La migration
`001_officiel.sql`, idempotente, est rejouée à chaque chargement : c'est ce qui
met à niveau une base créée avant une évolution du schéma. Une base plus
ancienne que le code se répare donc en rejouant les trois chargements.

Chaque script d'enrichissement porte un mode de contrôle qui n'écrit rien, et
c'est par là qu'il faut commencer quand on en modifie le contenu :

| Script | Contrôle | Ce qu'il montre |
| --- | --- | --- |
| `data:formations` | `--preuve` | Les mandats de parti sur lesquels chaque rattachement s'appuie |
| `data:ordre-groupes` | `--verifier` | L'ordre obtenu, de la gauche vers la droite, par législature |
| `data:questions` | `--verifier` | L'objet réel de chaque scrutin retenu, en face du sens déclaré |
| `data:positions` | `--detail <question>` | Le décompte scrutin par scrutin ayant servi au calcul |
| `data:programmes` | `--verifier` | Le code de réponse de chaque lien |
| `data:positions-programme` | `--verifier` | Si chaque citation figure bien dans le document source, puis chaque question du QCM avec ses citations |
| `data:bilans` | `--verifier` | Si chaque extrait figure dans le programme, et le code de réponse de chaque source |

Ces contrôles ne sont pas décoratifs : celui de `data:questions` a rattrapé
quatre erreurs de rattachement, et celui de `data:positions-programme` a
refusé une citation qui n'existait pas dans le document.

Ce que fait chaque couche d'enrichissement, et ce qu'on perd sans elle :

- `data:formations` rattache les groupes parlementaires aux formations
  politiques qu'ils prolongent, sans quoi « Les Républicains » et « Droite
  Républicaine » comptent comme deux familles distinctes.
- `data:ordre-groupes` place les groupes sur l'axe gauche-droite de
  l'hémicycle. Sans cette étape, le dessin range les groupes par identifiant,
  ce qui lui retire le seul apport qu'il a sur un tableau de chiffres. La
  source ne publie pas cet ordre : c'est un placement éditorial.

Le site fonctionne sans aucune de ces étapes, et même sans base du tout : les
fonctions serveur renvoient un résultat vide et les pages affichent leur état
vide plutôt qu'une erreur. C'est ce qui permet à une prévisualisation faite
depuis le dépôt seul, comme celle de Lovable, de servir le site.

`data/` n'est pas versionné : les données sont retéléchargeables, c'est le code
d'import qui est le livrable.

## Déploiement

Le site tourne aussi bien en local (PGlite, ci-dessus) que déployé, à
condition de lui donner une vraie base PostgreSQL : PGlite est un fichier sur
disque, et la plupart des environnements de déploiement (dont Cloudflare
Workers, la cible par défaut de `@lovable.dev/vite-tanstack-config`) n'ont
pas de disque persistant entre deux requêtes.

Le choix se fait par la variable d'environnement `DATABASE_URL` :

- absente → PGlite local, comme en développement (`src/queries/db.ts`,
  `scripts/import/db.ts`) ;
- présente → PostgreSQL distant, ouvert avec `pg`. N'importe quel PostgreSQL
  convient ; le porteur du projet a choisi Supabase, qui offre une instance
  gratuite suffisante pour démarrer.

### Mettre en place la base distante

1. Créer un projet sur [supabase.com](https://supabase.com) et récupérer sa
   chaîne de connexion (Project Settings → Database → Connection string,
   variante « URI »). Elle a la forme
   `postgresql://postgres:<mot-de-passe>@<hote>:5432/postgres`.
2. Ne jamais commiter cette chaîne : elle contient un mot de passe. En local,
   la mettre dans un fichier `.env` (ignoré par Git, voir `.gitignore`) :

   ```sh
   DATABASE_URL=postgresql://postgres:...@....supabase.co:5432/postgres
   ```

3. Rejouer la chaîne d'import complète (section « Données » ci-dessus) en
   remplaçant `data/pg16` par `$DATABASE_URL` dans chaque commande, par
   exemple :

   ```sh
   npm run data:charger 15 data/15 --db "$DATABASE_URL"
   npm run data:charger 16 data/16 --db "$DATABASE_URL"
   npm run data:charger 17 data/17 --db "$DATABASE_URL"
   npm run data:formations -- --db "$DATABASE_URL"
   npm run data:ordre-groupes -- --db "$DATABASE_URL"
   npm run enrichissement:scores -- --db "$DATABASE_URL"
   npm run data:questions -- --db "$DATABASE_URL"
   npm run data:positions -- --db "$DATABASE_URL"
   npm run data:programmes -- --db "$DATABASE_URL"
   npm run data:positions-programme -- --db "$DATABASE_URL"
   npm run data:bilans -- --db "$DATABASE_URL"
   ```

   Chaque script accepte indifféremment un chemin PGlite local ou une URL
   PostgreSQL : `ouvrirBase()` choisit selon le préfixe `postgres://` ou
   `postgresql://` (`scripts/import/db.ts`). Cette étape ne se rejoue qu'à
   chaque mise à jour des données, pas à chaque déploiement.

4. Déclarer `DATABASE_URL` comme variable d'environnement du déploiement
   (dans l'interface Lovable, ou celle de l'hébergeur choisi), avec la même
   valeur.

### Publier

Le projet est connecté à Lovable (voir l'encadré en tête d'`AGENTS.md`) :
pousser sur la branche connectée met à jour l'éditeur Lovable, et un clic sur
« Publish » dans son interface donne une adresse publique. C'est la voie la
plus simple, sans configuration de build à écrire ici.

**Point de vigilance non résolu** : si l'infrastructure de publication de
Lovable déploie effectivement sur Cloudflare Workers (comme le laisse
supposer la cible `cloudflare` par défaut de la configuration nitro), une
connexion PostgreSQL classique par `pg` (protocole TCP direct) peut échouer :
l'environnement d'exécution des Workers ne route pas nativement les sockets
TCP arbitraires. Cloudflare résout ce cas précis avec
[Hyperdrive](https://developers.cloudflare.com/hyperdrive/), qui demande un
compte Cloudflare et une configuration côté Cloudflare, potentiellement hors
de portée de l'abstraction « Publish » de Lovable. Si la connexion échoue
après une première publication (erreur de socket plutôt qu'une simple absence
de schéma), c'est la piste à suivre en premier.

## L'équipe d'agents

Dix agents spécialisés sont définis dans `.claude/agents/`. Chacun porte ce que
le projet a appris, pour qu'une session neuve n'ait pas à le réapprendre.

| Agent | Quand l'appeler |
| --- | --- |
| `procedure-parlementaire` | Avant d'afficher un vote, un scrutin ou un parcours de loi, et pour trancher si une formulation trahit ce qui s'est passé. |
| `ingestion-donnees` | Pour étendre la chaîne d'import à une nouvelle source, ou maintenir celle de l'Assemblée. |
| `methodologie-quantitative` | Avant d'implémenter une formule qui produit un chiffre public : score d'importance, proximité du quiz, taux d'unité. |
| `vulgarisation` | Pour rédiger un résumé de loi, une fiche « ce qui change », un énoncé de quiz. |
| `verification` | Avant toute mise en ligne d'un contenu qui affiche des données, et après toute modification de l'importeur. |
| `expert-juridique` | Sur tout énoncé qui qualifie une loi, un vote, une procédure ou un droit : fidélité au texte, au sort réel du texte et aux décisions du Conseil constitutionnel. |
| `ux-produit` | Après une refonte d'écran, et pour auditer les parcours : clarté de l'action, mobile, serious gaming. |
| `product-manager` | Pour arbitrer ce qu'une fonctionnalité apporte, et repérer doublons, pages orphelines et promesses que les données ne tiennent pas. |
| `editorial` | Après toute modification de texte visible : neutralité, lisibilité, cohérence du vocabulaire, règles de rédaction. |
| `frontend` | Après une modification d'interface : accessibilité, responsive, hydratation, performance, liens morts. |

`verification` ne modifie rien, il signale ; les cinq derniers non plus : ils rendent des constats classés CRITIQUE, IMPORTANT ou AMÉLIORATION, que la session principale applique. Ce rôle existe parce que dans ce
projet, chaque défaut réel a été trouvé par un contrôle sur un fait connu, et
aucun par le code, qui s'exécutait proprement à chaque fois.
