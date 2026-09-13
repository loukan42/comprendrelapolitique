# Spécification du projet

Document fondateur du projet, fourni tel quel par le porteur du produit. Les
autres documents de `docs/` (`DATA_SOURCES.md`, `DATA_MODEL.md`,
`PIPELINE.md`) y renvoient constamment sous le nom « la spécification » : il
est versionné ici pour que cette référence pointe vers un texte réel plutôt
que vers une conversation.

Ce texte décrit l'ambition complète du produit. Il ne décrit pas l'état
d'avancement réel, qui évolue et se lit dans le code, dans `docs/PIPELINE.md`
et dans les autres documents de ce dossier.

---

## MISSION

Développe une application web française grand public permettant de comprendre
simplement ce que font réellement les responsables politiques à partir de
données publiques officielles.

Le produit doit être à la fois :

1. un « Wikipédia de la vie politique », extrêmement pédagogique ;
2. un moteur de recherche sémantique sur les lois, votes, amendements et
   débats ;
3. un comparateur entre les opinions de l'utilisateur et les votes réellement
   exprimés au Parlement ;
4. une plateforme de quiz politiques pédagogiques et ludiques ;
5. un fil d'actualité des décisions politiques et textes importants ;
6. à terme, une plateforme capable d'agréger Assemblée nationale, Sénat et
   Parlement européen.

Le principe fondamental est : données factuelles officielles d'abord,
intelligence artificielle ensuite. L'IA ne doit jamais inventer un vote, une
position politique, un contenu de loi ou une attribution. Toutes les
informations importantes doivent être traçables jusqu'à leur source primaire.

## 1. Périmètre initial

Commencer par la France et couvrir toute la période Macron à partir de juin
2017. Attention : cela correspond à trois législatures de l'Assemblée
nationale :

- XVe législature : 2017-2022
- XVIe législature : 2022-2024
- XVIIe législature : depuis 2024

Le système doit être capable d'importer et d'unifier les données de ces trois
législatures. Prévoir dès le modèle de données la possibilité d'ajouter
ensuite : Sénat, Parlement européen, Légifrance, Conseil constitutionnel,
éventuellement Gouvernement et textes réglementaires.

## 2. Sources de données

### Assemblée nationale

Utiliser exclusivement les jeux Open Data officiels comme source primaire.
Pour les XVe, XVIe et XVIIe législatures, importer autant que possible :
dossiers législatifs, projets de loi, propositions de loi, textes adoptés,
lois promulguées, scrutins publics, votes individuels des députés, groupes
politiques, députés, mandats, appartenances successives aux groupes,
amendements, auteurs des amendements, sort des amendements, débats
parlementaires, séances, commissions, rapporteurs, différentes lectures d'un
même texte, dates et étapes de la procédure législative.

Utiliser en priorité les exports JSON officiels pour les données structurées.
Utiliser XML lorsque le JSON n'existe pas, notamment pour certains comptes
rendus. Ne jamais scraper des pages HTML lorsqu'une donnée équivalente existe
dans l'Open Data.

### Sénat

Préparer un connecteur vers : DOSLEG pour les dossiers législatifs et
scrutins publics, AMELI pour les amendements, base Sénateurs, comptes rendus,
données Akoma Ntoso des dispositifs des textes. Le Sénat devra devenir une
seconde chambre intégrée au même modèle.

### Légifrance

Utiliser l'API officielle Légifrance via PISTE afin d'obtenir notamment : lois
promulguées, textes consolidés, articles, dates d'entrée en vigueur,
modifications ultérieures, état juridique, identifiants NOR, LEGI, JORF, etc.

La donnée parlementaire doit permettre de comprendre comment un texte a été
élaboré. Légifrance doit permettre de comprendre ce qui est réellement devenu
du droit.

### Parlement européen

Préparer un connecteur utilisant l'Open Data API officielle du Parlement
européen. Prévoir notamment : députés européens, procédures, documents,
textes adoptés, séances, décisions, résultats des votes, votes nominatifs
lorsqu'ils existent.

## 3. Règle absolue sur les votes

Ne jamais inventer le vote individuel d'un parlementaire. Il existe plusieurs
méthodes de vote. Lorsqu'un scrutin public nominatif existe, enregistrer
précisément : POUR, CONTRE, ABSTENTION, NON-VOTANT / ABSENT selon la donnée
officielle.

Lorsqu'un vote a eu lieu à main levée et qu'aucune position nominative n'est
enregistrée : afficher clairement « Vote individuel non disponible : ce vote
n'a pas fait l'objet d'un scrutin public nominatif. »

Ne jamais déduire automatiquement le vote d'un député à partir de la position
de son groupe. Ne jamais transformer une absence en abstention.

## 4. Modèle de données

Construire un modèle relationnel robuste autour au minimum des entités
suivantes : Legislature, Institution, Person, Mandate, PoliticalParty,
ParliamentaryGroup, GroupMembership, LegislativeDossier, LegislativeText,
TextVersion, Law, Reading, Committee, Amendment, AmendmentAuthor, Scrutiny,
Vote, Debate, Speech, Topic, Source, MediaMention, SalienceScore, AISummary,
Quiz, QuizQuestion, QuizAnswer, PoliticalSimilarityResult.

Chaque objet importé doit conserver : source officielle, URL source,
identifiant original, institution, législature, date de récupération, hash
éventuel du document, date de dernière mise à jour. Ne jamais écraser
l'historique.

## 5. Unifier les lois

Le concept central du produit doit être le « dossier politique ». Une même loi
peut produire plusieurs textes, plusieurs lectures, plusieurs centaines ou
milliers d'amendements, plusieurs scrutins, une navette Assemblée/Sénat,
éventuellement une commission mixte paritaire, une décision du Conseil
constitutionnel, une promulgation, des modifications ultérieures.

L'utilisateur ne doit pas avoir à comprendre cette complexité technique. Créer
une page unique par dossier permettant de reconstituer toute la vie du texte.

## 6. Page « wiki » d'une loi

Chaque loi ou dossier important possède une page pédagogique.

**En 30 secondes.** Résumé très simple en 3 à 6 phrases. Répondre à : quel
était le problème ? Qu'est-ce que le texte change ? Qui est principalement
concerné ?

**Ce qui change concrètement.** Présenter les principales mesures sous forme
de cartes simples. Pour chaque mesure : avant, après, personnes concernées,
date d'application si disponible.

**Pourquoi cette loi ?** Résumer le contexte officiel.

**Parcours de la loi.** Timeline : dépôt → commission → Assemblée → Sénat →
navette → éventuelle CMP → adoption définitive → Conseil constitutionnel →
promulgation → entrée en vigueur.

**Qui a voté quoi ?** Afficher le scrutin principal lorsqu'il existe.
Graphique POUR / CONTRE / ABSTENTION, puis répartition par groupe. Permettre
de développer « Voir les députés » pour afficher les votes individuels.

**Les groupes étaient-ils divisés ?** Pour chaque groupe : % pour, % contre, %
abstention, participation. Ne jamais présenter un groupe comme unanimement
favorable si ce n'était pas le cas.

**Amendements importants.** Ne pas afficher par défaut les milliers
d'amendements. Sélectionner les plus significatifs selon : adoption, nombre
de signataires, importance du sujet modifié, existence d'un scrutin public,
couverture médiatique éventuelle.

**Débats.** Résumer les principaux arguments exprimés : arguments favorables,
arguments défavorables. Chaque argument doit être rattaché aux interventions
parlementaires réellement présentes dans les sources. Ne jamais demander à
l'IA d'inventer « ce que les opposants pourraient penser ».

**Sources.** Afficher systématiquement toutes les sources primaires.

## 7. Moteur de recherche « Wikipédia++ »

Créer une recherche globale capable de comprendre des requêtes naturelles.
Exemples : « Quelles lois ont aidé les entreprises à investir ? », « Qu'est-ce
qui a été voté sur les retraites depuis 2017 ? », « Quelles mesures
concernent les propriétaires ? », « Qu'a voté le RN sur l'immigration ? »,
« Quels textes ont modifié l'assurance chômage ? », « Qu'ont voté les
différents groupes sur le nucléaire ? », « Quelles décisions concernent les
infirmiers libéraux ? »

Utiliser : recherche PostgreSQL classique, recherche full-text, embeddings,
pgvector, filtres structurés. Le système RAG doit d'abord récupérer des
documents pertinents puis générer une réponse. Chaque réponse IA doit
comporter des références aux dossiers et votes utilisés. S'il n'y a pas assez
d'informations, dire qu'il n'y a pas assez de données. Ne jamais compléter
avec une supposition.

## 8. Classification thématique

Créer une taxonomie stable. Exemples : économie, entreprises, fiscalité,
travail, retraites, pouvoir d'achat, santé, protection sociale, éducation,
logement, sécurité, justice, immigration, environnement, énergie, agriculture,
transports, numérique, libertés publiques, institutions, défense,
international, Europe.

Une loi peut appartenir à plusieurs thèmes. L'IA peut suggérer les thèmes,
mais les résultats doivent être stockés avec : score de confiance,
justification, possibilité de correction.

## 9. Score d'importance des lois

Toutes les lois ne doivent surtout pas avoir le même poids. Créer un
`salience_score` de 0 à 100. Ne pas appeler ce score « impact réel » car la
couverture médiatique ne mesure pas nécessairement l'impact réel sur la
société. L'appeler « score d'importance publique ». Il combine quatre
dimensions.

**A. Importance institutionnelle : 35 %.** Exemples augmentant le score :
vote sur l'ensemble d'un projet de loi, loi de finances, loi de financement
de la Sécurité sociale, réforme structurelle, vote solennel, texte finalement
promulgué, contrôle constitutionnel important.

**B. Importance médiatique : 35 %.** Mesurer le nombre d'articles parlant du
dossier ou de la loi. Utiliser une source de mesure indépendante telle que
GDELT. Compter prioritairement : nombre d'articles uniques, nombre de médias
français distincts, nombre de jours durant lesquels le texte reste
médiatisé. Utiliser une transformation logarithmique afin qu'un énorme buzz
ne rende pas tous les autres textes insignifiants. Comparer de préférence un
texte aux autres textes de la même année.

**C. Intensité parlementaire : 20 %.** Utiliser notamment : nombre
d'amendements, nombre de scrutins, nombre de séances, nombre d'interventions,
durée du parcours législatif.

**D. Portée : 10 %.** Estimer combien de grands domaines ou populations
semblent concernés. Ce dernier score peut utiliser l'IA mais doit être
identifiable comme une estimation.

Conserver séparément les quatre sous-scores.

## 10. Quiz citoyen

Créer un produit ludique central. Nom provisoire : « Et vous, vous auriez
voté quoi ? »

Principe : présenter des décisions réelles ayant donné lieu à des scrutins
suffisamment exploitables. La question doit être formulée simplement AVANT de
révéler les positions des groupes. Exemple : « Faut-il repousser
progressivement l'âge légal de départ à la retraite ? »

Réponses : POUR, CONTRE, JE M'ABSTIENS, JE NE SAIS PAS / PASSER.

Une fois la réponse donnée : expliquer en quelques lignes le contexte,
montrer ce qui était réellement soumis au vote, afficher ensuite le vote des
groupes, proposer « En savoir plus ».

Ne jamais fabriquer une question qui déforme le contenu réel du scrutin.

## 11. Types de quiz

**Grand quiz politique.** Environ 20 à 30 questions. Choisir principalement
les scrutins possédant les plus gros `salience_score`. Équilibrer les thèmes
afin que 15 questions économiques ne monopolisent pas le résultat.

**Quiz thématiques.** Exemples : « Économie », « Écologie », « Immigration »,
« Santé », « Retraites », « Entreprises », « Pouvoir d'achat », « Libertés
publiques », « Énergie ». Environ 10 à 15 questions.

**Quiz par période.** 2017-2022, 2022-2024, depuis 2024.

**Quiz express.** 5 grandes décisions.

## 12. Calcul de proximité politique

Le résultat ne doit pas dire « Vous devez voter pour X. » Il doit dire « Sur
les scrutins étudiés, vos réponses sont les plus proches des votes observés
de... »

Comparer d'abord l'utilisateur aux groupes parlementaires. Pour chaque
question : récupérer les votes individuels des membres du groupe, calculer la
position réellement observée du groupe, mesurer le degré d'unité du groupe,
comparer la réponse de l'utilisateur à cette distribution.

Exemple : Groupe A : 82 % POUR, 12 % CONTRE, 6 % ABSTENTION. Une réponse POUR
doit produire une forte proximité mais pas être considérée comme une
unanimité. Les groupes très divisés doivent être représentés comme tels.

Pondérer les questions par leur importance, avec un plafonnement pour
empêcher une seule loi de dominer tout le résultat.

Afficher : proximité globale, proximité par thème, questions d'accord,
principaux désaccords, questions auxquelles l'utilisateur n'a pas répondu.

Exemple : Groupe A : 78 %, Groupe B : 69 %, Groupe C : 61 %, Groupe D : 42 %.
Puis : Économie : 84 %, Écologie : 55 %, Santé : 79 %, Immigration : 31 %.

Ajouter clairement : « Ce résultat compare uniquement vos réponses à des votes
parlementaires passés. Il ne constitue pas une recommandation électorale et ne
tient pas compte de l'ensemble des programmes, candidats ou enjeux futurs. »

## 13. Partis vs groupes parlementaires

Attention à ne pas confondre automatiquement parti et groupe parlementaire. Un
groupe peut réunir plusieurs partis, changer de nom, accueillir des
apparentés, évoluer entre deux législatures. Un député peut également changer
de groupe. Le modèle doit donc conserver les appartenances avec dates de
début et de fin.

Les résultats doivent être calculés historiquement avec le groupe auquel le
député appartenait AU MOMENT DU VOTE. Créer éventuellement une couche de
correspondance ParliamentaryGroup → PoliticalParty, mais rendre cette
correspondance transparente et historisée.

## 14. Page d'un groupe politique

Afficher : historique, législatures, membres, thèmes, votes récents, grands
votes, taux d'unité, nombre de votes pour/contre/abstention, dossiers sur
lesquels le groupe était divisé.

Ajouter « Comparez vos opinions à ce groupe », qui lance un quiz construit sur
les scrutins auxquels ce groupe a participé.

## 15. Page d'un parlementaire

Afficher : nom, circonscription, groupe, historique des groupes, mandats,
grands scrutins, votes, amendements, textes cosignés, interventions.

Permettre de rechercher « Comment mon député a-t-il voté sur les retraites ? »
La réponse doit provenir du scrutin nominatif. Si aucun scrutin nominatif
n'existe, le dire explicitement.

## 16. Actualité

Créer une page « En ce moment ». Afficher : textes récemment déposés, textes
récemment adoptés, grands scrutins récents, lois récemment promulguées,
dossiers ayant fortement augmenté en couverture médiatique, débats
parlementaires importants.

Créer un indicateur « Ça fait parler », basé sur l'évolution récente de la
couverture médiatique. Ne pas confondre actualité médiatique et importance
juridique.

## 17. Médias

Pour mesurer la couverture médiatique, privilégier une source ouverte de type
GDELT. Pour chaque dossier : générer plusieurs requêtes basées sur le titre
officiel, identifiant ou numéro lorsque pertinent, nom court reconnu, termes
distinctifs du texte. Éviter les faux positifs.

Stocker : média, URL, titre, date, langue, correspondance avec le dossier,
score de confiance. Ne pas republier le contenu intégral des articles de
presse. Utiliser uniquement les informations autorisées, métadonnées, liens
et courts extraits si leur réutilisation est licite.

## 18. IA et vulgarisation

L'IA sert à : vulgariser les textes, expliquer les termes juridiques, faire
des résumés, identifier les principales mesures, classer les thèmes, générer
des questions de quiz, créer des synonymes pour la recherche, rapprocher les
questions utilisateurs de dossiers pertinents, synthétiser les arguments
exprimés dans les débats.

L'IA ne doit jamais être la source de vérité. Créer deux couches distinctes :
`official_data` et `ai_enrichment`. Une donnée générée par IA ne doit jamais
écraser une donnée officielle.

## 19. Contrôle anti-hallucination

Chaque résumé IA doit conserver la liste des documents ayant servi à le
produire. Créer un système de citations.

Une affirmation importante telle que « Cette loi repousse l'âge légal à... »
doit pouvoir renvoyer au texte correspondant. Une affirmation telle que « Le
groupe X a voté contre » doit renvoyer au scrutin. Une affirmation telle que
« Le député Y a voté pour » doit obligatoirement provenir d'un vote nominatif.
Si les données sont ambiguës, afficher l'ambiguïté.

## 20. Design

Je veux un site politique, mais absolument pas un design partisan. Style :
moderne, très lisible, pédagogique, grand public, rassurant, un peu ludique,
mobile-first, accessible.

Éviter les codes graphiques trop directement associés aux partis politiques.
Utiliser des couleurs neutres pour l'interface. Utiliser les couleurs
politiques uniquement lorsqu'elles servent à identifier clairement les
groupes, accompagnées de leur nom.

Inspirations conceptuelles : Wikipédia pour la profondeur, Duolingo pour le
côté ludique des quiz, Google pour la recherche, Our World in Data pour la
rigueur, les applications de résultats électoraux pour les visualisations.

## 21. Homepage

Créer une homepage donnant immédiatement trois possibilités.

« Je veux comprendre » : moteur de recherche, « Posez une question sur les
décisions politiques depuis 2017 ».

« Je veux me tester » : carte « Quel groupe parlementaire vote le plus souvent
comme vous ? », bouton « Faire le quiz ».

« Je veux voir ce qui se passe » : actualité (grandes décisions récentes,
textes en discussion, votes récents, dossiers qui font parler).

Ajouter plus bas « Les grandes décisions depuis 2017 » avec des cartes
représentant les lois ayant les plus hauts scores d'importance.

## 22. Architecture technique

Proposition par défaut :

- Frontend : Next.js, TypeScript, React, Tailwind, shadcn/ui.
- Backend : API Next.js ou service dédié, PostgreSQL, Supabase possible.
- Recherche : PostgreSQL Full Text Search, pgvector pour recherche
  sémantique.
- IA : architecture provider-agnostic, embeddings, génération structurée
  JSON, RAG.
- Ingestion : scripts idempotents, téléchargement des archives ZIP,
  vérification hash, parsing JSON/XML, normalisation, upsert, logs,
  statistiques d'import.

Créer une architecture permettant de relancer l'import sans créer de
doublons.

Note d'écart assumé : l'équipe a choisi Mantine plutôt que shadcn/ui pour
l'interface (voir [AGENTS.md](../AGENTS.md)), et TanStack Start plutôt que
Next.js. Le reste de cette section reste la cible.

## 23. Synchronisation

Distinguer historique (XVe et XVIe législatures : import complet une fois,
puis données considérées comme archivées) et législature actuelle (XVIIe :
synchronisation quotidienne).

Créer un job planifié qui : vérifie si les sources ont changé, télécharge
uniquement si nécessaire, importe les nouvelles données, met à jour les
agrégats, recalcule les nouveaux scores, enrichit uniquement les nouveaux
contenus avec l'IA.

## 24. Performance

Ne jamais envoyer l'intégralité des datasets parlementaires à un LLM. Parser
et structurer d'abord. Utiliser SQL pour : filtres, agrégations, statistiques,
relations, votes. Utiliser l'IA seulement sur les sous-ensembles pertinents.

## 25. MVP

Construire d'abord un MVP réellement fonctionnel. Il doit comprendre :

1. import XVe + XVIe + XVIIe législatures ;
2. dossiers législatifs ;
3. scrutins publics ;
4. votes individuels ;
5. députés et groupes ;
6. pages loi ;
7. moteur de recherche ;
8. classification thématique ;
9. score d'importance ;
10. grand quiz ;
11. quiz thématiques ;
12. résultat de proximité ;
13. homepage ;
14. page actualité ;
15. citations vers les sources officielles.

Ne pas bloquer le MVP sur l'intégration complète du Sénat ou de l'Europe.
Préparer seulement les interfaces/connecteurs correspondants.

## 26. Phase 2

Après validation du MVP : intégrer complètement le Sénat, reconstruire la
navette Assemblée ↔ Sénat, intégrer Légifrance, intégrer décisions du Conseil
constitutionnel, ajouter les textes réglementaires, ajouter le Parlement
européen, comparer votes français et européens, ajouter alertes et suivi de
thèmes, ajouter comptes utilisateurs.

## 27. Exigence de transparence

Créer une page « Comment ça marche ? » Elle doit expliquer : quelles données
sont utilisées, quelles données sont officielles, ce qui est produit par IA,
comment les scores sont calculés, comment fonctionne le quiz, pourquoi
certains votes individuels sont inconnus, différence entre groupe
parlementaire et parti, comment est calculé le score d'importance médiatique,
limites méthodologiques du produit.

Publier les formules de scoring. Aucune boîte noire sur le calcul de
proximité politique.

## 28. Première étape de développement

Ne commence pas par coder arbitrairement les écrans. Commence par :

1. analyser les formats réels des datasets officiels ;
2. télécharger un échantillon de chacune des trois législatures ;
3. documenter les identifiants et relations entre dossiers, textes, scrutins,
   députés et groupes ;
4. proposer le modèle PostgreSQL ;
5. créer les scripts d'import ;
6. importer un échantillon ;
7. vérifier manuellement plusieurs lois connues et leurs votes ;
8. seulement ensuite construire les pages.

Créer dans le repository un fichier `docs/DATA_SOURCES.md` contenant toutes
les sources, formats, fréquences de mise à jour et règles d'import. Créer
également `docs/DATA_MODEL.md`, `docs/SCORING.md`, `docs/QUIZ_METHODOLOGY.md`,
`docs/AI_GUARDRAILS.md`.

État au 13/09/2026 : `DATA_SOURCES.md`, `DATA_MODEL.md` et `PIPELINE.md`
existent. `SCORING.md`, `QUIZ_METHODOLOGY.md` et `AI_GUARDRAILS.md` restent à
créer.

## 29. Critère de réussite

À terme, un utilisateur non spécialiste doit pouvoir poser « Qu'est-ce qui a
vraiment été voté sur les retraites depuis Macron ? » et obtenir en quelques
secondes : les différents textes concernés, ce qu'ils ont changé, la
chronologie, les principaux votes, qui a voté pour et contre lorsque cette
information existe, les sources officielles, une explication compréhensible
sans connaissances juridiques.

Et il doit pouvoir ensuite cliquer « Et moi, j'aurais voté quoi ? » pour
transformer ces mêmes données réelles en expérience pédagogique et ludique.

La priorité absolue est donc : rendre les décisions politiques
compréhensibles sans les déformer.
