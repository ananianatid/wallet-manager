# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Personal, offline, single-user expense tracker for Android. Expo SDK 57, Expo Router (file-based routing), TypeScript strict. **UI in French**. **Multi-currency**: amounts are stored as **integer minor units** in the account's currency (XOF has 0 decimals, EUR/USD 2 — digit count derived from `Intl`); XOF (FCFA) is the default/reference currency. No cloud, no accounts, no sync — everything lives in a local SQLite DB. The only network calls are FX-rate refreshes (Frankfurter API) and optional Sentry.

## Commands

```bash
npm start              # expo start
npm run ios|android    # expo run:ios|android (native build)
npm run web            # expo start --web
npm run lint           # expo lint (eslint-config-expo flat config)
npm test               # jest --runInBand (jest-expo preset)
npx tsc --noEmit       # typecheck
npm run build:apk      # prebuild + gradle assembleRelease → dist/app-release.apk
node scripts/verify-import.mjs <file.mmbak>    # validate Money Manager import plan
node scripts/verify-e2e.mjs <file.mmbak>       # apply import to in-memory DB + balance checks
node scripts/verify-backup.mjs                 # roundtrip AES-GCM + KDF of the .wlbak format (node:crypto)
node scripts/verify-restore.mjs                # full backup export→encrypt→decrypt→restore cycle
node scripts/verify-account-groups.mjs         # migration + account-group CRUD against in-memory DB
```

- Tests are co-located `*.test.ts` / `*.test.tsx` next to the code they cover. Run a single test with `npx jest src/db/accounts.test.ts`.
- `scripts/verify-*.mjs` use Node's built-in `node:sqlite` (Node ≥ 22), not jest. They run a real `.mmbak` backup (a Money Manager Android export) through the import pipeline and assert exact counts.
- Lint and test are fast; typecheck catches most errors — run `tsc --noEmit` before assuming a change compiles.

## Architecture

- **Routing** — `src/app/` is the Expo Router tree. `(tabs)` holds **five** bottom tabs (Accueil / Transactions / Statistiques / Comptes / Paramètres), each an expo-router group directory with its own `_layout.tsx`; `(tabs)/_layout.tsx` wires the `NativeTabs` bar. Stack screens live alongside: `new-transaction`, `accounts/[id]`, `goals/[id]`, `budgets`, `recurring`, `savings`, `cashflow`, `currency-settings`, `security`, `backup-*`, `pin-setup`, `diagnostics`, etc. `_layout.tsx` at root wires SafeArea + theme + Stack options.
- **Database** — `src/db/database.ts` exports a single shared `getDatabase()` promise (module-level cache, WAL mode, FK on). Every `src/db/*.ts` module is a thin CRUD layer whose functions take `db: SQLiteDatabase` as the first argument. Schema + versioned migrations live in `src/db/schema.ts` (`DATABASE_VERSION = 13`), gated by `PRAGMA user_version`. Fresh installs run the full v1 schema + seed categories + seed account groups. Never change an existing migration — append a new `if (currentDbVersion <= N)` block and bump the version.
- **Money model** — balances are **derived, never stored**, and per-account. Each account carries a `currency_code`; a transaction stores `amount` in the source account's currency as integer minor units. Types: `income`/`expense` have a `category_id`; `transfer` has `account_id` (source) + `destination_account_id` and, when currencies differ, records `destination_amount` + `exchange_rate` (+ date/provider). A transfer shows in both accounts' lists (`WHERE account_id = ? OR destination_account_id = ?`). Accounts start at 0; adding money = an income transaction. Reporting uses a **reference currency** (`base_currency` setting, default XOF): per-account amounts convert to it for dashboard/statistics totals. Budgets and goals have their own `currency_code`; goal reservations freeze `reference_amount`/`reference_currency`/`exchange_rate` at reservation time. `transaction_date` is the user-chosen date (future allowed) and differs from `created_at` (real insert time). All dates are ms epoch in local time.
- **Currencies & FX** — `src/currency/currencies.ts` has currency definitions and the pure money helpers (`formatAmount`, `parseMoneyInput`, `convertMinorAmount`, `minorToMajor`), all driven by `currencyDigits(code)`. `src/currency/service.ts` talks to the Frankfurter API: `ensureCurrentRates` (12h cache in the `fx_rates` table), `getRateForPair`, `setReferenceCurrency` (converts budgets/goals/reservations in one transaction). `src/currency/context.tsx` exports `CurrencyProvider` + `useCurrency` / `useCurrencyConverter`, refreshing on AppState foreground. `formatAmount` (in `src/utils/format.ts`, re-exported from `@/currency/currencies`) takes `(amountMinor, currency?)`.
- **Data flow in screens** — screens call `useAsyncResource(load)` (`src/hooks/use-async-resource.ts`) where `load` opens the DB and runs queries; the hook gives `{ data, status, error, reload }`. `ScreenState` / `InlineError` (`src/components/ui.tsx`) render loading/error. Filters that must persist across screens live in `src/state/*.ts` as tiny module-level stores consumed via `useSyncExternalStore` — no Redux/Zustand.
- **Theme** — `src/theme.tsx` exports `ThemeProvider`, `useTheme()` (colors), plus `spacing` and `radius` tokens. Mode (`system`/`light`/`dark`) is persisted in the `settings` DB table. Components style from these tokens, never hardcoded hex.
- **Shared UI** — `src/components/ui.tsx` is the small design system (ActionButton, IconButton, FormField, ScreenState, InlineError, KeyboardAwareScreen). Reuse it before writing bespoke controls. Icons are `lucide-react-native`; the tab bar uses `NativeTabs` from `expo-router/unstable-native-tabs`. Charts (donut, monthly bars) are `react-native-svg` components in `src/components/`.
- **Money Manager import** — a one-way migration from the Android "Money Manager" app's `.mmbak` SQLite backup. `src/db/import.ts` opens the foreign DB and dumps its tables; `src/db/money-manager.ts` (`buildImportPlan`) normalizes rows into a plan (merges fee rows into transfers, maps categories, flips sign-flipped types); `src/db/import-apply.ts` (`applyImportPlan`) applies it idempotently inside a transaction, deduping on a content key. Imported accounts default to XOF.
- **Observability** — `src/utils/logger.ts` is a structured in-memory logger (levels, context, session id, 200-entry ring buffer, pluggable sinks). `src/utils/log-store.ts` subscribes a sink that persists warn/error entries to the `app_logs` table (capped at 500), surfaced in **Paramètres → Diagnostics** (`src/app/diagnostics.tsx`). `src/services/observability.ts` bridges warn/error into Sentry (optional: set `EXPO_PUBLIC_SENTRY_DSN` in `.env.local`; without it, local logging only) and scrubs FCFA amounts from events. `src/utils/user-message.ts` maps errors to safe French strings — never show raw errors to the user.
- **Security** — the app is locked with biometrics (`expo-local-authentication`) + a 6-digit PIN fallback, and supports passphrase-protected encrypted backups. Lock config + PIN hash/salt live in `expo-secure-store` (`src/security/store.ts`, Android Keystore), never in the SQLite DB. PINs are hashed with PBKDF2-HMAC-SHA256 (`src/security/pin.ts`, 10k iterations via `@noble/hashes`, constant-time compare, legacy SHA-256 verify fallback); `src/security/pin-attempts.ts` enforces 5 max attempts then a 30s lockout, both persisted in SecureStore. The lock is a UI gate, not at-rest encryption: the DB stays plaintext in the sandbox; `android.allowBackup=false` and a `FLAG_SECURE` config plugin (`plugins/with-flag-secure.js`) prevent cloud backup and recents/screenshot leaks. Lock state machine: `src/state/lock.ts` (store + AppState, statuses `unlocked`/`obscured`/`locked`, configurable delay); overlay UI `src/components/lock-screen.tsx`; PIN keypad `src/components/pin-keypad.tsx`; setup screen `src/app/pin-setup.tsx`; settings `src/app/security.tsx`. Backup file format (`.wlbak`): fixed 34-byte header (`WLTBKUP1` magic, version, kdf id, iterations, salt) used as GCM AAD, then `iv‖ciphertext‖tag` — `src/security/backup-format.ts` (pure, unit-tested), `src/security/kdf.ts` (PBKDF2-HMAC-SHA256 100k via `@noble/hashes`), `src/security/cipher.ts` (AES-256-GCM via `expo-crypto`). Export/restore: `src/backup/export.ts` (serializeAsync → encrypt → share) and `src/backup/restore.ts` (pick file → decrypt → validate in-memory → close/delete/rewrite DB → `bumpDataEpoch()` remounts the Stack via `key={epoch}`). `scripts/verify-backup.mjs` / `scripts/verify-restore.mjs` cross-check the format with `node:crypto`. Restoring does not touch SecureStore, so the lock survives a restore; a forgotten PIN can only be resolved by `resetAppData()` (`src/security/reset-app.ts`), which wipes the DB.

## Conventions

- Path alias `@/*` → `src/*` (also `@/assets/*`). All imports use it.
- SQL columns are `snake_case`; row interfaces and mapped objects are `camelCase`. `src/db/*.ts` always map rows through explicit `AS` aliases to the camelCase shape before returning.
- New user-facing strings are **French**. Money formatting goes through `formatAmount(amountMinor, currency?)` in `src/utils/format.ts` (U+2212 minus; XOF renders as `"1 234 F"`, other currencies as `"1 234,56 EUR"`). Never write money as bare numbers.
- `app.json` enables `typedRoutes` (typed route hrefs) and `reactCompiler` — don't disable either.
- Install Expo-compatible versions with `npx expo install <pkg>` so it resolves the SDK-57-pinned version.
