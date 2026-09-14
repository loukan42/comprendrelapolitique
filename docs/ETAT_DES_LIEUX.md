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
npm test               # 32 tests, sans dépendance ajoutée
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
- **Quiz des votes** : 11 questions à six réponses, sur la banque et les positions
  calculées par formation, calcul entièrement dans le navigateur. Intitulés en
  langage courant, un seul sujet par question, et une phrase d'explication
  quand le texte voté emploie une notion technique (rétention, présomption de
  légitime défense).
- **Programmes** (`/programmes`) : documents publiés par les candidats et leurs
  partis, avec leur nature et leur date. Programmes de campagne 2027 de
  Gabriel Attal, Édouard Philippe et Jean-Luc Mélenchon ; pour les autres
  candidats, le document le plus récent de leur formation.
- **Comparateur** (`/programmes/comparer`) : deux formations côte à côte, sur
  citations vérifiées. Huit formations, 97 citations.
- **Quiz des programmes** (`/programmes/quiz`) : 17 questions, chacune réunissant
  au moins trois formations, des citations présentées sans leur auteur,
  révélé après le choix avec le candidat et la nature du document. Un repère
  sourcé explique les termes techniques (peine plancher, IFI, part fiscale). Le décompte se fait dans
  le navigateur et rapporte chaque choix au nombre de questions où la
  formation figurait.
- **Bilans** (`/bilans/emmanuel-macron`) : engagements face aux faits, sur les
  deux mandats.
- **En ce moment** (`/actualite`) : derniers dépôts, votes sur l'ensemble et
  promulgations, lus dans les actes de procédure et les scrutins.

### Direction visuelle

Depuis le 14 septembre 2026 : fond noir pur, texte blanc et gris cendre, très
grands titres en graisse légère à l'interlettrage resserré, boutons en
pastille, et un seul accent ambre réservé à l'interaction. Inspirée du système
Dala (styles.refero.design), dont l'accent violet saturé a été écarté au profit
de l'ambre pour rester dans les teintes permises par `AGENTS.md` section 4.
La police est Inter, servie par le site (`@fontsource-variable/inter`) et non
par Google Fonts. Raisons et contrastes détaillés dans `src/theme.ts`.

### Couches d'enrichissement

| Table | Contenu | Volume |
| --- | --- | --- |
| `formation`, `formation_groupe` | familles politiques par-dessus les groupes | 11 formations, 32 des 43 groupes |
| `groupe_ordre` | placement gauche-droite dans l'hémicycle | 43 groupes |
| `question`, `question_scrutin` | banque du quiz des votes | 11 questions, 15 scrutins |
| `question_position` | positions calculées par formation | 95 |
| `programme`, `programme_position`, `programme_question` | programmes, citations, questions du QCM | 38 références, 97 citations, 17 questions |
| `president`, `mandat_presidentiel`, `engagement` | bilans | 1 président, 2 mandats, 24 engagements |
| `score_importance`, `dossier_theme` | score et classification | 10 647 dossiers |

---

## 3. Ce qui reste à faire

### Priorité haute

1. **Corpus des bilans.** 24 engagements : 16 pour le mandat 2017-2022
   (fiscalité, travail, entreprises, solidarité, santé, éducation, culture,
   retraites) et 8 pour le mandat 2022-2027, tirés de la déclaration de
   candidature déposée auprès de la commission de contrôle. Chaque extrait est
   désormais vérifié contre le PDF du programme, par le même code que les
   citations du comparateur. Méthode dans `scripts/import/bilans.ts`, à lire
   avant d'ajouter quoi que ce soit.

   Engagements repérés et non encore traités : le versement automatique des
   aides sociales et sa contrepartie d'activité, le doublement de la présence
   des forces de l'ordre sur la voie publique, les livraisons d'équipements
   militaires d'ici 2030, la rénovation de 700 000 logements par an. La table
   des mesures hors programme reste vide.

2. **Banque du quiz des votes.** Onze questions, il en faut 20 à 25 pour la
   V1. Le blocage est levé depuis le chargement des amendements, voir
   section 5.

3. **Corpus du comparateur de programmes.** 40 citations pour cinq
   formations : La France insoumise, le Rassemblement National, le Parti
   socialiste, Les Républicains et Renaissance. Le Parti socialiste est cité
   depuis les pages de chapitre de son projet : sa page d'accueil présente les
   mesures en cartes à retourner et ne les porte pas dans son texte.

   Rétabli : les citations du Parti communiste français viennent désormais de
   la page des dix propositions du parti, `pcf.fr/le_programme` répondant 404
   depuis le 14 septembre 2026.

### Priorité moyenne

4. **QCM des programmes.** En place sur 17 questions, reconstruit le
   14 septembre 2026 sur les programmes de campagne 2027 quand ils existent
   (Attal, Philippe, Mélenchon). Marine Le Pen est citée dans son programme
   présidentiel de 2022, faute de programme 2027 sur mlafrance.fr ; Bruno
   Retailleau dans sa tribune « Priorité travail » et les documents des
   Républicains, avecretailleau.fr ne portant pas de texte de programme.
   Restent absents, faute de texte citable : Les Écologistes (le site de
   Marine Tondelier publie des billets, pas de programme), Xavier Bertrand
   (pages de programme rendues en JavaScript, sans texte lisible par le
   vérificateur), Reconquête (plateforme participative). La « vision en 42
   chantiers » de Place publique n'a pas encore été exploitée. À reprendre à
   la désignation du candidat socialiste, après la primaire des 10 et
   11 octobre 2026. Élargir passe par de nouvelles citations, jamais par une
   position déduite.
5. ~~**Quiz des votes, nouveau modèle.**~~ Fait : `/quiz` lit la banque
   (`chargerBanqueQuiz`), pose les questions avec six réponses et calcule la
   compatibilité dans le navigateur (`quizPosition.ts`). L'ancien modèle
   (`quizCalcul.ts`, `questionsQuiz.ts`) est supprimé. À surveiller : une
   formation est classée dès trois questions en commun, et son pourcentage est
   alors moins comparable à celui d'une formation présente sur toutes.
6. **Sections rédigées de la page loi.** Le parcours législatif est reporté
   (`src/components/ParcoursLoi.tsx`) : frise des grandes étapes, cochées
   seulement sur un acte qui les prouve, puis détail par lecture. Restent les
   sections « En 30 secondes » et « Pourquoi cette loi ? », qui demandent des
   textes rédigés et sourcés, dossier par dossier (agent `vulgarisation`).

### Priorité basse

7. Débats et amendements des XVe et XVIe législatures.
8. ~~Page actualité.~~ Faite (`/actualite`) : derniers textes déposés, derniers
   votes sur l'ensemble, dernières lois promulguées. Le bloc « ce qui fait
   parler » reste vide faute de source médiatique (GDELT, prévu par la
   spécification, non branché).

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

**Un PDF peut mal restituer ses propres lettres.** La déclaration de
candidature de 2022 perd ses ligatures à l'extraction (« confance » pour
« confiance », « efcace » pour « efficace »), et les programmes sur deux
colonnes entrelacent leurs lignes en mode `-layout`. `scripts/import/citations.ts`
cherche dans deux extractions et ramène les ligatures à un seul f des deux
côtés : sans cela, des citations exactes étaient déclarées introuvables.

**Le contrôle des volumes suppose une seule législature.** Sur une base qui
réunit la XVe, la XVIe et la XVIIe, comme le recommande `CLAUDE.md`,
`data:controler` signale quatre échecs de volume dont les chiffres obtenus sont
exactement la somme des trois législatures (16 957 scrutins, 2 346 018 votes).
Ce n'est pas un défaut des données. Deux autres contrôles échouent, sur les
amendements de la XVIIe qui renvoient à un document (199) ou à un dossier (149)
absent du jeu Dossiers : à examiner.

**Une base plus ancienne que le code répond 500 sur certaines pages.** Le
14 septembre 2026, la base locale n'avait ni la couleur des organes ni les
tables de débats, ajoutées au schéma après son chargement : `charger.ts` ne
rejouait la migration que sur une base vierge. Il la rejoue désormais à chaque
chargement.

**Un 500 sur toutes les pages ne vient pas forcément du code.** Le 14 septembre
2026, après un `git pull` qui changeait le lockfile, le serveur de dev
répondait 500 partout, accueil compris, alors que le build passait. La cause
était un paquet du routeur absent du cache de pré-bundling de Vite. Symptôme,
diagnostic et correctif : `CLAUDE.md`, section Développement local.

**Les sources disparaissent en cours de route.** La page programme du Parti
communiste français est passée en ligne le matin et en 404 l'après-midi du
14 septembre 2026. Relancer les modes `--verifier` régulièrement n'est pas une
précaution théorique : un corpus de citations se dégrade tout seul.

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
