# Android UI Team Report: Gestion des comptes

- Status: `blocked`
- Branch: `audit/android-ui/gestion-des-comptes`
- Base branch: `codex/safe-to-spend`
- Date: `2026-08-05`
- Runtime visual validation: `not performed`

> Le statut `blocked` signifie : **l'audit est livré**, mais un finding **P1** (ACC-J-001, chemin de création dupliqué avec sémantiques divergentes) reste ouvert. Conformément aux règles de sévérité de l'équipe, la fonctionnalité « gestion des comptes » n'est pas déclarée complète tant qu'une décision produit + implémentation n'a pas traité ce P1.

## Executive summary

Audit « revois la gestion des comptes » sur le tracker de dépenses Android (Expo SDK 57, Expo Router, UI française, FCFA entiers, SQLite local). Six surfaces de navigation ont été inspectées : onglet Comptes, Paramètres > Comptes (intermédiaire), Gestion des comptes, Groupes de comptes, détail compte, édition compte, plus la couche DB (`src/db/accounts.ts`, `src/db/account-groups.ts`, migrations) et la couverture de test existante.

Le modèle de données est sain : soldes dérivés, soft-delete des comptes et des groupes, restauration, filtre des comptes masqués dans les sélecteurs de transaction (vérifié dans `new-transaction.tsx`). Les problèmes sont concentrés sur la **multiplicité des chemins d'action** et quelques **incohérences de copie/design** :

- **1 P1** : la création de compte existe sur deux routes canoniques avec des sémantiques divergentes (l'onglet assigne silencieusement le premier groupe ; Gestion des comptes crée « Sans groupe »).
- **9 P2** : compte « Sans groupe » non enregistrable via l'édition ; suppression accessible à 3 endroits avec une copie contradictoire (« définitive » vs « restaurable ») ; formulaire de création pouvant rester hors écran ; ordre des groupes ignoré sur l'onglet ; drift legacy vs design moderne ; texte-sur-accent incohérent (hardcode `#0A0A0B` vs token `onAccent`, ActionButton sous le seuil AA en light) ; réordonnancement sans alternative accessible ; lignes interactives sans rôle de bouton.
- **4 P3** : sous-requêtes corrélées par compte, confusion solde total/disponible dans l'édition, API `unstable-native-tabs`, découvrabilité de la gestion depuis l'onglet.

Aucune fuite de données ni P0 détecté. Validation statique : typecheck OK, lint OK, tests `accounts.test.ts` OK (8/8).

## Scope and assumptions

- **Périmètre** : tout ce qui touche à la gestion des comptes (CRUD compte, groupes, masquage, exclusion du total, soft-delete/restauration, solde disponible/réservé). Le chemin de transaction (`new-transaction.tsx`) n'a été lu que pour vérifier le filtrage des comptes masqués.
- **Hypothèses** : l'audit est lecture seule ; aucun fichier du périmètre n'a été modifié. Les fichiers déjà modifiés par l'utilisateur sur `codex/safe-to-spend` (import Money Manager, `(accounts)/index.tsx`, `account-groups.tsx`, etc.) ont été **préservés tels quels** et reportés sur la branche audit sans être committés.
- **Non testé au runtime** : aucune validation Android sur appareil/émulateur (audit 100 % code). Les contrastes cités sont calculés (WCAG), pas mesurés à l'écran.

## Route and surface map

| Surface | Route | Surface type | Entry action | Exit/completion state | Status |
|---|---|---|---|---|---|
| Onglet Comptes | `/(tabs)/(accounts)/index` | Tab + list (SectionList) | Sommaire patrimoine, liste groupée, `+` création, toggle masqués | Appui long → action sheet (ouvrir/masquer/exclure/supprimer) | Auditée |
| Paramètres > Comptes | `/(tabs)/(settings)/accounts-settings` | Settings intermédiaire | 2 liens (Groupes, Gestion) + ligne morte « Mode de paiement par carte » | Navigation vers les sous-écrans | Auditée |
| Gestion des comptes | `/(tabs)/(settings)/accounts-management` | Settings list + formulaire + sheets | Formulaire création, sections par groupe, actions par ligne, comptes supprimés + restauration | Retour | Auditée |
| Groupes de comptes | `/(tabs)/(settings)/account-groups` | Settings list + reorder + sheet | Ajouter/renommer/supprimer/réordonner/restaurer, sheet appartenance | Retour | Auditée |
| Détail compte | `/accounts/[id]` | Stack list | Liste des transactions, solde, Modifier, Supprimer | Retour | Auditée |
| Édition compte | `/accounts/[id]/edit` | Stack form | Nom/groupe/montant/description/masqué/exclu + « Équilibre » | Enregistrer → retour | Auditée |
| Sélecteur de transaction | `/new-transaction` | Stack form | Sélection du compte (filtre masqués : OK) | Enregistrer | Vérifié (hors périmètre) |

## Canonical action registry

| Action ID | User intent | Canonical route | Canonical completion state | Duplicate paths to remove |
|---|---|---|---|---|
| `CREATE_ACCOUNT` | Créer un compte | Onglet Comptes (quick-add) | Compte visible dans la liste | Formulaire dupliqué dans `accounts-management.tsx` ; aligner la sémantique de groupe |
| `OPEN_ACCOUNT` | Consulter un compte | `/accounts/[id]` | Liste des transactions | Doublon soft : action sheet « Ouvrir le compte » + appui ligne (acceptable si conservé) |
| `EDIT_ACCOUNT` | Modifier un compte | `/accounts/[id]/edit` | Retour au détail | Entrée dupliquée depuis Gestion des comptes (pencil) |
| `TOGGLE_HIDDEN` | Masquer / afficher | Switches de l'édition | État appliqué | Action sheet de l'onglet (à trancher : garder un accès rapide, une seule sémantique) |
| `TOGGLE_EXCLUDE` | Exclure / inclure du total | Switches de l'édition | État appliqué | Action sheet de l'onglet (idem) |
| `ASSIGN_GROUP` | Changer le groupe d'un compte | Sheet d'affectation (Gestion des comptes) | Compte déplacé | Sheet d'appartenance dans Groupes de comptes (les deux peuvent coexister, mais garder une seule interaction canonique) |
| `DELETE_ACCOUNT` | Supprimer un compte | `/accounts/[id]` | Compte dans « Comptes supprimés » | Action sheet onglet + ligne Gestion des comptes |
| `RESTORE_ACCOUNT` | Restaurer un compte | Gestion des comptes | Compte actif | — |
| `REORDER_GROUPS` | Réordonner les groupes | Groupes de comptes (mode reorder) | Ordre persisté | — |

## Design-language audit

Le design system détecté est **cohérent et moderne** sur la majorité des surfaces : tokens `src/theme.tsx` (background/surface/surfaceElevated/label/secondaryLabel/accent/onAccent/income/expense, `spacing`, `radius`), composants partagés `src/components/ui.tsx` (ActionButton, IconButton, FormField, ScreenState, InlineError, KeyboardAwareScreen), SelectField, EmptyState. `account-groups.tsx` et `edit.tsx` suivent ce langage.

Deux écarts significatifs :
1. **Drift legacy** — `accounts-management.tsx` repose sur `LegacySectionHeader`/`LegacyTextRow` (`src/components/legacy-money-manager.tsx`, hérités du flux d'import Money Manager) alors que son voisin direct `account-groups.tsx` utilise le design moderne. La même fonctionnalité parle donc deux langages visuels (ACC-D-002).
2. **Texte-sur-accent** — trois écrans hardcodent `#0A0A0B` comme texte sur `theme.accent`, pendant que `ActionButton` utilise `theme.onAccent`. En mode light, `onAccent` = `#FFFFFF` sur accent `#059669` donne ~3.76:1 (échec AA texte normal) ; le noir hardcodé donne ~5.6:1. Incohérence + composant partagé sous le seuil (ACC-D-003).

Règles de contraste vérifiées : `secondaryLabel` sur `surface` passe AA dans les deux modes (~4.6:1 light, ~6.8:1 dark). Contraste des accents calculé à partir des palettes (`theme.tsx:31-62`).

## Feature journey audit

Cycle de vie du compte tracé : **création → consultation → gestion → édition → suppression → restauration**.

- **Création** : deux chemins (onglet + gestion) avec des defaults de groupe différents (ACC-J-001, P1). Le chemin de l'onglet assigne silencieusement le premier groupe seed (« Espèces ») sans consentement.
- **Consultation** : l'onglet groupe par section ; les actions de gestion ne sont accessibles que par appui long (ACC-A-002). Détail correct, avec distinction solde/disponible.
- **Gestion** : masquer/exclure double (action sheet + switches édition) ; affecter un groupe double (sheet gestion + sheet appartenance). Chaque intent a 2 chemins.
- **Édition** : blocage pour les comptes « Sans groupe » (ACC-J-002) ; confusion possible solde total vs disponible (ACC-U-002).
- **Suppression** : 3 points d'entrée, copie contradictoire (ACC-J-003). Soft-delete réel, restauration uniquement disponible dans Gestion des comptes.
- **Restauration** : seule dans Gestion des comptes, découvrable faiblement (ACC-S-001).

États vérifiés : loading/error (ScreenState), empty (EmptyState / textes vides), retry, formulaires avec erreurs inline (FormField + InlineError), confirmation destructive (Alert), annulation de sheets/modals. Pas de cas de data loss identifié.

## Findings

| ID | Severity | Category | Evidence | Resolution |
|---|---|---|---|---|
| ACC-J-001 | P1 | journey | `(accounts)/index.tsx:462-511,86` ; `accounts-management.tsx:195-246,105` | open |
| ACC-J-002 | P2 | journey | `edit.tsx:90-92,163-165` ; `account-groups.ts:107-119` | open |
| ACC-J-003 | P2 | journey | `(accounts)/index.tsx:600-611,153-178` ; `accounts-management.tsx:286-292,118` ; `accounts/[id]/index.tsx:167-171` | open |
| ACC-U-001 | P2 | ux | `(accounts)/index.tsx:43-54,351-511` | open |
| ACC-D-001 | P2 | design_language | `(accounts)/index.tsx:200` ; `account-groups.ts:30-39` | open |
| ACC-D-002 | P2 | design_language | `accounts-management.tsx:16,253` ; `accounts-settings.tsx:42-53` | open |
| ACC-D-003 | P2 | accessibility | `(accounts)/index.tsx:507` ; `accounts-management.tsx:242` ; `account-groups.tsx:386,422` ; `theme.tsx:57` ; `ui.tsx:38-47` | open |
| ACC-A-001 | P2 | accessibility | `account-groups.tsx:94-113,315-345` | open |
| ACC-A-002 | P2 | accessibility | `(accounts)/index.tsx:267-297` | open |
| ACC-P-001 | P3 | performance | `accounts.ts:64-88` | open |
| ACC-U-002 | P3 | ux | `edit.tsx:59` ; `accounts/[id]/index.tsx:149` | open |
| ACC-C-001 | P3 | scope | `(tabs)/_layout.tsx:1` ; `package.json` | open |
| ACC-S-001 | P3 | ux | `accounts-settings.tsx:8-11` ; `(settings)/index.tsx:38` | open |

Détail complet (impact + recommandation + preuves) : les 13 findings sont consolidés dans `/tmp/claude-501/android-team-supervisor.json` (validé par `validate_agent_output.py` → `VALID`).

## Changes and commits

Aucun code modifié (audit lecture seule). Seul ajout : ce rapport.

- Branch `audit/android-ui/gestion-des-comptes` créée depuis `codex/safe-to-spend`.
- Les modifications utilisateur en cours (import Money Manager, onglet Comptes, groupes de comptes) sont **non commitées et préservées** ; le commit de ce rapport n'y touche pas.

## Tests and static validation

| Check | Status | Details |
|---|---|---|
| `npx tsc --noEmit` | passed | 0 erreur |
| `npm run lint` (expo lint) | passed | 0 erreur |
| `npx jest src/db/accounts.test.ts` | passed | 8/8 tests (planBalanceAdjustment, setAccountBalance) |
| Validation du JSON d'audit | passed | `validate_agent_output.py` → `VALID` |
| Runtime Android (émulateur/appareil) | not_available | non réalisé — audit 100 % code |

## Sources

- Material Design (Material 3) — https://m3.material.io/ — accessed 2026-08-05 (application : fondation des recommandations d'état/touch target, croisée avec le design system local).
- Android accessibility guidance — https://developer.android.com/guide/topics/ui/accessibility/apps.html — accessed 2026-08-05 (application : recommandations ACC-A-001, ACC-A-002, ACC-D-003).
- Expo Router (navigation Stack/Sheet) — https://docs.expo.dev/router/introduction/ — accessed 2026-08-05.
- WCAG 2.2 contraste (AA 4.5:1 texte normal, 3:1 UI) — calculs effectués sur les palettes locales `theme.tsx`.
- Limitation source : SDK Expo 57 documenté dans le repo (`AGENTS.md` impose la doc v57) ; pas de navigation web supplémentaire (sous-agents indisponibles : 429), les règles externes citées restent secondaires face au design system local qui est autoritaire.

## Remaining limitations and follow-ups

- **P1 bloquant** : ACC-J-001 — décision produit requise : garde-t-on le quick-add de l'onglet, la création dans Gestion, ou les deux ? Ensuite, implémenter une sémantique de groupe unique (jamais d'assignation silencieuse).
- **Recommandations P2 prioritaires** : ACC-J-002 (option « Sans groupe » dans l'édition), ACC-J-003 (copie de suppression harmonisée), ACC-D-003 (unifier texte-sur-accent via token).
- Rôles délégués non exécutables ce jour (limite d'usage du modèle sous-agents, 429) : les rôles du skill ont été exécutés séquentiellement dans le contexte superviseur ; le JSON consolidé est validé.
- Le rapport de suivi d'implémentation (rôle `expo-android-implementer`) est prêt à démarrer sur demande : branche `feature/android-ui/gestion-des-comptes`.
