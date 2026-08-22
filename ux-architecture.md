# Architecture UX Android — Wallet Manager

> Document de référence pour l’audit de la version web.
>
> État de la preuve au 22 août 2026 : analyse statique du code Expo Router. Aucun parcours Android n’a été exécuté sur appareil ou émulateur pendant cette passe. Les comportements runtime sont donc marqués `Non vérifié` lorsqu’ils ne sont pas directement garantis par le code.

## 1. Périmètre et méthode

### Source Android active

L’application est une application Expo/React Native. Android ne possède pas un arbre Kotlin/XML distinct : l’interface active est composée de routes Expo Router et de composants React Native, avec quelques branches `Platform.OS === "android"` ou `Platform.OS !== "web"`.

La navigation Android active est définie principalement par :

- `src/app/_layout.tsx` : initialisation, verrouillage, onboarding, splash, pile racine ;
- `src/app/(tabs)/_layout.tsx` : onglets et barre de navigation ;
- `src/app/(tabs)/(dashboard)/index.tsx` : Accueil ;
- `src/app/(tabs)/(transactions)/index.tsx` : Activité ;
- `src/app/(tabs)/(plans)/index.tsx` : Planification ;
- `src/app/(tabs)/(accounts)/index.tsx` : Comptes ;
- `src/app/(tabs)/(statistics)/index.tsx` : Statistiques ;
- `src/app/(tabs)/(settings)/index.tsx` : Réglages.

Les routes `src/app/app/*` constituent un ancien arbre fonctionnel encore présent dans le dépôt. Elles ne sont pas la destination initiale actuelle d’Android et sont documentées plus bas comme legacy, afin de ne pas les confondre avec l’architecture active.

### Règle de preuve

- `Code` : comportement déduit directement du code source.
- `Code + Runtime` : comportement confirmé par le code et une exécution réelle.
- `Runtime` : observation faite à l’exécution.
- `Non vérifié` : comportement qui nécessiterait un appareil, un émulateur, des données ou une interaction non disponible pendant l’analyse.

Niveau de confiance : `Élevé` pour une structure explicitement codée, `Moyen` pour une intention déduite du contenu et `Faible` pour une hypothèse non testée.

## 2. Arbre global Android

```text
Lancement Android
├── Splash natif, minimum 800 ms
├── Initialisation locale SQLite, verrouillage et sécurité écran
├── Onboarding si aucun compte / onboarding incomplet
│   ├── Création du premier compte
│   └── Premier mouvement facultatif
├── Cloud welcome si l’onboarding est terminé et non présenté
│   ├── Créer un compte cloud
│   └── Continuer sans compte
└── Shell principal
    ├── Accueil
    ├── Activité
    ├── Planification
    ├── Comptes
    ├── Statistiques
    └── Réglages, accessible par l’action d’en-tête / les routes secondaires
```

La barre Android expose les onglets `Accueil`, `Activité`, `Planification`, `Comptes` et `Statistiques`. `Réglages` est enregistré comme onglet sans item visible (`href: null`) et sert de destination secondaire accessible depuis les écrans concernés.

## 3. Flux de démarrage et états transversaux

### Splash et préparation

**Source :** `src/app/_layout.tsx`

#### Layout

Le layout racine installe `SafeAreaProvider`, les providers cloud, synchronisation, thème et devise, puis rend un `Stack`. Le `StatusBar` reprend la couleur de fond du thème. Le splash est maintenu au moins 800 ms.

#### Contenu

Pendant la préparation Android, aucun contenu applicatif n’est rendu (`null`). La base locale, les réglages d’onboarding, le verrouillage, les récurrences dues et la santé de démarrage sont préparés avant l’accès à l’application.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Splash | Éviter d’afficher une interface partiellement prête | Reste visible au minimum 800 ms ; disparaît quand le layout est prêt. `Code`, confiance élevée. |
| Status bar | Maintenir la lisibilité et la continuité visuelle | Passe en contenu clair/sombre selon le thème et reprend le fond de l’écran. `Code`, confiance élevée. |
| Routeur initial | Amener l’utilisateur au prochain état utile | Redirige vers `/onboarding`, `/cloud-welcome` ou `/(tabs)/(dashboard)`. `Code`, confiance élevée. |
| Sécurité écran | Protéger les données financières | `applyScreenSecurity()` est appelé hors web. L’effet réel sur un appareil Android est `Non vérifié`. |
| Verrouillage global | Empêcher l’accès aux données sans authentification locale | `LockScreen` est superposé lorsque le statut n’est pas `unlocked`. `Code`, confiance élevée ; rendu natif `Non vérifié`. |

### Verrouillage

**Source :** `src/components/lock-screen.tsx`, `src/components/pin-keypad.tsx`, `src/state/lock.ts`

#### Layout

Écran plein écran superposé : icône Wallet, titre, sous-titre, message d’erreur éventuel, points de saisie PIN, pavé numérique 3×4, authentification biométrique éventuelle et lien `Code oublié ?`.

#### Contenu

- `Wallet verrouillé` ;
- `Déverrouillez avec votre empreinte ou votre code.` ou `Saisissez votre code pour déverrouiller.` ;
- six points de PIN ;
- chiffres `1` à `9`, `0`, effacement ;
- `Utiliser l’empreinte` si disponible ;
- `Code oublié ?`.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Points PIN | Donner un retour discret sur la progression | Un point se remplit par chiffre saisi. `Code`, confiance élevée. |
| Pavé numérique | Saisir le code sans clavier système | Ajoute un chiffre ; le bouton effacer retire le dernier ; effacement désactivé si vide. `Code`, confiance élevée. |
| Empreinte | Déverrouiller plus rapidement | Lance l’authentification biométrique si disponible. Résultat Android `Non vérifié`. |
| Code oublié | Récupérer l’accès | Lance le flux de récupération défini par le store local. Parcours runtime `Non vérifié`. |
| Erreur | Comprendre pourquoi le déverrouillage échoue | Affiche un message avec rôle `alert`. `Code`, confiance élevée. |

### Barre de navigation

**Source :** `src/app/(tabs)/_layout.tsx`, `src/components/wallet-tab-bar.tsx`

#### Layout

Une navigation Tabs sans header de route. Sur Android, `WalletTabBar` remplace la barre par défaut. Elle conserve la zone réservée par Expo Router et affiche les onglets visibles, avec un indicateur de sélection en capsule animé.

#### Contenu et comportements

- `Accueil` → `/(tabs)/(dashboard)` ;
- `Activité` → `/(tabs)/(transactions)` ;
- `Planification` → `/(tabs)/(plans)` ;
- `Comptes` → `/(tabs)/(accounts)` ;
- `Statistiques` → `/(tabs)/(statistics)` ;
- `Réglages` est une route de stack secondaire, non affichée dans la barre.

Chaque item est pressable et accessible. L’indicateur Android est décoratif (`pointerEvents="none"`), calculé selon la largeur utilisable et animé avec la motion standard. Le respect du mode réduction des animations est prévu par le code ; rendu réel `Non vérifié`.

## 4. Écrans principaux

### Accueil

**Route :** `/(tabs)/(dashboard)`  
**Source :** `src/app/(tabs)/(dashboard)/index.tsx`

#### Layout

Un `ScrollView` vertical avec rafraîchissement, safe area et sections empilées :

```text
Accueil
├── Bannière de synchronisation conditionnelle
├── Promotion cloud conditionnelle
├── En-tête / résumé de situation
├── Carte Dépenses sûres
├── Statistiques synthétiques
├── Budgets et progression
├── Objectifs / épargne
├── Activité récente groupée par jour
├── Échéances à venir
└── FAB Ajouter une opération
```

#### Contenu

Les données sont calculées depuis SQLite : disponibilité sûre à dépenser, comptes, objectifs, budgets, règles d’épargne, transactions du mois, activité récente, échéances et comparaison avec le mois précédent. Les montants sont convertis dans la devise de référence.

Les cartes de synthèse utilisent les libellés financiers du produit, notamment `Disponible`, `Dépenses`, `Budgets`, `Objectifs`, `Épargne` et les dates groupées par jour. Les valeurs et sections sont conditionnelles aux données présentes.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Bannière sync | Signaler un blocage, conflit, synchronisation ou attente | Affiche vérification email, conflits, progression, erreur ou modifications hors ligne ; ouvre le compte, les conflits ou relance la sync. `Code`, confiance élevée. |
| Promotion cloud | Faire découvrir la synchronisation sans imposer un compte | `Activer` ouvre `/cloud-welcome`, `Plus tard` et fermer masquent la carte et enregistrent le choix. `Code`, confiance élevée. |
| Carte Dépenses sûres | Répondre à la question « combien puis-je dépenser ? » | Affiche le calcul issu des revenus, dépenses, engagements et réserves ; ouvre le détail cashflow. Formule couverte par les tests métier ; rendu `Non vérifié`. |
| Cartes statistiques | Comprendre rapidement la situation du mois | Montants et variations dans la devise de référence ; éléments accessibles comme résumé. `Code`, confiance élevée. |
| Budget / progression | Voir les dépassements et la marge disponible | Barre de progression et couleur financière ; ouvre la planification ou le budget. `Code`, confiance élevée. |
| Transactions récentes | Revenir aux mouvements importants | Groupées par jour ; une ligne ouvre le détail transaction. `Code`, confiance élevée. |
| Échéances | Anticiper les mouvements futurs | Liste limitée des prochaines occurrences ; ouvre le détail concerné. `Code`, confiance élevée. |
| FAB | Ajouter une opération depuis n’importe quelle position | Ouvre le menu d’ajout. Positionnement dépend de la safe area et de la barre ; rendu `Non vérifié`. |
| Pull to refresh | Actualiser les données après une modification ou une sync | Recharge SQLite et les calculs ; état `refreshing` visible. `Code`, confiance élevée. |

### Activité

**Route :** `/(tabs)/(transactions)`  
**Source :** `src/app/(tabs)/(transactions)/index.tsx`

#### Layout

Écran de liste scrollable : en-tête de période et filtres, états de chargement/erreur/vide, groupes de transactions par jour, lignes de transaction et action flottante d’ajout. La recherche est une route secondaire `/(tabs)/(transactions)/search`.

#### Contenu

Transactions locales avec date, libellé, catégorie, type, compte, montant et éventuels éléments de répartition ou remboursement. Les filtres couvrent notamment la période, le type, le compte, la catégorie et les montants selon l’état du code.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Filtres | Réduire une liste financière volumineuse | Modifie les critères et recharge la liste ; validation des bornes de dates et montants. `Code`, confiance élevée. |
| Recherche | Retrouver un mouvement par texte | Route dédiée ; champ et résultats filtrés. Parcours runtime `Non vérifié`. |
| Groupe de jour | Comprendre la chronologie | Regroupe les lignes par date lisible. `Code`, confiance élevée. |
| Ligne transaction | Identifier et ouvrir un mouvement | Pression → `/transaction-detail`; affiche montant et sens financier avec couleurs dédiées. `Code`, confiance élevée. |
| État vide | Savoir quoi faire lorsqu’il n’y a aucun mouvement | `EmptyState` propose de créer la première transaction. `Code`, confiance élevée. |
| Erreur / retry | Récupérer une liste non chargée | `ScreenState` affiche l’erreur et relance la ressource. `Code`, confiance élevée. |
| FAB | Ajouter rapidement un mouvement | Ouvre `new-transaction`. `Code`, confiance élevée. |

### Planification

**Route :** `/(tabs)/(plans)`  
**Source :** `src/app/(tabs)/(plans)/index.tsx`

#### Layout

Scroll vertical organisé en trois blocs : `Ce mois`, `À construire`, `À automatiser`, précédés d’un snapshot des engagements actifs.

```text
Planification
├── Snapshot engagements actifs
├── Ce mois
│   └── Budgets visibles / créer un budget
├── À construire
│   ├── Objectifs
│   └── Épargne automatique
└── À automatiser
    ├── Transactions récurrentes
    ├── Analyses
    └── Calendrier
```

#### Contenu

Le snapshot affiche le nombre d’éléments actifs, le montant restant à réserver et le nombre de budgets dépassés. Les lignes affichent un titre et un détail calculé : nombre d’objectifs, montant réservé, règles d’épargne, échéances à valider, règles récurrentes ou description d’action.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Snapshot | Obtenir une vue de direction financière | Agrège budgets, objectifs, épargne et récurrences ; couleurs pour état à jour/dépassé. `Code`, confiance élevée. |
| Budget | Fixer et suivre un plafond | Affiche les quatre premiers budgets, leur montant et progression ; lien vers `/budgets`. `Code`, confiance élevée. |
| Objectifs | Donner une date et un montant à un projet | Ouvre `/goals`. `Code`, confiance élevée. |
| Épargne automatique | Automatiser une réserve | Ouvre `/savings`. `Code`, confiance élevée. |
| Récurrences | Ne plus ressaisir les mouvements prévisibles | Ouvre `/recurring`; indique les échéances à valider. `Code`, confiance élevée. |
| Analyses | Comparer les périodes | Ouvre les statistiques. `Code`, confiance élevée. |
| Calendrier | Comprendre les règles de semaine et dates | Ouvre `/calendar-settings`. `Code`, confiance élevée. |
| État d’erreur | Relancer le chargement des plans | `ScreenState` avec retry. `Code`, confiance élevée. |

### Comptes

**Route :** `/(tabs)/(accounts)`  
**Source :** `src/app/(tabs)/(accounts)/index.tsx`

#### Layout

`SectionList` verticale, sans headers collants :

```text
Comptes
├── Actions header : Réglages, Objectifs, Ajouter
├── Carte Patrimoine
│   ├── Actifs
│   ├── Passifs
│   ├── Solde net
│   └── Disponible
├── En-tête Comptes + Organiser
├── Filtre comptes masqués conditionnel
├── Sections par groupe
│   └── Ligne compte + actions
└── Organisation
    └── Groupes de comptes
```

Un formulaire de création s’ouvre dans une modal/bottom sheet. Une pression longue sur un compte ouvre les actions de gestion.

#### Contenu

Chaque compte affiche son nom, son statut masqué éventuel, son montant `Disponible`, sa devise, l’équivalent dans la devise de référence et, si nécessaire, le `Solde` distinct des réserves. La carte de patrimoine distingue `Actifs`, `Passifs`, `Solde net` et `Disponible`.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Carte Patrimoine | Comprendre le patrimoine sans confondre disponibilité et solde | Calcule actifs, passifs, solde net et disponible ; l’affichage est codé, la compréhension utilisateur reste à auditer. `Code`, confiance élevée. |
| Compte | Consulter un compte | Pression → `/accounts/[id]`; pression longue → actions. `Code`, confiance élevée. |
| Actions compte | Gérer rapidement un compte | Menu d’actions pour modifier, masquer ou supprimer selon le code. Runtime `Non vérifié`. |
| Comptes masqués | Réduire le bruit tout en gardant l’accès | Bouton affiche/masque les comptes masqués et expose un état sélectionné. `Code`, confiance élevée. |
| Organiser | Accéder à la gestion avancée | Ouvre `accounts-management`. `Code`, confiance élevée. |
| Ajouter un compte | Commencer le suivi ou compléter ses comptes | Ouvre une sheet avec nom, devise, solde initial et options du compte. Validation et erreur sont codées ; clavier/rendu `Non vérifiés`. |
| État vide | Comprendre comment démarrer | Invite à créer le premier compte. `Code`, confiance élevée. |

### Statistiques

**Route :** `/(tabs)/(statistics)`  
**Source :** `src/app/(tabs)/(statistics)/index.tsx`

#### Layout

Scroll vertical avec sélecteur de période, résumé de dépenses et recettes, graphiques et sections analytiques. Les composants réutilisés comprennent notamment `MonthlyBars`, `LabeledDonutChart` et les helpers de statistiques.

#### Contenu

Montants par période et par catégorie, comparaison de périodes, distribution des dépenses et indicateurs d’épargne. Les valeurs sont converties selon la devise de référence.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Sélecteur de période | Choisir la période à analyser | Modifie la fenêtre de calcul ; interaction runtime `Non vérifiée`. |
| Résumé | Savoir combien est entré et sorti | Affiche les agrégats de la période. `Code`, confiance élevée. |
| Barres mensuelles | Comparer rapidement les périodes | Graphique de revenus/dépenses ; lecture exacte et accessibilité runtime `Non vérifiées`. |
| Donut catégories | Identifier les postes dominants | Répartition par catégorie ; interaction éventuelle documentée par composant. `Code`, confiance moyenne. |
| État vide/erreur | Comprendre l’absence de données ou relancer | Utilise les états communs. `Code`, confiance élevée. |

## 5. Création et détail des transactions

### Nouvelle transaction

**Route :** `/new-transaction`  
**Source :** `src/app/new-transaction.tsx`

#### Layout

Écran présenté en modal par le Stack racine. Formulaire scrollable et adapté au clavier, composé d’un choix de type, de champs financiers, de compte, catégorie, date, note, répartition éventuelle, remboursement et justificatifs selon le mode.

#### Contenu

Les types principaux sont dépense, revenu et transfert. Les valeurs affichées incluent le montant, la devise du compte, la date, le compte source, la catégorie, le compte destination pour un transfert, les frais éventuels, la note et les pièces jointes.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Type de transaction | Décrire le sens du mouvement | Sélectionne dépense/revenu/transfert et adapte les champs. `Code`, confiance élevée. |
| Montant / devise | Enregistrer une valeur correcte | Saisie numérique ; validation montant positif et format. `Code`, confiance élevée. |
| Compte / catégorie | Rattacher le mouvement au bon contexte | Sélecteurs ; erreurs si obligatoire absent. `Code`, confiance élevée. |
| Date | Placer le mouvement dans le temps | Sélecteur de date ; comportement plateforme `Non vérifié`. |
| Répartition | Affecter une dépense à plusieurs catégories | Ajout, modification et validation du total exact. `Code`, confiance élevée. |
| Remboursement | Suivre une dépense avancée par un tiers | Active le contexte de remboursement ; règlement via écran dédié. `Code`, confiance moyenne. |
| Justificatifs | Conserver une preuve du mouvement | Sélection d’image/PDF selon les actions ; erreurs signalées par alerte. `Code`, confiance élevée. |
| Enregistrer | Persister le mouvement et revenir au contexte | Écrit dans SQLite puis revient. Succès runtime `Non vérifié`. |

### Détail d’une transaction

**Route :** `/transaction-detail`  
**Source :** `src/app/transaction-detail.tsx`

#### Layout

Stack screen avec montant et métadonnées en tête, sections `Répartition`, `Remboursements` et `Justificatifs`, actions d’édition et de suppression de justificatif.

#### Contenu et comportements

- affiche montant, type, date, note et catégorie ;
- affiche les répartitions avec catégorie et montant ;
- affiche les remboursements restants et permet d’enregistrer un règlement ;
- permet d’ajouter une image ou un PDF ;
- permet de supprimer un justificatif après confirmation ;
- ouvre `/new-transaction` en mode édition.

État absent : `Transaction introuvable.`. Les erreurs de fichiers sont présentées par alerte. `Code`, confiance élevée ; parcours runtime `Non vérifié`.

## 6. Onboarding et cloud

### Onboarding

**Route :** `/onboarding`  
**Source :** `src/app/onboarding.tsx`

#### Layout

Écran sans header, contenu centré et scrollable, indicateur `Étape 1 sur 2` ou `Étape 2 sur 2`, logo, titre, formulaire du premier compte puis premier mouvement facultatif.

#### Contenu

- `BIENVENUE DANS WALLET` ;
- `Votre argent, simplement.` ;
- nom du compte ;
- devise de référence ;
- résumé du premier compte ;
- type, montant et catégorie du premier mouvement ;
- `Ajouter la transaction` ou `Je le ferai plus tard` ;
- `Vos données restent sur votre appareil.`

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Étape 1 | Créer le contexte minimal | Valide nom et devise, crée le compte, puis passe à l’étape du mouvement. `Code`, confiance élevée. |
| Modifier | Corriger le premier compte | Revient à l’étape précédente. `Code`, confiance élevée. |
| Étape 2 | Ajouter immédiatement un premier repère financier | Choix type, montant et catégorie ; ajout ou report. `Code`, confiance élevée. |
| Progression | Comprendre la longueur du démarrage | Indicateur accessible sur deux étapes. `Code`, confiance élevée. |
| Fin | Accéder à l’application | Marque l’onboarding terminé puis dirige vers cloud welcome ou Accueil. Runtime `Non vérifié`. |

### Bienvenue cloud

**Route :** `/cloud-welcome`  
**Source :** `src/app/cloud-welcome.tsx`

#### Layout et contenu

Écran d’introduction sans compte : logo, eyebrow, titre `Vos données, où que vous soyez.`, bénéfices de la synchronisation, action primaire `Créer un compte`, secondaire `Continuer sans compte`, note d’accès ultérieur depuis les réglages.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Bénéfices cloud | Comprendre la valeur avant inscription | Présente les avantages téléphone/PC. Statique, confiance élevée. |
| Créer un compte | Activer la synchronisation | Ouvre `/cloud-account`. `Code`, confiance élevée. |
| Continuer sans compte | Préserver le mode local-first | Marque l’écran comme vu et ouvre les onglets. `Code`, confiance élevée. |

### Compte et synchronisation

**Route :** `/cloud-account`  
**Source :** `src/app/cloud-account.tsx`

#### Layout

Stack screen scrollable avec modes connexion/inscription, récupération de mot de passe, compte connecté, vérification email, synchronisation, conflits, sessions et suppression du compte.

#### Contenu et comportements

- mode local ou compte connecté ;
- inscription et connexion email/mot de passe ;
- vérification email et renvoi ;
- synchronisation maintenant / chargement cloud ;
- liste des sessions avec révocation ;
- demande de réinitialisation de mot de passe ;
- programmation de suppression du compte ;
- déconnexion.

Les messages de succès et d’erreur sont affichés dans le formulaire. Les appels réseau et la parité interactive web sont `Non vérifiés` dans ce document.

## 7. Réglages et gestion des données

### Réglages

**Route :** `/(tabs)/(settings)`  
**Source :** `src/app/(tabs)/(settings)/index.tsx`

#### Layout

ScrollView avec introduction puis sections de lignes pressables regroupées par besoin. Les sections couvrent comptes, apparence, calendrier, devise, données, sécurité, cloud, confidentialité et à propos.

#### Contenu et éléments UI

Chaque ligne possède un libellé, une description éventuelle et une navigation vers sa route. Le besoin principal est de regrouper les actions de configuration sans encombrer les onglets principaux.

| Route | Fonction |
|---|---|
| `/accounts-settings` ou routes de gestion | Organiser les comptes et groupes |
| `/appearance` | Thème clair/sombre/système |
| `/calendar-settings` | Premier jour de semaine |
| `/currency-settings` | Devise de référence et taux |
| `/data-management` | Export, restauration, import, sync |
| `/security` | Code, biométrie, capture écran |
| `/cloud-account` | Compte et appareils |
| `/privacy-policy` | Politique de confidentialité |
| `/about` | Version, informations, diagnostics |

### Gestion des comptes

**Routes :** `/accounts-settings`, `/(tabs)/(settings)/accounts-management`, `/(tabs)/(settings)/account-groups`  
**Sources :** fichiers correspondants dans `src/app/(tabs)/(settings)/`

#### Comptes — point d’entrée

Deux lignes : `Groupes de comptes` et `Gestion des comptes`. Chaque ligne navigue vers un écran spécialisé.

#### Gestion des comptes

Liste organisée par groupe, comptes actifs et comptes supprimés. Chaque compte peut être ouvert, modifié ou affecté à un autre groupe. Les comptes supprimés proposent `Restaurer`. L’affectation ouvre une modal avec les options `Sans groupe` et les groupes existants.

#### Groupes de comptes

Liste de groupes avec nombre de comptes. Fonctions : ajouter, renommer, supprimer avec confirmation, restaurer les groupes supprimés, affecter des comptes et réordonner par glisser-déposer. Les formulaires signalent les noms vides et les erreurs de persistance.

### Données

**Route :** `/data-management`  
**Source :** `src/app/data-management.tsx`

#### Layout et contenu

ScrollView de cartes séparées : synchronisation cloud, état/dernière synchronisation, sauvegardes, restauration et import. Les actions sont explicites : `Activer la synchronisation`, `Synchroniser maintenant`, `Voir les conflits`, `Exporter une sauvegarde chiffrée`, export SQLite non chiffré avec avertissement, restauration et import CSV.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| État sync | Savoir si les données sont à jour | Affiche statut, compteurs et conflits ; relance la synchronisation. |
| Export chiffré | Transporter une copie protégée | Ouvre le flux mot de passe puis partage le fichier. |
| Export en clair | Interopérer avec un outil externe | Demande une confirmation destructive et avertit du risque. |
| Restaurer/importer | Reconstituer ou compléter les données | Sélectionne, prévisualise, confirme puis affiche un rapport. |

Les opérations potentiellement irréversibles ou sensibles utilisent des confirmations. La création du fichier, le partage et le résultat réel d’export Android nécessitent une validation runtime distincte.

### Sauvegarde export / restauration

**Routes :** `/backup-export`, `/backup-restore`  
**Sources :** fichiers correspondants dans `src/app/`

#### Layout et contenu

Les deux écrans sont présentés comme modales. Export : saisie/confirmation du mot de passe, état de préparation, création du fichier chiffré et partage. Restauration : sélection d’un fichier, mot de passe, validation du format, remplacement/import et erreur.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Mot de passe | Protéger ou ouvrir la sauvegarde | Vérifie présence et correspondance avant traitement. |
| Progression | Comprendre qu’un fichier est en préparation | Désactive les actions concurrentes jusqu’au résultat. |
| Partage | Sortir le fichier de l’application | Utilise le partage système et affiche le nom/résultat. |
| Erreur de format | Éviter une restauration invalide | Bloque l’application et explique l’action corrective. |

### Apparence, calendrier et devise

**Sources :** `/appearance`, `/calendar-settings`, `/currency-settings`

- `Apparence` : sélection du thème ; le changement affecte le provider global.
- `Calendrier` : choix du premier jour de semaine ; explique l’impact sur le calendrier.
- `Devises` : sélection de la devise de référence, explication des conversions, actualisation des taux et confirmation après sauvegarde.

Chaque écran est un Stack screen avec header compact et contenu scrollable. Les contrôles et messages d’erreur/succès sont codés ; rendu Android `Non vérifié`.

### Sécurité

**Route :** `/security`  
**Source :** `src/app/security.tsx`

Regroupe le code PIN, la biométrie, la protection de capture et les actions de sécurité. Les contrôles sont conditionnels aux capacités natives et utilisent confirmations/alertes pour les changements sensibles. L’effet réel de la protection d’écran et de la biométrie reste `Non vérifié`.

### Diagnostics et à propos

**Routes :** `/about`, `/diagnostics`

`À propos` affiche le logo, la version, le timestamp de build, les informations produit et un lien vers les diagnostics. `Diagnostics` expose les informations utiles à la résolution de problèmes et l’état de la base/services. Ces écrans servent principalement à la transparence et au support, pas à la navigation financière quotidienne.

### Confidentialité

**Route :** `/privacy-policy`

Écran documentaire scrollable présentant la politique de confidentialité. Aucun comportement métier complexe n’est attendu ; lisibilité, navigation arrière et compatibilité responsive devront être vérifiées côté web.

## 8. Plans et écrans secondaires métier

### Budgets

**Route :** `/budgets/index`  
#### Layout

ScrollView de sections et cartes de budget ; chaque carte juxtapose catégorie, période, consommé, plafond et progression. Une action d’ajout reste accessible depuis l’en-tête ou l’état vide.

#### Contenu

Budgets actifs, périodes calculées, montants consommés, plafond, rollover éventuel, états vide/chargement/erreur.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Carte budget | Savoir où se situe une dépense par rapport à un plafond | Affiche progression et montants ; ouvre création/édition. |
| Période | Comprendre la fenêtre de calcul | Sélectionne ou affiche le mois/période actif ; recalcule les consommés. |
| Ajouter | Créer un plafond métier | Ouvre le formulaire avec catégorie, montant et options de rollover. |
| État vide/erreur | Commencer ou relancer | Propose la création ou le rechargement. |

### Objectifs

**Routes :** `/goals/index`, `/goals/new`, `/goals/[id]`, `/goals/[id]/edit`

#### Layout et contenu

Liste scrollable d’objectifs actifs/terminés, puis écran de détail avec progression, réserves, montant restant et date cible. Le formulaire est scrollable et regroupe identité, cible, date, image/lien et actions de clôture/suppression.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Carte objectif | Voir l’avancement d’un projet | Affiche nom, progression, cible, réservé et statut ; ouvre le détail. |
| Réservation | Mettre une somme à l’abri d’une dépense courante | Associe un montant à un compte source ; peut être libérée selon les règles métier. |
| Formulaire | Définir ou modifier une cible | Valide nom, montant positif et date ; sauvegarde ou affiche une erreur. |
| Clôturer/supprimer | Terminer ou retirer un objectif | Demande confirmation lorsque l’action peut modifier les réserves. |

Les formulaires utilisent une surface scrollable adaptée au clavier. Les validations métier sont codées dans les services et tests ; interaction runtime `Non vérifiée`.

### Épargne

**Routes :** `/savings/index`, `/savings/history`

#### Layout et contenu

Liste de règles avec pourcentage, catégorie de revenus, statut actif/inactif et option de retrait du disponible ; écran historique regroupant les contributions par période.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Règle d’épargne | Automatiser une intention de réserve | Affiche le pourcentage et la catégorie ; permet activation/modification. |
| Disponible | Comprendre l’impact de la règle | Indique si la règle est retirée du disponible estimé ou seulement informative. |
| Historique | Vérifier ce qui a été mis de côté | Liste les contributions calculées et leur période. |
| État vide | Découvrir l’action utile | Invite à créer une première règle. |

### Transactions récurrentes

**Routes :** `/recurring/index`, `/recurring/form`

#### Layout et contenu

Liste de règles récurrentes avec type, montant, compte, fréquence, prochaine échéance et statut ; formulaire scrollable pour création/édition. Le formulaire couvre type, montant, frais, compte, catégorie, destination, intervalle, dates, activation, mode d’approbation et note.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Ligne récurrente | Anticiper un mouvement régulier | Affiche prochaine échéance et statut ; ouvre le formulaire. |
| Fréquence/intervalle | Décrire la répétition | Calcule les occurrences futures et valide un intervalle positif. |
| Mode d’approbation | Garder le contrôle sur une échéance | Une occurrence due devient une proposition à approuver selon le mode. |
| Activer/désactiver | Suspendre sans perdre la règle | Change le statut et exclut/inclut les futures occurrences. |

### Catégories

**Route :** `/categories/[type]`

#### Layout et contenu

Liste filtrée par type `expense` ou `income`, avec icône, nom et actions d’édition/suppression ; formulaire ou modal de création/édition.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Sélecteur de type | Ne pas mélanger revenus et dépenses | Change la liste et les catégories proposées dans les transactions. |
| Ligne catégorie | Reconnaître rapidement un choix | Affiche icône et nom ; ouvre l’édition. |
| Ajouter/renommer | Adapter le vocabulaire au quotidien | Valide un nom non vide et persiste la catégorie. |
| Supprimer | Nettoyer une catégorie inutilisée | Refuse les catégories système et demande confirmation pour les autres. |

### Flux de trésorerie / dépenses sûres

**Route :** `/cashflow`

#### Layout et contenu

ScrollView avec carte de chiffre principal, panneau de décomposition et avertissement éventuel. Le contenu distingue disponible maintenant, réserves, revenus prévus, échéances prévues, épargne et horizon du calcul.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Carte Dépenses sûres | Répondre à « combien puis-je dépenser ? » | Affiche le résultat calculé et ouvre le détail du calcul. |
| Décomposition | Comprendre et contrôler le chiffre | Liste les entrées/sorties prises en compte et leur signe. |
| Horizon | Savoir jusqu’à quand l’estimation porte | Utilise le prochain revenu ou un horizon de secours. |
| Avertissement | Éviter une décision basée sur une donnée incomplète | Signale taux manquant, découvert ou déficit et propose une action. |

### Règlement de remboursement

**Route :** `/reimbursement-settlement`

#### Layout et contenu

Modal ou écran court avec transaction/personne, montant restant, compte, catégorie et montant du règlement.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Solde restant | Savoir ce qui peut être réglé | Affiche le montant dû et bloque un montant supérieur. |
| Compte/catégorie | Classer le règlement | Sélecteurs obligatoires avant validation. |
| Enregistrer | Persister le remboursement | Crée le règlement puis revient au détail de transaction ; erreur affichée sinon. |

### Import CSV

**Route :** `/import-csv`

#### Layout et contenu

Modal en étapes : sélection du fichier, aperçu des colonnes/statistiques, confirmation puis rapport d’import. Les doublons, erreurs de format, comptes et catégories sont visibles avant application.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Sélecteur de fichier | Fournir la source | Ouvre le picker et annule sans modifier les données. |
| Aperçu | Vérifier avant import | Affiche période, comptes, catégories et types détectés. |
| Confirmation | Éviter une mutation surprise | Décrit les remplacements/ajouts puis demande validation. |
| Rapport | Vérifier le résultat | Affiche insérés, ignorés, erreurs et retour vers Données. |

### Synchronisation et conflits

**Route :** `/sync-conflicts`

#### Layout et contenu

Liste de cartes de conflits affichant l’entité, la version distante et un aperçu des champs ; chaque carte expose les deux choix de résolution.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Carte de conflit | Comprendre pourquoi une décision est requise | Compare l’aperçu serveur avec la version locale conservée. |
| Garder la version distante | Accepter l’autre appareil | Résout explicitement le conflit en faveur du serveur. |
| Garder ma version locale | Préserver son travail | Réémet la version locale lors de la prochaine synchronisation. |
| État vide/erreur | Savoir si l’espace est sain | Indique qu’aucun conflit n’attend d’action ou permet de relancer. |

## 9. Routes d’authentification et récupération

### Récupérer le compte

**Route :** `/recover-account`

#### Layout et contenu

Écran scrollable de récupération avec champ/token ou email selon le contexte, action principale et retour vers la connexion. Les erreurs réseau et de validation apparaissent près du formulaire.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Champ de récupération | Identifier le compte à récupérer | Valide la saisie puis déclenche le flux local/cloud. |
| Action récupérer | Retrouver l’accès | Envoie la demande et affiche succès ou erreur. |
| Retour connexion | Revenir à un état connu | Ferme le flux sans mutation supplémentaire. |

### Nouveau mot de passe

**Route :** `/reset-password`

#### Layout et contenu

Stack screen avec contexte/token de récupération, champ nouveau mot de passe, confirmation, aide de validation et action de sauvegarde.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Nouveau mot de passe | Remplacer une information compromise/oubliée | Valide longueur et présence du token. |
| Confirmation | Éviter une faute de saisie | Compare les deux valeurs avant envoi. |
| Enregistrer | Finaliser la récupération | Affiche succès, erreur ou retour vers la connexion. |

### Configuration du PIN

**Route :** `/pin-setup`

#### Layout et contenu

Modal plein écran avec titre, explication, points de saisie, pavé numérique et retour. Le même composant sert à définir ou remplacer le code.

#### Éléments UI

| Élément | Besoin utilisateur | Fonctionnement |
|---|---|---|
| Points PIN | Voir l’avancement sans révéler le code | Se remplissent à chaque chiffre et se réinitialisent en cas d’erreur. |
| Pavé numérique | Saisir le code avec une cible tactile adaptée | Ajoute les chiffres, désactive l’envoi tant que le nombre attendu n’est pas atteint. |
| Confirmation | Éviter un code différent de l’intention | Compare la seconde saisie et persiste seulement si elle correspond. |

## 10. Ancien arbre `app/*` — legacy

**Sources :** `src/app/app/index.tsx`, `activity.tsx`, `planning.tsx`, `statistics.tsx`, `accounts.tsx`, `categories.tsx`, `settings.tsx`, `src/app/app/accounts/new.tsx`

Cet arbre contient une ancienne shell d’application et des pages historiques. Le routage Android actuel passe par `/(tabs)` et non par ces routes. Elles ne doivent donc pas être utilisées comme référence UX Android active sans preuve d’une navigation qui les atteint.

| Route legacy | Rôle historique |
|---|---|
| `/app` | Shell historique / accueil |
| `/app/activity` | Ancienne activité |
| `/app/planning` | Ancienne planification |
| `/app/statistics` | Anciennes statistiques |
| `/app/accounts` | Anciens comptes |
| `/app/accounts/new` | Ancienne création de compte |
| `/app/categories` | Anciennes catégories |
| `/app/settings` | Anciens réglages |

Preuve : `src/app/_layout.tsx` choisit `(tabs)` comme destination Android finale lorsque l’onboarding et le cloud welcome sont terminés. Statut des routes legacy : `Code`, confiance élevée pour leur caractère non initial ; accès secondaire éventuel `Non vérifié`.

## 11. Matrice Android → web après audit statique

Cette matrice donne le contrat de couverture issu de l’audit statique. Les différences indiquées comme partielles ou justifiées doivent rester visibles dans le code et dans `ux-audit.md` ; elles ne valent pas validation runtime.

| Écran Android | Route web correspondante | Statut | Preuve / commentaire |
|---|---|---|---|
| Accueil | `/app` | Partiel | `WebCloudDashboard` ; engagements et accès cashflow présents, mais pas toutes les données local-first. |
| Activité | `/app/activity` | Partiel | Recherche, filtres, regroupement et création présents. |
| Recherche activité | `/app/activity` | Adapté | Recherche intégrée à la page plutôt qu’une route séparée. |
| Planification | `/app/planning` | Partiel | Sections métier et formulaires présents. |
| Comptes | `/app/accounts`, `/app/accounts/[id]` | Partiel | Synthèse, groupes et détail présents. |
| Statistiques | `/app/statistics` | Partiel | Périodes et catégories présentes. |
| Réglages | `/app/settings` | Adapté | Cloud/confidentialité présents ; réglages natifs explicitement hors périmètre web. |
| Nouvelle transaction | `/new-transaction` | Partiel | Création et modification via `id` présentes ; pièces jointes absentes. |
| Détail transaction | `/app/activity/[id]` | Partiel | Détail et modification présents. |
| Onboarding | `/onboarding` | Différence justifiée | Le web impose le compte cloud vérifié. |
| Cloud welcome / compte | `/cloud-account`, `/cloud-welcome` | Partiel | Authentification cloud présente. |
| Budgets | `/app/planning/new?type=budget_plans` | Partiel | Formulaire métier présent. |
| Objectifs | `/app/planning/new?type=goals` | Partiel | Formulaire présent ; réservations absentes. |
| Épargne | `/app/planning/new?type=savings_rules` | Partiel | Règle présente ; historique absent. |
| Récurrences | `/app/planning/new?type=recurring_transactions` | Partiel | Formulaire présent ; approbation des occurrences incomplète. |
| Comptes et groupes | `/app/accounts`, `/app/accounts/[id]` | Partiel | Groupement présent ; mutations avancées absentes. |
| Données / sauvegardes | `/app/settings` | Différence justifiée | Données cloud expliquées ; sauvegardes natives non transposées. |
| Sécurité / PIN | Aucun équivalent web direct | Différence justifiée | Authentification cloud du navigateur remplace le verrouillage local natif. |
| Catégories | `/app/categories` | Partiel | CRUD cloud présent. |
| Dépenses sûres | `/app/cashflow` | Partiel | Estimation cloud explicite, sans conversion multi-devise complète. |
| Conflits de synchronisation | Aucun écran web dédié | Différence justifiée | Le web écrit directement avec `baseVersion`; le résolveur SQLite Android n’est pas transposé. |

## 12. Limites actuelles

- Aucun appareil ou émulateur Android n’a confirmé les layouts, gestes, clavier, animations, safe areas ou dialogues natifs.
- Les données réelles influencent fortement les états de l’Accueil, Activité, Comptes, Planification et Statistiques ; les états avec données sont documentés par le code mais non observés.
- La correspondance web est auditée statiquement dans `ux-audit.md`; les écarts restants sont listés et classés.
- Les validations interactives navigateur, Android, données cloud réelles et multi-devise restent à effectuer avant de considérer la parité comme validée en production.
