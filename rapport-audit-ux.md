# Audit UX/UI Android

Audit ralis sur le code Expo SDK 57, cible Android, application offline en franais/XOF, pour un utilisateur grant ses finances personnelles. Les six flows nayant pas t nomms, jai retenu les six parcours principaux visibles dans lapplication.

La vrification statique passe : `expo lint` et TypeScript ne remontent pas derreur. Le rendu sur mulateur na pas pu tre valid visuellement, le serveur Expo web local tant rest bloqu au dmarrage.

## Score global

| Dimension | Score | valuation |
|---|---:|---|
| Accessibilit | 2/4 | Labels incomplets, graphiques non accessibles, cibles tactiles parfois trop petites |
| Performance | 3/4 | Listes correctement virtualises, mais recherche et historique non limits |
| Thme et apparence | 2/4 | Palette cohrente mais largement code en hexadcimal, sans rles Material |
| Conformit Android | 2/4 | Navigation native correcte, mais predictive back dsactiv et gestion des insets incomplte |
| Adaptivit | 1/4 | Portrait forc, clavier et grands crans insuffisamment traits |
| **Total** | **10/20** | Acceptable, mais travail important avant une finition robuste |

Les quatre onglets natifs et leurs icnes Material sont un bon choix Android : Material recommande une navigation basse de 3  5 destinations sur les crans compacts, et Expo Router expose ici de vrais onglets natifs. ([Material Navigation Bar](https://developer.android.com/develop/ui/compose/components/navigation-bar?hl=en), [Expo Router Native Tabs](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/))

## 1. Flow initialiser lapplication

Parcours :

`Transactions vide  Comptes  Crer un compte  choisir le type  retour aux transactions  Nouvelle transaction`

### Ce qui fonctionne

- Ltat vide propose directement  Crer un compte .
- La navigation vers longlet Comptes est claire.
- Les listes utilisent `SectionList`, adapte aux longues listes.

### Problmes

- **[Majeur/P1] Chargement impossible  distinguer dune erreur**  
  `transactions` et `accounts` commencent  `null`, mais aucun indicateur de chargement ni tat derreur nest affich. Une erreur SQLite peut donc laisser une interface vide ou ambigu.  
  Rfrences : [transactions/index.tsx:50](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(transactions)/index.tsx:50>), [accounts/index.tsx:24](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(accounts)/index.tsx:24>).

  Recommandation : introduire `loading / success / empty / error`, avec message prcis et bouton  Ressayer .

- **[Majeur/P1] Le premier solde est conceptuellement peu expliqu**  
  Lapplication dmarre avec des comptes  zro, mais nexplique pas clairement quil faut saisir un revenu pour reprsenter le solde initial. Le modle est document dans [PLAN.md:11](</Users/ananianatide/Workspace/wallet-the-app/docs/PLAN.md:11>), mais pas suffisamment dans linterface.

  Recommandation : ajouter dans ltat initial :  Votre compte dmarre  0. Ajoutez un revenu pour saisir votre solde actuel. 

- **[Mineur/P2] Cration de compte inline trop fragile avec le clavier**  
  Le formulaire est inject dans la liste avec `autoFocus`, sans mcanisme explicite de dplacement du contenu.  
  Rfrence : [accounts/index.tsx:311](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(accounts)/index.tsx:311>).

  Recommandation : utiliser un conteneur clavier-aware et garantir que les boutons  Annuler  /  Crer  restent visibles.

## 2. Flow ajouter ou modifier une transaction

Parcours :

`Transactions  +  type  montant  compte  catgorie/destination  date/heure  note  enregistrer`

### Ce qui fonctionne

- Les champs conditionnels sont pertinents : catgorie pour revenu/dpense, destination pour transfert.
- Les validations mtier couvrent les cas essentiels.
- La suppression demande confirmation.
- La date et lheure sont modifiables sparment.

### Problmes

- **[Majeur/P1] Champs principaux insuffisamment accessibles**  
  Les champs montant, frais et note nont pas de labels daccessibilit explicites. Les boutons de type nannoncent pas leur tat slectionn.  
  Rfrences : [new-transaction.tsx:237](</Users/ananianatide/Workspace/wallet-the-app/src/app/new-transaction.tsx:237>), [new-transaction.tsx:274](</Users/ananianatide/Workspace/wallet-the-app/src/app/new-transaction.tsx:274>), [new-transaction.tsx:321](</Users/ananianatide/Workspace/wallet-the-app/src/app/new-transaction.tsx:321>).

  Recommandation : crer un composant de champ partag avec `accessibilityLabel`, `accessibilityHint`, `accessibilityState` et association explicite au label visuel.

- **[Majeur/P1] Risque de champ ou bouton masqu par le clavier**  
  Le formulaire est long, mais le `ScrollView` nest pas accompagn dun dplacement automatique vers le champ actif.  
  Rfrence : [new-transaction.tsx:231](</Users/ananianatide/Workspace/wallet-the-app/src/app/new-transaction.tsx:231>).

  Recommandation : grer explicitement lIME avec `KeyboardAvoidingView` ou un contrleur de clavier, et tester avec le clavier numrique Android.

- **[Mineur/P2] Erreurs affiches uniquement en alertes globales**  
  Lutilisateur dcouvre lerreur aprs avoir appuy sur  Enregistrer , sans indication visuelle sur le champ concern.

  Recommandation : afficher une erreur sous le champ fautif, conserver le focus et ne garder lalerte que pour les erreurs systme.

- **[Suggestion] Manque de confirmation lgre aprs enregistrement**  
  Le retour arrire suffit techniquement, mais un message bref du type  Dpense enregistre  renforcerait la confiance.

## 3. Flow rechercher et filtrer les transactions

Parcours :

`Transactions  recherche`  
ou  
`Transactions  filtres  priode/types/comptes/catgories  appliquer`

### Ce qui fonctionne

- `SectionList` adapte  lhistorique.
- Les filtres utilisent correctement les rles checkbox et ltat coch.
- Le rsum des filtres rduit le besoin de mmorisation.  
  Rfrence : [filters.tsx:70](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(transactions)/filters.tsx:70>).

### Problmes

- **[Majeur/P1] Recherche sans tat de chargement ni erreur**  
  `searchResults` reste `null` pendant la requte, puis les erreurs sont converties en liste vide. Lutilisateur peut donc voir une zone vide sans savoir si la recherche est en cours ou si elle a chou.  
  Rfrence : [transactions/index.tsx:126](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(transactions)/index.tsx:126>).

  Recommandation : afficher un indicateur  Recherche , puis un tat derreur avec  Ressayer .

- **[Mineur/P2] Requte SQLite  chaque caractre**  
  La recherche relance `searchTransactions`  chaque modification du champ.

  Recommandation : ajouter un debounce de 200300 ms et annuler la requte prcdente.

- **[Mineur/P2] Flches de mois non labellises pour TalkBack**  
  [month-navigator.tsx:20](</Users/ananianatide/Workspace/wallet-the-app/src/components/month-navigator.tsx:20>) ne dfinit pas de labels daccessibilit.

  Recommandation : ajouter  Mois prcdent  et  Mois suivant , ainsi que `accessibilityRole="button"`.

## 4. Flow grer les comptes

Parcours :

`Comptes  dtail dun compte  renommer  masquer/exclure du patrimoine  consulter une transaction`

### Ce qui fonctionne

- La distinction entre solde total et solde disponible est utile.
- Les switches Android natifs sont adapts.
- Les transactions du compte utilisent `FlatList`.

### Problmes

- **[Majeur/P1] Erreurs de chargement et de mise  jour non rcuprables**  
  `load()` et `toggleFlag()` ne disposent pas de gestion derreur visible.  
  Rfrences : [accounts/index.tsx:31](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(accounts)/index.tsx:31>), [accounts/[id].tsx:72](</Users/ananianatide/Workspace/wallet-the-app/src/app/accounts/[id].tsx:72>).

  Recommandation : ajouter un tat derreur inline et une confirmation visuelle aprs modification du switch.

- **[Mineur/P2] Plusieurs boutons sont sous les 48 dp recommands**  
  Les boutons texte utilisent environ 10 dp de padding vertical, et les actions den-tte reposent surtout sur `hitSlop`. Cela reste infrieur  une vraie cible visuelle de 48 dp.  
  Rfrences : [accounts/index.tsx:94](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(accounts)/index.tsx:94>), [accounts/index.tsx:345](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(accounts)/index.tsx:345>).

  Recommandation : imposer `minHeight: 48`, `minWidth: 48` et au moins 8 dp despacement entre actions.

- **[Mineur/P2] Compte supprim ou introuvable mal reprsent**  
  Le dtail peut afficher le titre gnrique  Compte  et une liste vide sans expliquer la cause.  
  Rfrence : [accounts/[id].tsx:33](</Users/ananianatide/Workspace/wallet-the-app/src/app/accounts/[id].tsx:33>).

  Recommandation : distinguer chargement, compte introuvable, erreur et compte sans transaction.

## 5. Flow comprendre sa situation financire

Parcours :

`Statistiques  choisir une priode  lire les catgories/budgets/pargne  Dpenses sres  ventuel objectif  librer`

### Ce qui fonctionne

- Les statistiques regroupent revenus, dpenses, catgories, budgets et pargne.
- Lcran  Dpenses sres  explique les entres et sorties prvues.
- Les scnarios ngatifs sont signals visuellement.

### Problmes

- **[Majeur/P1] Tableau de bord sans chargement ni erreur**  
  Les donnes statistiques commencent  `null`, mais aucun tat intermdiaire nest rendu.  
  Rfrence : [statistics/index.tsx:44](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(statistics)/index.tsx:44>).

  Recommandation : afficher des skeletons par carte, puis une erreur locale avec  Ressayer .

- **[Majeur/P1] Graphiques non accessibles**  
  Le camembert et les barres sont uniquement visuels ; aucune synthse complte nest expose  TalkBack.  
  Rfrences : [statistics/index.tsx:216](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(statistics)/index.tsx:216>), [pie-chart.tsx:39](</Users/ananianatide/Workspace/wallet-the-app/src/components/pie-chart.tsx:39>).

  Recommandation : ajouter une description accessible complte, par exemple  Nourriture, 42 %, 85 000 F , et conserver la lgende textuelle comme alternative principale.

- **[Majeur/P1] Carte interactive qui ne fait rien dans le dtail**  
  Dans lcran  Dpenses sres , la carte conserve une apparence pressable mais son `onPress` est `() => undefined`.  
  Rfrence : [cashflow.tsx:38](</Users/ananianatide/Workspace/wallet-the-app/src/app/cashflow.tsx:38>).

  Recommandation : utiliser une variante non interactive sans chevron, ou supprimer la carte duplique.

- **[Mineur/P2] Formulation trop affirmative pour une recommandation financire**  
   Dpensable sans risque  peut tre compris comme une garantie. Le calcul reste une estimation dpendant des donnes saisies.

  Recommandation : prfrer  Disponible estim  et afficher clairement lhorizon et les hypothses.

## 6. Flow planifier et importer des donnes

Parcours possibles :

- `Comptes  Objectifs  nouvel objectif  rserver  librer`
- `Paramtres  Budgets / pargne / Transactions rcurrentes`
- `Paramtres  Importer Money Manager`

### Ce qui fonctionne

- Les actions destructives sont confirmes.
- Les objectifs expliquent le fonctionnement des rservations.
- Limport affiche un rsum avant confirmation.
- Les critures SQLite sont transactionnelles ct import.

### Problmes

- **[Majeur/P1] Les objectifs sont difficiles  dcouvrir**  
  Ils sont accessibles via licne de len-tte Comptes, mais absents des Paramtres.  
  Rfrences : [accounts/index.tsx:94](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(accounts)/index.tsx:94>), [settings/index.tsx:28](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(settings)/index.tsx:28>).

  Recommandation : ajouter  Objectifs  dans Paramtres, ou crer un accs direct depuis Statistiques et Comptes.

- **[Majeur/P1] Les transactions rcurrentes modifient les donnes automatiquement  louverture**  
  Lcran Transactions appelle `applyDueRecurring` puis affiche une alerte aprs gnration.  
  Rfrence : [transactions/index.tsx:81](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(transactions)/index.tsx:81>).

  Recommandation : afficher une bote de confirmation avec le dtail des chances, ou un snackbar persistant  3 transactions gnres  Voir / Annuler .

- **[Majeur/P1] Ltat dimport se termine avant limport rel**  
  `setImporting(false)` est excut aprs louverture de lalerte de confirmation, alors que limport seffectue ensuite.  
  Rfrence : [settings/index.tsx:78](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(settings)/index.tsx:78>).

  Recommandation : maintenir ltat  Import en cours  jusqu la fin de `applyImportPlan`, bloquer le bouton, puis afficher un rsum avec possibilit dannuler ou de restaurer.

- **[Mineur/P2] cran Paramtres trop plat**  
  Catgories, budgets, pargne, rcurrences, apparence et informations sont prsents dans une seule liste.

  Recommandation : regrouper en  Organisation ,  Planification ,  Donnes  et  Prfrences .

- **[Mineur/P2] Mme dette clavier/accessibilit sur les formulaires avancs**  
  Objectifs et rcurrences rutilisent des `ScrollView` longues sans gestion clavier explicite.  
  Rfrences : [goals/new.tsx:67](</Users/ananianatide/Workspace/wallet-the-app/src/app/goals/new.tsx:67>), [recurring/form.tsx:198](</Users/ananianatide/Workspace/wallet-the-app/src/app/recurring/form.tsx:198>).

## Conformit Android transversale

- **[Majeur/P1] Predictive Back explicitement dsactiv**  
  `predictiveBackGestureEnabled: false` est dfini dans [app.json:13](</Users/ananianatide/Workspace/wallet-the-app/app.json:13>). Android recommande dsormais la prise en charge du predictive back, notamment sur Android 15. ([Documentation Android Predictive Back](https://developer.android.com/guide/navigation/custom-back/predictive-back-gesture))

  Recommandation : retirer cette dsactivation et vrifier les parcours `Back`, les modales et les formulaires non enregistrs.

- **[Majeur/P1] Insets et edge-to-edge non traits explicitement**  
  Aucun `SafeAreaProvider`, `useSafeAreaInsets` ou `StatusBar` nest prsent dans le layout racine. La FAB utilise un `bottom: 24` fixe.  
  Rfrences : [app/_layout.tsx:44](</Users/ananianatide/Workspace/wallet-the-app/src/app/_layout.tsx:44>), [transactions/index.tsx:452](</Users/ananianatide/Workspace/wallet-the-app/src/app/(tabs)/(transactions)/index.tsx:452>).

  Expo recommande de grer explicitement les insets de statut, navigation, dcoupes et modales avec `react-native-safe-area-context`. ([Expo Safe Area v57](https://docs.expo.dev/versions/v57.0.0/sdk/safe-area-context/))

  Recommandation : ajouter un provider racine, positionner la FAB avec `insets.bottom`, et vrifier Android 15 avec navigation gestuelle et barre  trois boutons.

- **[Mineur/P2] Modales personnalises peu conformes  TalkBack**  
  `SelectField`, `MonthPicker` et `PeriodSheet` utilisent des `Modal` et `Pressable` imbriqus sans rle de dialogue, focus initial ou bouton de fermeture explicite.  
  Rfrence : [select-field.tsx:54](</Users/ananianatide/Workspace/wallet-the-app/src/components/select-field.tsx:54>).

  Recommandation : ajouter `accessibilityViewIsModal`, un titre annonc, un bouton Fermer et des options avec `accessibilityState.selected`.

- **[Suggestion] Thme non align sur les rles Material**  
  La palette utilise des hexadcimaux directs comme `#059669`, `#F87171` et `#0A0A0B`.  
  Rfrence : [theme.tsx:27](</Users/ananianatide/Workspace/wallet-the-app/src/theme.tsx:27>).

  Recommandation : mapper la palette  des rles `primary`, `surface`, `onSurface`, `error`, `outline`, avec une variante sombre et ventuellement Dynamic Color Android. Material 3 recommande lusage de rles de couleur et de llvation tonale. ([Material 3 Android](https://developer.android.com/develop/ui/compose/designsystems/material3))

## Cinq correctifs prioritaires

1. **Ractiver Predictive Back et corriger les insets**  effort faible  moyen.  
2. **Crer un systme partag `loading / empty / error / retry`** pour tous les crans SQLite  effort moyen.  
3. **Refondre les champs et boutons de formulaire** : labels TalkBack, tats slectionns, cibles 48 dp, gestion clavier  effort moyen  lev.  
4. **Rendre les changements automatiques explicites** : rcurrences gnres, import en cours, confirmation et rcupration  effort moyen.  
5. **Amliorer la dcouverte et la lisibilit** : ajouter Objectifs aux Paramtres, supprimer la carte inactive, fournir une alternative textuelle aux graphiques  effort faible  moyen.
