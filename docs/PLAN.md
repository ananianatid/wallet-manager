# PLAN — Wallet The App (gestion de finances personnelles)

App **Expo SDK 57** (Expo Router, TypeScript), **Android**, usage personnel, **offline**, un utilisateur. UI en français, devise **XOF (FCFA)**, montants en **entiers** (indivisible, pas de décimales).

## 1. Décisions validées (grilling)

### Stockage
- **SQLite local** via `expo-sqlite`. Pas de cloud, pas de compte, pas de synchronisation.
- Migrations versionnées + seed exécuté à la première ouverture.

### Comptes
- Champs : `nom`, `catégorie` (classe compte), `created_at`.
- **Pas de solde initial** : un compte démarre à 0 ; ajouter de l'argent = transaction **revenu**.
- **Solde dérivé**, jamais stocké : calculé par requête SQL à la lecture.
  - revenu : `+montant`
  - dépense : `−montant`
  - transfert (compte source) : `−montant − frais`
  - transfert (compte destination) : `+montant`

### Transactions
- Champs : `type` (revenu / dépense / transfert), `montant` (entier FCFA > 0), `catégorie` (revenu & dépense uniquement), `compte`, `destination` (transferts), `fee` optionnel (transferts), `note` (texte libre, une seule, facultative, tous types), `transaction_date` (date + heure choisies par l'utilisateur), `created_at` (horodatage réel d'enregistrement).
- **Transaction date ≠ date de création** : enregistré le 7, peut avoir eu lieu le 4.
- Date de transaction **libre** : passé ou **futur autorisé**, défaut « maintenant », raccourci aujourd'hui.
- Tri : `transaction_date DESC`, puis `created_at DESC`.
- Stockage des dates en **ms epoch, heure locale** (zone XOF sans DST, aucun décalage).
- **Modification : tout est éditable** (montant, date, catégorie, compte, type — y compris convertir un revenu en dépense). Aucune immutabilité : le solde dérivé garantit la cohérence.
- **Suppression : définitive, avec confirmation**. Un transfert supprimé perd son effet sur ses deux comptes.

### Transferts
- **Une seule transaction**, deux références : `account_id` (source) + `destination_account_id`.
- **Sans catégorie**.
- `fee` optionnel, **déduit du compte source**, comptabilisé comme dépense.
- Neutre globalement ; visible dans la liste de **chacun des deux comptes** (`account_id = ? OR destination_account_id = ?`).

### Catégories
- Trois classes plates (pas de hiérarchie) : **compte**, **revenu**, **dépense**.
- Seed + CRUD utilisateur (ajout, renommage, suppression).
- Suppression **bloquée** si une transaction ou un compte l'utilise encore.
- Seed validé :
  - **Comptes** : Compte courant, Épargne, Espèces, Mobile Money, Autre.
  - **Revenus** : Salaire, Virement reçu, Cadeau, Remboursement, Autre.
  - **Dépenses** : Nourriture, Transport, Logement, Factures, Santé, Éducation, Loisirs, Shopping, Autre.

### Périmètre v1 (hors périmètre)
| Inclus | Exclu |
|---|---|
| Transactions (liste, filtre **mois** seul, ‹ ›, défaut mois courant) | Statistiques / graphiques |
| Comptes (liste + détail : transactions liées) | Budgets / plafonds |
| Saisie de transaction (formulaire unique) | Verrouillage (PIN / biométrie) |
| Catégories (CRUD) | Corbeille / archive |
| | Multi-devises |

## 2. Schéma SQLite

```sql
CREATE TABLE categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  type    TEXT NOT NULL CHECK (type IN ('account','income','expense')),
  name    TEXT NOT NULL,
  is_seed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (type, name)
);

CREATE TABLE accounts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  created_at  INTEGER NOT NULL
);

CREATE TABLE transactions (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  type                  TEXT NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount                INTEGER NOT NULL CHECK (amount > 0),
  category_id           INTEGER REFERENCES categories(id),
  account_id            INTEGER NOT NULL REFERENCES accounts(id),
  destination_account_id INTEGER REFERENCES accounts(id),
  fee                   INTEGER CHECK (fee IS NULL OR fee > 0),
  note                  TEXT,
  transaction_date      INTEGER NOT NULL,
  created_at            INTEGER NOT NULL
);
```

Invariants applicatifs :
- `transfer` ⇒ `destination_account_id` non nul, `category_id` nul.
- `income`/`expense` ⇒ `category_id` non nul, `destination_account_id` nul.
- `fee` seulement si `type = 'transfer'`.
- Montants et dates : entiers. FCFA sans décimales.

## 3. Requêtes clés

- **Solde d'un compte** : `SUM(CASE type WHEN 'income' THEN amount WHEN 'expense' THEN -amount WHEN 'transfer' THEN CASE WHEN account_id = ? THEN -(amount + COALESCE(fee,0)) ELSE amount END END)`
- **Transactions d'un compte** : `WHERE account_id = ? OR destination_account_id = ?`
- **Liste du mois** : `WHERE transaction_date BETWEEN ? AND ? ORDER BY transaction_date DESC, created_at DESC`

## 4. Structure du code

```
src/
  types.ts               Types TS (Account, Transaction, Category, TransactionType)
  db/
    schema.ts            Migration v1 + seed des catégories
    accounts.ts          CRUD comptes + solde dérivé
    transactions.ts      CRUD transactions + listes (mois, par compte)
    categories.ts        CRUD + vérification d'usage avant suppression
  app/
    _layout.tsx          Layout tabs (Expo Router) + Provider SQLite
    index.tsx            Transactions : liste du mois, ‹ ›, solde total
    accounts.tsx         Liste des comptes + soldes
    accounts/[id].tsx    Détail : transactions source ou destination
    new-transaction.tsx  Formulaire modal (type → champs conditionnels)
    categories.tsx       CRUD des 3 classes
```

## 5. Étapes d'implémentation

1. `npx expo install expo-sqlite` (docs v57 vérifiées avant écriture).
2. `src/types.ts` + `src/db/schema.ts` (migration + seed) + `src/db/*.ts`.
3. Écrans dans l'ordre : `_layout`, `index` (liste/mois), `accounts` (+détail), `new-transaction`, `categories`.
4. Formatage montants : `1 234 F` (espace insécable, sans décimales).
5. Vérification : `npx tsc --noEmit` + `npx expo lint`.

## 6. Reste à décider (non bloquant)

- Nom affiché de l'app + icône (actuels : défauts Expo).
- Versionnement/migration des catégories seed sur installs existantes.
