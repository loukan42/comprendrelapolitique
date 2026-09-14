# État des lieux

Document de reprise. Il dit où en est le projet, ce qui reste à faire, et ce
qu'il faut savoir pour continuer sans refaire le chemin.

**Dernière mise à jour : 14 septembre 2026.**

À tenir à jour à chaque session. Un fichier d'état qui ment est pire que pas
de fichier.

---

## 1. Comment relancer le projet

```sh
npm run dev            # port 8080, premier rendu ~80 s
npm test               # 26 tests, sans dépendance ajoutée
npm run build
```

La base locale est un PGlite dans `data/pg16`, **non versionné**. Sans elle le
site fonctionne et affiche des états vides : c'est voulu, voir section 6.

Chaîne de chargement complète et ordre des scripts : `CLAUDE.md`, section
Données. Chaque script d'enrichissement a un mode de contrôle qui n'écrit
rien (`--verifier`, `--preuve`, `--detail`), et c'est par là qu'il faut
commencer avant d'en modifier le contenu.

---

## 2. Ce qui est en place

### Données officielles

| Jeu | État |
| --- | --- |
| Scrutins, dossiers, acteurs XVe, XVIe, XVIIe | chargés, 16 957 scrutins, 2,3 M votes |
| Débats XVIIe | chargés, 601 séances, 321 892 interventions |
| Amendements XVIIe | chargés, 123 262 amendements |
| Débats et amendements XVe et XVIe | **non chargés**, jeux lourds |

### Pages du site

- **Accueil** : scrutins récents, couverture des données.
- **Recherche** et **liste des lois** (`/lois`), triée par score institutionnel.
- **Page d'une loi** : hémicycle rangé de la gauche vers la droite, vote par
  groupe, explications de vote citées depuis le compte rendu, contexte du
  texte et liens officiels.
- **Thèmes** : chaque texte avec le résultat de son propre scrutin.
- **Députés**, **groupes** : taux d'unité, participation, proximité.
- **Quiz des votes** : 16 questions, calcul entièrement dans le navigateur.
- **Programmes** (`/programmes`) : documents publiés par les partis, avec leur
  nature et leur date.
- **Comparateur** (`/programmes/comparer`) : deux formations côte à côte, sur
  citations vérifiées.
- **Bilans** (`/bilans/emmanuel-macron`) : engagements face aux faits.

### Couches d'enrichissement

| Table | Contenu | Volume |
| --- | --- | --- |
| `formation`, `formation_groupe` | familles politiques par-dessus les groupes | 11 formations, 32 des 43 groupes |
| `groupe_ordre` | placement gauche-droite dans l'hémicycle | 43 groupes |
| `question`, `question_scrutin` | banque du quiz des votes | 11 questions, 15 scrutins |
| `question_position` | positions calculées par formation | 95 |
| `programme`, `programme_position` | programmes et citations | 18 références, 10 citations |
| `president`, `mandat_presidentiel`, `engagement` | bilans | 1 président, 2 mandats, 8 engagements |
| `score_importance`, `dossier_theme` | score et classification | 10 647 dossiers |

---

## 3. Ce qui reste à faire

### Priorité haute

1. **Corpus des bilans.** Huit engagements sur trois thèmes du mandat
   2017-2022 (fiscalité, retraites, éducation). Il en manque la plus grande
   part, et tout le mandat 2022-2027. Méthode dans `scripts/import/bilans.ts`.
2. **Banque du quiz des votes.** Onze questions, il en faut 20 à 25 pour la
   V1. Le blocage est levé depuis le chargement des amendements, voir
   section 5.
3. **Corpus du comparateur de programmes.** Dix citations, deux formations.
   LFI et le RN publient en PDF : `pdftotext` est disponible sur la machine,
   la vérification de citation ne lit pour l'instant que du HTML.

### Priorité moyenne

4. **QCM des programmes.** Demande d'abord du volume : un quiz sur deux
   formations et cinq thèmes n'aurait pas de sens.
5. **Quiz des votes, nouveau modèle.** Le moteur multi-scrutins
   (`quizPosition.ts`) est écrit et testé, mais la page `/quiz` utilise encore
   l'ancien modèle, une question pour un scrutin, avec quatre réponses au lieu
   de six.
6. **Sections rédigées de la page loi.** La page `$id.tsx` venue de `main`
   portait un parcours législatif détaillé (dépôt, CMP, 49.3, promulgation) et
   des sections « En 30 secondes », « Pourquoi cette loi ? ». Elle a été
   retirée lors de la fusion au profit de `$uid.tsx`, qui porte les votes.
   Ces sections restent dans l'historique et sont à reporter.

### Priorité basse

7. Débats et amendements des XVe et XVIe législatures.
8. Page actualité, toujours un lien « Bientôt » sur l'accueil.

---

## 4. Décisions en attente

Paramètres du quiz posés par défaut, à confirmer (`QUIZ_ENGINE.md` section 11) :

| Paramètre | Valeur actuelle | Remarque |
| --- | --- | --- |
| Demi-vie de la décote temporelle | 48 mois | une législature comme unité de changement |
| `min_scrutins` | 1 | à relever quand la banque s'étoffe |
| `min_votes` | 30 | un premier réglage à 200 écartait tout, et surtout les petits groupes |
| Poids d'un sujet important | 2 | |
| Nombre de questions du quiz | 16 | la cible était 15 à 20 |

---

## 5. Ce qu'il faut savoir avant de continuer

**Le sens d'un vote ne se devine pas.** 12 351 des 16 957 scrutins portent sur
un amendement, et l'objet d'un tel scrutin dit « l'amendement n° 10 de
M. Alexandre après l'article 6 », jamais ce que l'amendement proposait. Les
amendements de la XVIIe étant chargés, leur texte est désormais lisible : le
sens devient **établissable**, il ne devient pas automatique. Décider qu'un
amendement va dans le sens d'une question reste un travail de lecture.

**Un code 200 ne prouve pas le contenu.** Une URL d'archive testée pendant ce
travail répondait 200 ; la capture datait de la campagne suivante. Vérifier
qu'un lien répond et vérifier qu'il contient ce qu'on annonce sont deux
choses.

**Un 403 ne prouve pas l'absence.** Légifrance, l'Urssaf et economie.gouv.fr
refusent les requêtes automatisées. Les traiter comme des liens morts
écarterait du bilan les sources les plus solides, celles du droit publié.
`bilans.ts` les classe comme bloquées.

**Les contrôles rattrapent de vraies fautes.** Celui de `data:questions` a
corrigé quatre rattachements erronés, dont un texte d'orientation agricole
rangé sous une question portant sur l'allègement des règles
environnementales. Celui de `positions_programme.ts` a refusé une citation
attribuée aux Républicains qui ne figurait pas dans leur document. Ne pas
sauter ces étapes.

**Les groupes ne survivent pas aux législatures.** « Les Républicains » et
« Droite Républicaine » sont deux organes distincts sans lien dans la source,
d'où la couche `formation`. Et un parti sous le seuil de quinze députés n'a
pas de groupe : le Rassemblement national n'en a aucun avant 2022, ses élus
siégeant parmi les non-inscrits.

---

## 6. Règles que le code applique et qu'il faut garder

- **Les réponses au quiz ne quittent jamais le navigateur.** Donnée sensible
  au sens de l'article 9 du RGPD. Un test le vérifie, et il vérifie aussi son
  propre détecteur.
- **Le site sert sans base de données.** `data/` n'étant pas versionné, un
  déploiement fait depuis le dépôt seul démarre sans données. Les fonctions
  serveur renvoient un résultat vide et les pages affichent leur état vide.
  C'est ce qui permet à la prévisualisation Lovable de fonctionner.
- **Rien n'est inventé.** Pas de promesse, pas de loi, pas de source. Une
  donnée manquante s'affiche comme manquante.
- **Citer plutôt que reformuler.** Les positions de programme et les
  explications de vote sont des citations, vérifiées contre leur source.
- **Le bilan ne juge pas les politiques.** Il vérifie si ce qui a été annoncé
  a été fait. Une réforme peut être réalisée et ses résultats contestés.

---

## 7. Documents de référence

| Fichier | Contenu |
| --- | --- |
| `AGENTS.md` | règles de contribution, interdits esthétiques et rédactionnels |
| `CLAUDE.md` | développement local, chaîne de données, agents |
| `docs/QUIZ_ENGINE.md` | conception du moteur de quiz, algorithme, plan par phases |
| `docs/QUIZ_METHODOLOGY.md` | méthodologie du quiz et de la proximité |
| `docs/SCORING.md` | score d'importance publique |
| `docs/DATA_SOURCES.md` | sources, pièges et mesures sur les données |
| `docs/PIPELINE.md` | chaîne d'ingestion et contrôles |
