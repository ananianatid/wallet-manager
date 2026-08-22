# Audit UX web par rapport à l’architecture Android

> Référence Android : [`ux-architecture.md`](./ux-architecture.md)
>
> État au 22 août 2026 : audit statique du code, complété par une reconstruction ciblée et un export web statique. Aucun parcours interactif web ou Android n’a été exécuté ; le rendu réel, les données cloud et les gestes restent donc `Non vérifiables`.

## 1. Résumé exécutif

La version web est une adaptation cloud PostgreSQL de l’application Android, avec une coque et des écrans métier dédiés :

- l’Android est local-first, SQLite, utilisable sans compte ;
- le web `/app/*` exige un compte cloud avec email vérifié ;
- l’Accueil web expose les comptes, les transactions, les engagements et un accès aux `Dépenses sûres` cloud ;
- Activité dispose d’une recherche, de filtres, de regroupements par date, d’un détail et de la modification d’une transaction ;
- Planification dispose de sections et formulaires pour budgets, objectifs, épargne automatique et récurrences ;
- Comptes dispose d’une synthèse patrimoine, d’un détail compte et des opérations liées ;
- Statistiques dispose d’une période glissante, d’une comparaison et d’une ventilation par catégorie ;
- Réglages couvre le cloud, les catégories et la confidentialité, tandis que les fonctions locales Android restent explicitement hors périmètre web.

Conclusion : il existe une base fonctionnelle cloud et une coque responsive, mais la parité UX Android/web est faible. Les écarts sont structurels et doivent être traités page par page après validation de la cible de données : conserver le cloud comme adaptation web justifiée, ou reconstruire une expérience web plus proche du modèle Android.

## 2. Matrice de correspondance

| Écran Android | Écran / route web actuelle | Statut | Gravité | Observation |
|---|---|---|---|---|
| Accueil | `/app` → `WebCloudDashboard` | Correspondance partielle | Important | Comptes, transactions, engagements et accès aux dépenses sûres présents ; calculs local-first et échéances détaillées restent partiels. |
| Activité | `/app/activity` → `WebCloudEntities` | Correspondance partielle | Important | Recherche, filtres, regroupement par date, détail et modification présents ; pièces jointes et filtres avancés restent absents. |
| Recherche activité | `/app/activity` (recherche intégrée) | Correspondance partielle | Modéré | La recherche est intégrée à l’activité web plutôt que séparée en route. C’est une adaptation responsive justifiée. |
| Planification | `/app/planning` → `WebCloudPlanning` | Correspondance partielle | Important | Sections et formulaires métier présents ; réservations et validation des échéances restent incomplètes. |
| Comptes | `/app/accounts`, `/app/accounts/[id]` | Correspondance partielle | Important | Patrimoine cloud, groupes et détail présents ; édition, masquage, suppression et organisation avancée absents. |
| Statistiques | `/app/statistics` → `WebCloudStatistics` | Correspondance partielle | Modéré | Période, comparaison et catégories présentes ; visualisation mensuelle native plus riche absente. |
| Réglages | `/app/settings` → `WebCloudSettings` | Différence justifiée partiellement | Important | Cloud, catégories et confidentialité présents ; réglages locaux Android non transposés silencieusement. |
| Nouvelle transaction | `/new-transaction` → branche web `WebCloudTransaction` | Différent | Important | Plusieurs fonctions Android sont présentes, mais le stockage cloud, le layout et les justificatifs diffèrent. |
| Détail transaction | `/app/activity/[id]` | Correspondance partielle | Important | Détail, modification et navigation présents ; justificatifs et règlement de remboursement absents. |
| Onboarding | Aucun équivalent web | Différence justifiée à confirmer | Modéré | Le web impose un compte vérifié ; cette différence peut être voulue, mais elle n’est pas expliquée dans un parcours équivalent. |
| Cloud welcome / compte | `/cloud-account` | Différent | Modéré | Le compte cloud existe et couvre la connexion ; l’introduction et les états Android ne sont pas identiques. |
| Budgets | `/app/planning`, `/app/planning/new?type=budget_plans` | Correspondance partielle | Important | Création/modification présentes ; progression par période et rollover non affichés. |
| Objectifs | `/app/planning`, `/app/planning/new?type=goals` | Correspondance partielle | Important | Création/modification présentes ; réservations, pièces jointes et détail dédié absents. |
| Épargne | `/app/planning`, `/app/planning/new?type=savings_rules` | Correspondance partielle | Important | Règle présente ; historique des contributions non exposé. |
| Récurrences | `/app/planning`, `/app/planning/new?type=recurring_transactions` | Correspondance partielle | Important | Création/modification présentes ; approbation des occurrences échues incomplète. |
| Comptes et groupes | `/app/accounts`, `/app/accounts/[id]` | Correspondance partielle | Important | Groupement et détail présents ; mutations avancées et réordonnancement absents. |
| Données / sauvegardes | Aucun équivalent web identifié | Manquant | Important | Export, restauration, import CSV et avertissement SQLite non chiffré absents du portail. |
| Sécurité / PIN | Aucun équivalent web identifié | Différence potentiellement justifiée | Modéré | Le PIN est natif/local ; la différence web peut être légitime, mais le modèle de session cloud doit être explicite. |
| Catégories | `/app/categories` | Correspondance partielle | Modéré | Création, renommage et suppression sont présents ; présentation et règles restent différentes. |
| Dépenses sûres | `/app/cashflow` → `WebCloudCashflow` | Correspondance partielle | Important | Calcul cloud explicite présent ; conversions multi-devise et certaines règles serveur restent non disponibles dans le bootstrap. |
| Conflits de synchronisation | Aucun écran web dédié | Différence justifiée | Modéré | Le web écrit directement l’API cloud avec une version de base ; il n’embarque pas la file SQLite locale ni le résolveur de conflits Android. |

## 3. Coque et navigation web

**Sources :** `src/components/web-app-shell.tsx`, `src/app/(tabs)/_layout.tsx`, `src/app/app/*.tsx`

### Layout actuel

À partir de 1080 px, `WebAppShell` affiche une sidebar de 248 px, un top bar et le contenu. Sous ce seuil, il affiche le contenu avec une navigation basse web de cinq items. Le web dispose donc de deux coques :

```text
Desktop >= 1080 px
├── Sidebar verte
│   ├── Marque
│   ├── Nouvelle opération
│   ├── Accueil / Activité / Planification / Statistiques / Comptes
│   └── Compte et synchronisation
└── Main
    ├── Top bar
    └── Page cloud

Web étroit
├── Page cloud
└── Navigation basse web
```

### Constat

| Écart | Classement | Gravité | Preuve |
|---|---|---|---|
| La navigation web est organisée autour du cloud, pas du local-first Android. | Différent | Important | `WebAppShell`, `CloudAuthProvider`, `WebCloud*`. |
| Le web étroit affiche cinq items mais ne reprend pas l’indicateur capsule Android ni la terminologie exacte de tous les états. | Différent | Modéré | `WebMobileNav` vs `WalletTabBar`. |
| Réglages est un lien bas de sidebar et non un onglet visible. | Différence justifiable | Mineur | Convention desktop possible ; à conserver si l’accès reste évident. |
| Un utilisateur non connecté ou non vérifié est bloqué avant l’espace web. | Différence produit | Important | `WebAppShell` rend `Compte requis sur PC`. Ce n’est pas équivalent au mode local Android. |
| Le top bar affiche `Cloud · sécurisé · synchronisé` alors que l’état de synchronisation réel n’est pas détaillé sur chaque page. | Incohérence potentielle | Modéré | Texte statique de `WebTopBar`; à vérifier contre les états API. |

### Recommandation d’audit

Décider explicitement si la contrainte « compte cloud vérifié obligatoire sur web » est une règle produit. Tant que cette décision n’est pas validée, il ne faut pas tenter de copier aveuglément l’onboarding local Android dans le navigateur.

## 4. Audit page par page

Les sous-sections suivantes conservent le constat initial réalisé avant la reconstruction, afin de garder la trace des écarts qui ont déclenché les corrections. Pour l’état actuel, la matrice de correspondance ci-dessus et le tableau « État page par page après reconstruction » de la section 7 sont les références faisant foi.

### 4.1 Accueil web

**Route :** `/app`  
**Composant :** `src/components/web-cloud-dashboard.tsx`

#### Layout actuel

ScrollView avec eyebrow, titre `Vos données`, bouton `Actualiser`, métriques, liste de comptes financiers et dernières transactions. L’état vide concerne uniquement les comptes financiers.

#### Comparaison Android

| Android | Web actuel | Classement |
|---|---|---|
| Situation financière lisible | Métriques cloud génériques | Différent |
| Dépenses sûres | Absent | Manquant |
| Budgets et progression | Absent | Manquant |
| Objectifs / épargne | Absent | Manquant |
| Activité récente groupée par jour | Liste plate limitée à huit transactions | Régression |
| Échéances à venir | Absent | Manquant |
| Promotion cloud conditionnelle | Compte requis avant l’accès | Différent produit |
| Pull-to-refresh | Bouton `Actualiser` | Différent, acceptable sur desktop |

#### Défauts UX

- Le titre `Vos données` ne donne pas la même réponse que l’Accueil Android : « que puis-je décider maintenant ? ».
- Le montant n’est pas explicitement présenté comme `Disponible`, `Solde`, `Patrimoine` ou `Dépenses sûres`.
- Les comptes sont affichés comme des lignes sans la distinction Android entre solde et disponible.
- Les transactions ne sont pas pressables et ne mènent pas au détail.
- L’état vide ne propose pas d’action `Ajouter un compte` dans le composant d’accueil.

## 4.2 Activité web

**Route :** `/app/activity`  
**Composant :** `src/components/web-cloud-entities.tsx`

#### Layout actuel

En-tête générique, bouton d’actualisation et cartes/lignes générées à partir d’entités cloud. Les transactions sont enrichies par le nom de catégorie et de compte lorsqu’ils existent.

#### Défauts UX

- aucune recherche dédiée ;
- aucun filtre de période, type, compte, catégorie ou montant ;
- aucune section par jour ;
- aucune ligne pressable ;
- aucun détail transaction ;
- aucun FAB ou bouton `Nouvelle opération` dans le contenu ;
- les états vides/erreurs sont génériques, sans guidance métier équivalente à Android.

**Classement global :** `Régression`, `Bloquant` pour la parité fonctionnelle.

## 4.3 Planification web

**Route :** `/app/planning`  
**Composant :** `src/components/web-cloud-entities.tsx`

#### Layout actuel

Une seule liste générique reçoit `budget_plans`, `goals`, `savings_rules` et `recurring_transactions`.

#### Défauts UX

- disparition de la hiérarchie Android `Ce mois` / `À construire` / `À automatiser` ;
- aucun snapshot des engagements actifs ;
- aucun montant restant à réserver ;
- aucune progression de budget ;
- aucune action claire pour créer ou modifier un budget, objectif, règle d’épargne ou récurrence ;
- types d’entités présentés comme des données plutôt que comme des décisions utilisateur.

**Classement global :** `Régression`, `Bloquant`.

## 4.4 Comptes web

**Route :** `/app/accounts`  
**Composant :** `src/components/web-cloud-entities.tsx`

#### Layout actuel

Bouton `Ajouter un compte`, puis liste de lignes génériques avec nom, devise et montant éventuel.

#### Défauts UX

- absence de carte `Patrimoine` ;
- absence de `Disponible`, `Solde net`, `Actifs` et `Passifs` ;
- absence de groupes et de sections ;
- absence de compte masqué et d’organisation ;
- aucune édition, suppression, restauration ou menu d’actions identifié ;
- le bouton mène à un formulaire web cloud, mais la page ne distingue pas le compte source, la devise et les réserves comme Android.

**Classement global :** `Régression`, `Bloquant`.

## 4.5 Statistiques web

**Route :** `/app/statistics`  
**Composant :** `src/components/web-cloud-statistics.tsx`

#### Layout actuel

Eyebrow, titre, trois cartes `Revenus`, `Dépenses`, `Transferts`, puis liste `Dépenses par catégorie`.

#### Défauts UX

- aucune période sélectionnable ;
- aucun comparatif entre périodes ;
- aucun graphique mensuel ;
- aucun donut ou détail interactif ;
- devise codée en `XOF` dans l’affichage, sans reprise visible de la devise de référence Android ;
- erreur sans action `Réessayer` visible dans le composant ;
- aucune relation explicite avec les décisions de planification.

**Classement global :** `Différent`, `Important`.

## 4.6 Réglages web

**Route :** `/app/settings`  
**Composant :** `src/components/web-cloud-settings.tsx`

#### Layout actuel

Titre de compte cloud, carte de session PostgreSQL, lien catégories, actions de synchronisation/actualisation et déconnexion.

#### Comparaison

| Fonction Android | Web actuel | Classement |
|---|---|---|
| Compte et synchronisation | Présent | Correspondance partielle |
| Catégories | Présent via lien | Correspondance partielle |
| Apparence | Absent | Manquant |
| Calendrier | Absent | Manquant |
| Devise | Absent | Manquant |
| Données / sauvegardes | Absent | Manquant |
| Sécurité | Absent | Différence potentiellement justifiée |
| Confidentialité | Absent | Manquant |
| Diagnostics | Absent | Manquant |

## 4.7 Nouvelle opération web

**Route :** `/new-transaction`  
**Branche web :** `src/app/new-transaction.tsx` → `WebCloudTransaction`

#### Points alignés

- dépense, revenu et transfert ;
- compte source et compte destination ;
- catégorie ;
- montant et montant cible pour transfert ;
- frais ;
- marchand, note et tags ;
- date ;
- répartition avec contrôle de somme ;
- remboursement avec personne et montant ;
- validations explicites et message inline.

#### Écarts

- l’écran web est un formulaire cloud, tandis qu’Android ouvre une modal locale et revient au contexte précédent ;
- les catégories et comptes sont chargés depuis le cloud ;
- les justificatifs image/PDF documentés sur Android ne sont pas présents dans le formulaire web audité ;
- aucun détail de transaction web n’est disponible après sauvegarde ;
- le feedback de succès repose sur une navigation vers `/app/activity`, sans message de confirmation identifié.

**Classement global :** `Différent`, `Important`. La richesse fonctionnelle du formulaire est prometteuse, mais elle ne suffit pas à garantir la parité de flux.

## 4.8 Catégories web

**Route :** `/app/categories`  
**Composant :** `src/components/web-cloud-categories.tsx`

#### Points présents

- onglets Dépenses / Revenus ;
- création ;
- renommage ;
- suppression des catégories non seed ;
- confirmation navigateur pour suppression ;
- état de chargement et erreurs ;
- icône de catégorie.

#### Écarts

- présentation et interaction différentes de la route Android `/categories/[type]` ;
- `window.prompt` et `window.confirm` ne forment pas une expérience homogène avec les confirmations natives ;
- aucune comparaison runtime de clavier, focus et messages d’erreur.

**Classement :** `Correspondance partielle`, `Modéré`.

## 4.9 Authentification et accès

**Sources :** `src/components/web-app-shell.tsx`, `src/app/cloud-account.tsx`

Le web affiche `Connexion au cloud…`, puis bloque l’espace si l’utilisateur n’est pas connecté ou si son email n’est pas vérifié. Android peut continuer en mode local et propose une promotion cloud différée.

Cette différence est potentiellement justifiée par le choix produit « le web utilise PostgreSQL ». Elle doit cependant être inscrite dans la spécification web et expliquée avant l’accès, sinon l’utilisateur peut interpréter le web comme une version incomplète ou cassée de son portefeuille local.

## 4.10 Dépenses sûres web

**Route :** `/app/cashflow`  
**Composant :** `src/components/web-cloud-cashflow.tsx`

### Layout actuel

En-tête décisionnel, action d’actualisation, carte `Disponible estimé`, panneau de décomposition du calcul et note sur les limites de l’estimation cloud. Si aucun compte n’est disponible, la page propose directement d’en créer un.

### Comparaison Android

- le besoin utilisateur et le vocabulaire `Disponible estimé` / `Dépenses sûres` sont repris ;
- les comptes inclus, transactions passées, revenus futurs, récurrences, réserves d’objectifs et règles d’épargne sont pris en compte lorsqu’ils sont présents dans le bootstrap cloud ;
- les conversions multi-devise et certaines règles métier calculées localement ne sont pas disponibles côté web et sont signalées au lieu d’être simulées ;
- le web présente donc une estimation cloud partielle, pas une promesse de parité numérique avec SQLite.

**Classement :** `Correspondance partielle`, `Important`. La différence multi-devise est justifiée par l’absence de taux dans le contrat de bootstrap actuel et devra être levée si le web devient une référence financière complète.

## 5. Écarts prioritaires pour une reconstruction

Cette liste est le backlog initial établi avant l’implémentation. Les éléments déjà réalisés et les écarts justifiés sont mis à jour dans la section 7.

### P0 — Bloquants de parité

1. rendre les lignes d’Activité pressables et créer un détail transaction web ;
2. remplacer la liste générique de Planification par les sections et actions métier Android ;
3. reconstruire Comptes autour de Patrimoine, Disponible, Solde et groupes ;
4. ajouter recherche et filtres Activité ;
5. décider et implémenter la relation entre données cloud et concepts Android local-first.

### P1 — Fonctionnalités importantes

1. reproduire les indicateurs Accueil : Dépenses sûres, budgets, objectifs, épargne, échéances ;
2. ajouter les écrans dédiés budgets, objectifs, épargne et récurrences ;
3. compléter Statistiques avec période, comparaison et visualisations ;
4. compléter Réglages avec devise, calendrier, données, confidentialité et diagnostics ;
5. documenter les conflits cloud et la restauration.

### P2 — Cohérence et finition

1. harmoniser états vides, erreurs, chargement et feedbacks ;
2. vérifier focus clavier, contrastes et navigation clavier ;
3. vérifier mobile web sous 1080 px ;
4. remplacer les confirmations navigateur si une meilleure interaction web est retenue ;
5. harmoniser les libellés `Solde`, `Disponible`, `Patrimoine` et `Dépenses sûres`.

## 6. Décisions à valider avant reconstruction

1. Le web doit-il rester cloud-only avec compte vérifié obligatoire ?
2. Si oui, quels concepts Android restent obligatoires côté web : Dépenses sûres, budgets, objectifs, épargne, récurrences ?
3. Le web doit-il partager les mêmes données métier que SQLite via le modèle cloud, ou avoir une expérience volontairement différente ?
4. Les sauvegardes locales et le PIN sont-ils hors périmètre web, ou faut-il proposer des équivalents navigateur ?
5. L’interface web mobile doit-elle suivre la navigation Android, ou la navigation web à cinq items est-elle la référence ?

## 7. Validation nécessaire avant modification

L’audit est terminé au niveau statique. La reconstruction P0 a ensuite été autorisée par la demande `okay code` et a été limitée aux écarts pouvant être traités dans la couche web existante, sans modification du schéma serveur.

### Reconstruction P0 réalisée

- Activité : recherche, filtres par type, regroupement par date, action de création et lignes navigables ;
- détail cloud d’une transaction : nouvelle route `/app/activity/[id]` avec montant, date, compte, destination, catégorie, marchand, note, tags et accès à la modification ;
- modification cloud d’une transaction : `/new-transaction?id=...` recharge l’entité, conserve sa version et réécrit le même identifiant ;
- Planification : sections distinctes pour budgets, objectifs, épargne automatique et récurrences ;
- formulaires web dédiés à la création et à la modification des budgets, objectifs, règles d’épargne et récurrences ;
- Comptes : regroupement par groupe, synthèse Patrimoine cloud, solde net calculé, détail d’un compte et opérations liées ;
- Accueil : engagements actifs, navigation vers planification, détail compte et détail transaction ;
- Dépenses sûres : écran `/app/cashflow` avec disponibilité estimée, revenus, échéances, épargne et limites multi-devise explicites ;
- Statistiques : période glissante sur six mois, variation versus période précédente et ventilation par catégorie ;
- Réglages : gestion cloud, catégories et lien vers la politique de confidentialité avec explicitation des limites web ;
- états vides : action d’ajout d’opération pour l’activité vide.

### P0 restant

- la validation métier complète des récurrences échues, réservations d’objectifs et dépenses sûres n’est pas encore reproduite ;
- les pièces jointes transactionnelles et le règlement de remboursement ne sont pas encore exposés dans le web ;
- les actions compte avancées (édition, masquage, suppression, groupes) ne sont pas encore exposées dans le web ;
- aucune validation interactive par navigateur n’a confirmé les nouvelles interactions.

### Écarts explicitement justifiés

- `Données`, sauvegardes chiffrées, PIN, biométrie et protection de capture restent natifs : le web est cloud-only et ne possède ni fichier SQLite local ni capacités système équivalentes ; la limite est annoncée dans les réglages web.
- La recherche activité est intégrée à `/app/activity` plutôt que séparée en route : elle conserve le besoin utilisateur avec une navigation web plus compacte.
- Le résolveur de conflits n’est pas dupliqué côté web : les écritures web utilisent directement `baseVersion` auprès du cloud, alors que le conflit Android vient de la file locale SQLite et du rapprochement entre appareils.
- La conversion multi-devise des `Dépenses sûres` n’est pas simulée : le bootstrap cloud ne fournit pas les taux nécessaires, donc la page affiche une estimation et sa limite.
- Les actions compte avancées, les réservations d’objectifs, les pièces jointes et les règlements restent classés comme écarts fonctionnels à traiter uniquement si le contrat cloud correspondant est exposé ; aucune conformité 1:1 n’est prétendue.

### État page par page après reconstruction

| Page web | Couverture obtenue | Écart restant | Décision |
|---|---|---|---|
| `/app` | Synthèse comptes, transactions, engagements et navigation vers dépenses sûres | Calcul détaillé dans une page dédiée | L’adaptation conserve une page décisionnelle séparée |
| `/app/activity` | Recherche, filtres, regroupement par date, détail et édition | Pièces jointes et règlement absents | Écart connu, non corrigé silencieusement |
| `/app/planning` | Budgets, objectifs, épargne, récurrences, création/modification | Réservations et validation des échéances incomplètes | Itération web suivante |
| `/app/accounts` | Groupes, synthèse patrimoine, navigation détail | Actions avancées de compte absentes | À implémenter avec les mutations cloud dédiées |
| `/app/statistics` | Périodes, comparaison et catégories | Visualisation mensuelle native plus riche absente | Les barres web sont retenues comme équivalent lisible |
| `/app/cashflow` | Disponible estimé et décomposition du calcul | Conversion multi-devise cloud incomplète | Limite affichée à l’utilisateur |
| `/app/settings` | Session, synchronisation, catégories, confidentialité | Apparence, calendrier, devise, sauvegardes et diagnostics non alignés | Différence cloud/web explicitée |

Les routes `/app/activity/[id]`, `/app/accounts/[id]` et `/app/planning/new` sont des ajouts de reconstruction. Leur présence dans le code ne constitue pas une preuve de bon fonctionnement réseau ou de rendu navigateur.

### Contrôles finaux de cette passe

- `npx tsc --noEmit` : réussi ;
- ESLint ciblé sur les composants et routes reconstruits : réussi, sans erreur ni avertissement ;
- `git diff --check` : réussi ;
- tests ciblés `web-cloud-settings` et `tabs-layout` : 4 tests réussis ; les logs de test signalent seulement les limites connues de l’environnement Jest SQLite/`act` ;
- `npx expo export --platform web` : réussi, 79 routes statiques générées, dont les routes cashflow, détail compte, détail transaction et formulaire de planification ;
- `npx expo lint` global : réussi avec 0 erreur et 9 avertissements d’imports du code existant et d’un test ;
- validation navigateur interactive, données cloud réelles et appareil Android : non effectuées dans cet environnement.

### Preuves exécutées

- `git status` : dépôt initial propre sur `master` ;
- `git diff --check` : aucune erreur sur le document ajouté ;
- inspection statique des routes et composants : effectuée ;
- exécution Android : non effectuée ;
- exécution interactive web : non effectuée ;
- validation responsive/accessibilité par navigateur : non effectuée.
