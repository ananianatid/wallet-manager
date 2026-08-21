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
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Vitrine web

La racine web présente Wallet Manager dans la même direction visuelle que l'application et propose le téléchargement de l'APK Android depuis la dernière GitHub Release.

L'application utilisable sur grand écran est disponible sous `/app`. Elle conserve le même cœur local-first que la version Android : tableau de bord, activité, planification, statistiques, comptes, réglages, import CSV, sauvegardes et récurrences réutilisent les modules métier existants. À partir de 1080 px, la navigation devient une barre latérale ; les écrans plus étroits gardent une barre de navigation basse adaptée au tactile.

Le web est réservé aux comptes cloud vérifiés : les données sont chargées et enregistrées via l'API Fastify dans l'espace PostgreSQL de l'utilisateur. Le navigateur ne reçoit jamais les identifiants PostgreSQL et n'ouvre pas SQLite WASM. Android reste local-first avec SQLite et peut fonctionner sans compte.

En développement, ouvrez `http://localhost:8081/app` après avoir lancé le serveur web Expo. En production, le chemin attendu est `https://votre-domaine/app`.

Pour produire l'APK puis l'export web statique :

```bash
npm run build:apk
npx expo export --platform web
```

Le fichier `public/app-release.apk` est ignoré par Git. Après le build, publiez-le comme asset d'une GitHub Release ; le bouton de la vitrine pointe vers l'asset stable `releases/latest/download/app-release.apk`.

## Déploiement Docker sur un VPS

### API, PostgreSQL et synchronisation

Le backend de synchronisation se trouve dans `server/`. Il utilise Fastify, PostgreSQL et SMTP Infomaniak pour les emails de vérification et de récupération. En production, copiez `server/.env.example` vers `server/.env`, renseignez les secrets hors Git, puis lancez :

```bash
POSTGRES_PASSWORD='mot-de-passe-fort' \
MINIO_ROOT_USER='wallet-minio' \
MINIO_ROOT_PASSWORD='mot-de-passe-minio-fort' \
docker compose -f docker-compose.sync.yml up -d --build
```

Le fichier `server/.env` doit contenir au minimum `DATABASE_URL`, `WEB_ORIGIN`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` et `PUBLIC_API_URL`. Pour PostgreSQL interne au réseau privé, laissez `DATABASE_SSL=false` ; activez-le uniquement si le serveur PostgreSQL distant impose TLS. PostgreSQL et MinIO ne publient aucun port sur Internet ; Nginx transmet uniquement `/api/` au conteneur Fastify. Ne commitez jamais ces variables ni les mots de passe SMTP, PostgreSQL ou MinIO. Pour un APK Android, renseignez aussi `EXPO_PUBLIC_API_URL` avec l’URL absolue publique terminant par `/api` avant le build ; `/api` seul est réservé au web servi par le même domaine.

Les routes d’authentification disponibles sont `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/delete-account`, `/api/auth/recover-account`, `/api/auth/sessions` et `/api/auth/me`. La synchronisation structurée utilise `/api/sync/push` et `/api/sync/pull` avec contrôle de version et réponse de conflit. Les pièces jointes cloud utilisent `/api/attachments` et sont limitées à 10 Mo par fichier.

La production web est une image statique Nginx. Elle ne démarre ni Laravel ni un serveur Node ; elle transmet `/api/` au service Fastify, qui protège l'accès à PostgreSQL. Aucun stockage métier n'est conservé dans le navigateur.

Construisez l'image web :

```bash
npm run docker:build
```

L'APK Android est indépendant du déploiement Docker de la vitrine. Pour produire l'asset de release :

```bash
npm run build:apk-sm
gh release create v1.0.0 public/app-release.apk \
  --title "Wallet Manager 1.0.0" \
  --notes "Première version Android distribuable."
```

La vitrine ne dépend pas de la présence locale de l’APK pendant le build Docker. Pour lancer uniquement le web localement :

```bash
docker run --rm \
  --name wallet-manager-web \
  -p 8080:80 \
  wallet-manager-web:latest
```

Vérifications locales :

```bash
curl -I http://localhost:8080/
curl http://localhost:8080/healthz
curl -I -L https://github.com/ananianatid/wallet-manager/releases/latest/download/app-release.apk
```

Sur le VPS, publiez le port du conteneur uniquement en local afin que le reverse proxy HTTPS existant puisse le joindre :

```bash
docker run -d \
  --name wallet-manager-web \
  --restart unless-stopped \
  -p 127.0.0.1:8080:80 \
  wallet-manager-web:latest
```

Le reverse proxy du domaine doit ensuite transmettre le trafic vers `127.0.0.1:8080`. Le endpoint `/healthz` est prévu pour le contrôle de disponibilité.

Pour un domaine avec compte cloud, utilisez `docker-compose.sync.yml` : le Nginx de cette image transmet `/api/` au service `wallet-api` du réseau Compose privé. Un conteneur web lancé seul sert les écrans locaux mais ne peut pas joindre l’API cloud.

Sur ce VPS, `docker-stack.vps.yml` est un déploiement Docker Swarm manuel réalisé à côté de Dokploy. Il rejoint le réseau externe `dokploy-network` déjà utilisé par la vitrine, tout en gardant PostgreSQL et MinIO sur un réseau privé. Cette méthode n’apparaît pas dans l’historique des déploiements de l’application Dokploy ; pour obtenir cet historique, il faudra créer l’API comme application Dokploy et la déployer depuis Dokploy :

```bash
export WALLET_API_IMAGE='wallet-manager-api:release-YYYYMMDD-HHMM'
export WALLET_WEB_IMAGE='wallet-manager-web:release-YYYYMMDD-HHMM'
export POSTGRES_PASSWORD='mot-de-passe-fort'
export MINIO_ROOT_USER='wallet-minio'
export MINIO_ROOT_PASSWORD='mot-de-passe-minio-fort'
docker stack deploy --compose-file docker-stack.vps.yml wallet-manager
```

Pour automatiser le contrôle des variables, la validation de la configuration et l’attente de la convergence de l’API, utilisez [`ops/deploy-vps-stack.sh`](ops/deploy-vps-stack.sh) depuis le manager Swarm :

```bash
WALLET_API_IMAGE='wallet-manager-api:release-YYYYMMDD-HHMM' \
WALLET_WEB_IMAGE='wallet-manager-web:release-YYYYMMDD-HHMM' \
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
