# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Monitoring & logs

- **Sentry optionnel** : copiez `.env.example` vers `.env.local` et renseignez `EXPO_PUBLIC_SENTRY_DSN`. Pour les builds natifs avec source maps, renseignez aussi `SENTRY_ORG`, `SENTRY_PROJECT` et le secret `SENTRY_AUTH_TOKEN`. Sans DSN, l'app fonctionne normalement (journalisation locale uniquement). Les erreurs techniques sont alors envoyées à Sentry selon sa configuration.
- **Journal structuré** : `src/utils/logger.ts` (niveaux, contexte, session, erreurs). Les entrées warn/error sont persistées dans SQLite (`app_logs`) et visibles dans **Réglages → Préférences → Diagnostics**, avec l'état de chaque sous-système.
- **Erreurs utilisateur** : aucun message technique n'est affiché à l'écran ; `userMessage()` (`src/utils/user-message.ts`) mappe les erreurs vers un texte français sûr.

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Application Android

Wallet Manager est livré comme application Android local-first avec SQLite. La synchronisation cloud facultative passe par l'API Fastify, PostgreSQL et MinIO ; Android doit recevoir une URL absolue via `EXPO_PUBLIC_API_URL`.

Pour produire l'APK Android :

```bash
npm run build:apk
```

## Déploiement Docker sur un VPS

### API, PostgreSQL et synchronisation

Le backend de synchronisation se trouve dans `server/`. Il utilise Fastify, PostgreSQL et SMTP Infomaniak pour les emails de vérification et de récupération. En production, copiez `server/.env.example` vers `server/.env`, renseignez les secrets hors Git, puis lancez :

```bash
POSTGRES_PASSWORD='mot-de-passe-fort' \
MINIO_ROOT_USER='wallet-minio' \
MINIO_ROOT_PASSWORD='mot-de-passe-minio-fort' \
docker compose -f docker-compose.sync.yml up -d --build
```

Le fichier `server/.env` doit contenir au minimum `DATABASE_URL`, `WEB_ORIGIN`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` et `PUBLIC_API_URL`. Pour PostgreSQL interne au réseau privé, laissez `DATABASE_SSL=false` ; activez-le uniquement si le serveur PostgreSQL distant impose TLS. PostgreSQL et MinIO ne publient aucun port sur Internet. Ne commitez jamais ces variables ni les mots de passe SMTP, PostgreSQL ou MinIO. Pour un APK Android, renseignez `EXPO_PUBLIC_API_URL` avec l’URL absolue publique terminant par `/api` avant le build.

Les routes d’authentification disponibles sont `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/delete-account`, `/api/auth/recover-account`, `/api/auth/sessions` et `/api/auth/me`. La synchronisation structurée utilise `/api/sync/push` et `/api/sync/pull` avec contrôle de version et réponse de conflit. Les pièces jointes cloud utilisent `/api/attachments` et sont limitées à 10 Mo par fichier.

L'APK Android est indépendant du déploiement Docker de l'API. Pour produire l'asset de release :

```bash
npm run build:apk-sm
gh release create v1.0.0 public/app-release.apk \
  --title "Wallet Manager 1.0.0" \
  --notes "Première version Android distribuable."
```

Sur ce VPS, `docker-stack.vps.yml` est un déploiement Docker Swarm manuel réalisé à côté de Dokploy. L'API rejoint le réseau externe `dokploy-network`, tandis que PostgreSQL et MinIO restent sur un réseau privé :

```bash
export WALLET_API_IMAGE='wallet-manager-api:release-YYYYMMDD-HHMM'
export POSTGRES_PASSWORD='mot-de-passe-fort'
export MINIO_ROOT_USER='wallet-minio'
export MINIO_ROOT_PASSWORD='mot-de-passe-minio-fort'
docker stack deploy --compose-file docker-stack.vps.yml wallet-manager
```

Pour automatiser le contrôle des variables, la validation de la configuration et l’attente de la convergence de l’API, utilisez [`ops/deploy-vps-stack.sh`](ops/deploy-vps-stack.sh) depuis le manager Swarm :

```bash
WALLET_API_IMAGE='wallet-manager-api:release-YYYYMMDD-HHMM' \
POSTGRES_PASSWORD='...' \
MINIO_ROOT_USER='...' \
MINIO_ROOT_PASSWORD='...' \
bash ops/deploy-vps-stack.sh
```

Si le SMTP n’est pas encore disponible, les services de données peuvent être amorcés seuls avec [`docker-stack.data.vps.yml`](docker-stack.data.vps.yml). Ils utilisent le même réseau et les mêmes volumes que la stack complète ; aucun port PostgreSQL ou MinIO n’est publié sur Internet.

Avant le déploiement, `server/.env` doit exister sur le VPS et utiliser `wallet-postgres` comme hôte PostgreSQL. Chargez l’image API sur le nœud Swarm avec `docker load` ou utilisez un registre privé ; ne déployez jamais une image locale non chargée sur tous les nœuds d’un cluster multi-nœuds.

### Sauvegardes PostgreSQL

Le script [`ops/backup-postgres.sh`](ops/backup-postgres.sh) réalise un dump PostgreSQL, le chiffre localement avec AES-256-CBC/PBKDF2, vérifie le dump avec `pg_restore`, calcule un HMAC-SHA256, puis envoie l’archive et son fichier d’intégrité vers un stockage S3-compatible. Configurez ses variables uniquement dans le job cron/systemd du VPS (`DATABASE_URL`, endpoint/bucket/identifiants S3 et `BACKUP_ENCRYPTION_PASSPHRASE`). Testez régulièrement le déchiffrement et la restauration dans une base isolée ; ne restaurez jamais directement dans la base de production.

La restauration contrôlée se fait avec [`ops/restore-postgres.sh`](ops/restore-postgres.sh) et exige `RESTORE_CONFIRM=I_UNDERSTAND` ainsi qu’un `TARGET_DATABASE_URL` explicite. Avant un déploiement, exécutez [`ops/check-deployment-env.sh`](ops/check-deployment-env.sh) avec les variables du VPS et une `EXPO_PUBLIC_API_URL` HTTPS absolue.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
