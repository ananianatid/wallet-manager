# Android UI Team Report: Gestion des comptes

- Status: `completed_with_p2_p3`
- Branch: `feature/android-ui/gestion-des-comptes`
- Base branch: `audit/android-ui/gestion-des-comptes`
- Date: `2026-08-05`
- Runtime visual validation: `not performed`

## Executive summary

Audit « revois la gestion des comptes » puis implémentation des corrections sur le tracker de dépenses Android (Expo SDK 57, Expo Router, UI française, FCFA entiers, SQLite local).

**Audit** : six surfaces de navigation inspectées (onglet Comptes, Paramètres > Comptes, Gestion des comptes, Groupes de comptes, détail, édition) + couche DB et tests. 13 findings (1 P1, 8 P2, 4 P3). Le modèle de données est sain (soldes dérivés, soft-delete, filtre des comptes masqués dans les sélecteurs vérifié).

**Implémentation** : le P1 et 6 findings P2/P3 résolus, en 4 commits. Statut `completed_with_p2_p3` : il reste 5 findings P2/P3 documentés (drift legacy restant, contraste texte-sur-accent, accessibilité du reorder, perf, confusion solde/disponible, API unstable-native-tabs, découvrabilité). Validation statique verte (tsc, lint, 31/31 tests).

## Scope and assumptions

- **Périmètre** : gestion des comptes (CRUD, groupes, masquage, exclusion du total, soft-delete/restauration, solde disponible/réservé). `new-transaction.tsx` lu pour vérifier le filtrage des comptes masqués.
- **Décision produit (assumée, enregistrée)** : la création de compte est canonique **sur l'onglet Comptes** (Quick-add + EmptyState premier lancement) ; le formulaire dupliqué dans Gestion des comptes a été retiré. La suppression canonique est l'écran **détail** ; le Trash redondant de la liste Gestion a été retiré, l'action sheet de l'onglet conserve un accès rapide.
- **WIP utilisateur** : le travail non commité de l'utilisateur (action-sheet onglet, reorder/appartenance des groupes, pipeline d'import Money Manager) a été commité d'abord tel quel (`60aac21`), puis les correctifs au-dessus. Rien n'a été écrasé.
- **Non testé au runtime** : aucune validation Android sur appareil/émulateur. Contrastes cités calculés (WCAG), pas mesurés.

## Route and surface map

| Surface | Route | Surface type | Entry action | Exit/completion state | Status |
|---|---|---|---|---|---|
| Onglet Comptes | `/(tabs)/(accounts)/index` | Tab + list (SectionList) | Sommaire patrimoine, liste groupée, `+` création (canonique), toggle masqués | Appui long → action sheet (ouvrir/masquer/exclure/supprimer) | Corrigé |
| Paramètres > Comptes | `/(tabs)/(settings)/accounts-settings` | Settings intermédiaire | 2 liens (Groupes, Gestion) | Navigation | Ligne morte supprimée |
| Gestion des comptes | `/(tabs)/(settings)/accounts-management` | Settings list + sheet | Affectation groupe, édition, comptes supprimés + restauration | Retour | Corrigé |
| Groupes de comptes | `/(tabs)/(settings)/account-groups` | Settings list + reorder + sheet | Ajouter/renommer/supprimer/réordonner/restaurer, sheet appartenance | Retour | Auditée |
| Détail compte | `/accounts/[id]` | Stack list | Transactions, solde, Modifier, Supprimer (canonique) | Retour | Auditée |
| Édition compte | `/accounts/[id]/edit` | Stack form | Nom/groupe/montant/description/masqué/exclu + « Équilibre » | Enregistrer → retour | Corrigé |
| Sélecteur de transaction | `/new-transaction` | Stack form | Sélection du compte (filtre masqués : OK) | Enregistrer | Vérifié |

## Canonical action registry

| Action ID | User intent | Canonical route | Canonical completion state | Duplicate paths removed |
|---|---|---|---|---|
| `CREATE_ACCOUNT` | Créer un compte | Onglet Comptes (quick-add) | Compte visible dans la liste | Formulaire de Gestion des comptes retiré ; groupes explicites, jamais silencieux |
| `OPEN_ACCOUNT` | Consulter un compte | `/accounts/[id]` | Liste des transactions | Action sheet « Ouvrir » conservé (accès rapide) |
| `EDIT_ACCOUNT` | Modifier un compte | `/accounts/[id]/edit` | Retour au détail | Entrée Gestion (pencil) conservée |
| `TOGGLE_HIDDEN` | Masquer / afficher | Switches édition + action sheet | État appliqué | — |
| `TOGGLE_EXCLUDE` | Exclure / inclure du total | Switches édition + action sheet | État appliqué | — |
| `ASSIGN_GROUP` | Changer le groupe | Sheet d'affectation (Gestion) + sheet appartenance (Groupes) | Compte déplacé | — |
| `DELETE_ACCOUNT` | Supprimer un compte | `/accounts/[id]` + action sheet onglet | Compte dans « Comptes supprimés » | Trash de Gestion retiré ; copie harmonisée (soft-delete) |
| `RESTORE_ACCOUNT` | Restaurer un compte | Gestion des comptes | Compte actif | — |
| `REORDER_GROUPS` | Réordonner les groupes | Groupes de comptes (reorder) | Ordre persisté | — |

## Design-language audit

Design system cohérent et moderne sur la majorité des surfaces (tokens `theme.tsx`, `ui.tsx`, SelectField, EmptyState). Deux écarts signalés :

1. **Drift legacy (P2, partiellement traité)** — `accounts-management.tsx` utilise encore `LegacySectionHeader`/`LegacyTextRow` ; la ligne morte « Mode de paiement par carte » a été supprimée, la migration visuelle du reste de l'écran reste en backlog.
2. **Texte-sur-accent (P2, non traité)** — trois écrans hardcodent `#0A0A0B` pendant qu'ActionButton utilise `theme.onAccent` (#FFFFFF en light → ~3.76:1, sous AA). Correctif proposé : unifier via token et corriger `onAccent` light. Délaissé car change le rendu de toute l'app (décision visuelle globale).

## Feature journey audit

Cycle de vie tracé : création → consultation → gestion → édition → suppression → restauration.

- **Création** : chemin unique sur l'onglet, groupes explicites (« Sans groupe » par défaut, jamais d'affectation silencieuse). ✅ ACC-J-001
- **Consultation** : sections ordonnées selon le tri utilisateur ; formulaire visible à l'ouverture. ✅ ACC-D-001, ACC-U-001
- **Gestion** : lignes exposées comme boutons (accessibilité). ✅ ACC-A-002
- **Édition** : option « Sans groupe » possible ; validation assouplie. ✅ ACC-J-002
- **Suppression** : chemin réduit + copie harmonisée sur le soft-delete réel. ✅ ACC-J-003
- **Restauration** : inchangée (Gestion des comptes).

## Findings

| ID | Severity | Category | Evidence | Resolution |
|---|---|---|---|---|
| ACC-J-001 | P1 | journey | `(accounts)/index.tsx` ; `accounts-management.tsx` | **fixed** |
| ACC-J-002 | P2 | journey | `edit.tsx` | **fixed** |
| ACC-J-003 | P2 | journey | `accounts-management.tsx` | **fixed** |
| ACC-U-001 | P2 | ux | `(accounts)/index.tsx` | **fixed** |
| ACC-D-001 | P2 | design_language | `(accounts)/index.tsx` | **fixed** |
| ACC-D-002 | P2 | design_language | `accounts-settings.tsx` | **fixed** (ligne morte) ; migration legacy restante open |
| ACC-A-002 | P2 | accessibility | `(accounts)/index.tsx` | **fixed** |
| ACC-D-003 | P2 | accessibility | `theme.tsx` ; `ui.tsx` | open (décision visuelle globale) |
| ACC-A-001 | P2 | accessibility | `account-groups.tsx` | open (alternative accessible au reorder) |
| ACC-P-001 | P3 | performance | `accounts.ts:64-88` | open |
| ACC-U-002 | P3 | ux | `edit.tsx` ; détail | open |
| ACC-C-001 | P3 | scope | `(tabs)/_layout.tsx` | open |
| ACC-S-001 | P3 | ux | `accounts-settings.tsx` | open |

## Changes and commits

- `60aac21` `feat: account action sheet, group reorder, import refinements` — **WIP utilisateur commité tel quel** (préservé).
- `f09f885` `fix(accounts): canonical creation, explicit group, ordered sections` — onglet Comptes.
- `5cc38b9` `fix(accounts): single canonical creation path, remove redundant delete` — Gestion des comptes.
- `669ac21` `fix(settings): remove dead card-payment row` — Paramètres > Comptes.
- `c9f971a` `fix(accounts): allow "Sans groupe" when editing an account` — édition.
- (audit) `5e5527e` `docs: add Android UI audit report for accounts management`.

Base de travail : `audit/android-ui/gestion-des-comptes` (rapport) puis `feature/android-ui/gestion-des-comptes` (implémentation). 6 fichiers de code + 1 rapport.

## Tests and static validation

| Check | Status | Details |
|---|---|---|
| `npx tsc --noEmit` | passed | 0 erreur |
| `npm run lint` (expo lint) | passed | 0 erreur |
| `npm test` (jest --runInBand) | passed | 8 suites, 31/31 tests |
| Validation du JSON d'audit | passed | `validate_agent_output.py` → `VALID` |
| Runtime Android (émulateur/appareil) | not_available | non réalisé — audit et correctifs 100 % code |

## Sources

- Material Design (Material 3) — https://m3.material.io/ — accessed 2026-08-05.
- Android accessibility guidance — https://developer.android.com/guide/topics/ui/accessibility/apps.html — accessed 2026-08-05.
- Expo Router (navigation Stack/Sheet) — https://docs.expo.dev/router/introduction/ — accessed 2026-08-05.
- WCAG 2.2 contraste (AA 4.5:1 texte normal, 3:1 UI) — calculs sur palettes locales `theme.tsx`.
- Limitation source : les sous-agents du skill étaient indisponibles (429) ; les rôles ont été exécutés séquentiellement dans le contexte superviseur et le JSON consolidé est validé. Règles externes secondaires face au design system local (autoritaire).

## Remaining limitations and follow-ups

- **ACC-A-001** : alternative accessible au réordonnancement par glisser-déposer (boutons monter/descendre) — non traité (dans `account-groups.tsx`, écran au WIP dense).
- **ACC-D-003** : unifier le texte-sur-accent (token `onAccent`) et vérifier le contraste d'ActionButton en light — nécessite une décision visuelle app-wide.
- **ACC-D-002** : migrer `accounts-management.tsx` hors des composants legacy (cosmétique).
- **ACC-U-002** : clarifier solde total vs disponible dans l'édition.
- **ACC-S-001** : lien vers Gestion des comptes depuis l'onglet Comptes.
- Rôles `expo-android-implementer` / `android-feature-verifier` : la vérification post-implémentation est couverte par `tsc` + `lint` + `npm test` (31/31) ; une relecture runtime sur appareil reste à faire.
