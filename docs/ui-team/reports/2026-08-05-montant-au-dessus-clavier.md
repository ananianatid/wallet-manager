# Android UI Team Report: Montant au-dessus du clavier

- Status: `completed_with_p2_p3`
- Branch: `feature/android-ui/form-above-keyboard`
- Base branch: `feature/android-ui/gestion-des-comptes`
- Date: `2026-08-05`
- Runtime visual validation: `not performed`

## Executive summary

Request : « réduis la taille de montant pour que tout le formulaire passe au-dessus du clavier ». Sur l'écran d'édition de compte (`/accounts/[id]/edit`), le champ « Montant (solde) » affichait le montant en `fontSize: 40` dans une boîte à `paddingVertical: spacing.lg` (24). Le montant a été réduit à `fontSize: 28` et la boîte compactée (`paddingVertical: spacing.sm`), ce qui libère ~40–50 px de hauteur verticale.

Le formulaire repose déjà sur `KeyboardAwareScreen` (`KeyboardAvoidingView behavior="height"` sur Android + ScrollView `keyboardShouldPersistTaps="handled"`) : tout reste donc atteignable par défilement même si l'écran est petit. La réduction aide à tenir l'ensemble au-dessus du clavier sur la plupart des écrans ; un débordement résiduel sur petit écran est géré par le scroll.

## Scope and assumptions

- **Périmètre** : uniquement le champ « Montant (solde) » de `src/app/accounts/[id]/edit.tsx`. Aucune autre surface modifiée.
- **Hypothèse** : le « formulaire » visé est l'édition de compte (contexte gestion des comptes). Le même motif `fontSize: 40` existe sur 3 autres formulaires (`new-transaction.tsx:308`, `goals/new.tsx:164`, `recurring/form.tsx:268`) — non touchés ici (hors demande), voir limitations.
- **Non testé au runtime** : la hauteur effective au-dessus du clavier dépend du modèle Android et de la taille d'écran ; validation code uniquement.

## Route and surface map

| Surface | Route | Surface type | Change |
|---|---|---|---|
| Édition compte | `/accounts/[id]/edit` | Stack form | Champ montant `40 → 28`, boîte `paddingVertical` `lg → sm` |

## Canonical action registry

| Action ID | User intent | Canonical route | Completion state |
|---|---|---|---|
| `EDIT_ACCOUNT_AMOUNT` | Saisir le solde cible | `/accounts/[id]/edit` | Enregistrer → retour détail |

## Design-language audit

Le champ reste conforme au système (token `theme.surface`, `radius.lg`, `tabular-nums`, `theme.label`). La réduction de taille n'introduit aucun token one-off. Le montant (28) reste le texte le plus proéminent du formulaire, en deçà du 36 du détail (affichage) — hiérarchie conservée.

## Findings

| ID | Severity | Category | Evidence | Resolution |
|---|---|---|---|---|
| ACC-M-001 | P3 | design_language | `new-transaction.tsx:308`, `goals/new.tsx:164`, `recurring/form.tsx:268` | open (même motif 40 px sur 3 autres formulaires ; à unifier si souhaité) |

## Changes and commits

- `src/app/accounts/[id]/edit.tsx` : `fontSize: 40 → 28`, `paddingVertical: spacing.lg → spacing.sm` sur la boîte du champ montant.

## Tests and static validation

| Check | Status | Details |
|---|---|---|
| `npx tsc --noEmit` | passed | 0 erreur |
| `npm run lint` | passed | 0 erreur |
| Runtime Android (émulateur/appareil) | not_available | non réalisé |

## Sources

- Expo SDK 57 — https://docs.expo.dev/versions/v57.0.0/ — accessed 2026-08-05 (KeyboardAwareScreen / KeyboardAvoidingView).
- Design system local (tokens `theme.tsx`) autoritaire ; aucune règle externe nouvelle appliquée.

## Remaining limitations and follow-ups

- Si le formulaire déborde encore au-dessus du clavier sur petit écran, les leviers restants sont : hauteur de la description (`minHeight: 80`), gaps entre champs, ou regroupement des switches.
- Décision à confirmer : appliquer la même réduction aux 3 autres formulaires (nouvelle transaction, objectif, récurrente) pour l'homogénéité.
