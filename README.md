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

La racine web présente Wallet Manager dans la même direction visuelle que l'application et propose le téléchargement de l'APK Android.

Pour produire l'APK puis l'export web statique :

```bash
npm run build:apk
npx expo export --platform web
```

Le fichier `public/app-release.apk` est ignoré par Git et sera copié dans l'export web. Le bouton de téléchargement de la vitrine pointe vers `/app-release.apk`.

## Déploiement Docker sur un VPS

La production web est une image statique Nginx. Elle ne démarre ni Laravel ni un serveur Node, et les données restent locales au navigateur.

Construisez d'abord l'APK, puis l'image web :

```bash
npm run build:apk-sm
npm run docker:build
```

Le build Docker vérifie que `public/app-release.apk` existe avant de construire l'image. Pour lancer l'image localement :

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
curl -I http://localhost:8080/app-release.apk
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
