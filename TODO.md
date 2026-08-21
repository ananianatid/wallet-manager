# TODO — wallet-manager

> ## Consignes pour l’agent — début de fichier
>
> 1. Lis entièrement ce fichier avant d’agir.
> 2. Vérifie d’abord l’état du dépôt avec `git status` et repère les modifications existantes.
> 3. Comprends le contexte du projet avant de modifier du code : fichiers concernés, conventions et dépendances.
> 4. Traite les tâches dans l’ordre de priorité indiqué. Ne modifie pas les fichiers sans rapport.
> 5. Avant toute implémentation importante, explique brièvement ton interprétation et les risques éventuels.
> 6. Ne marque une tâche comme terminée qu’après une validation adaptée : tests, typecheck, lint, build ou vérification manuelle.
> 7. N’efface, ne réinitialise et ne remplace jamais le travail existant sans autorisation explicite.
> 8. Si tu es bloqué, indique la cause exacte, les vérifications effectuées et la décision attendue.

## Priorités

- [x] P0 — Base locale et build APK arm64
- [ ] P1 — Synchronisation complète et parcours de compte
- [ ] P2 — Exploitation VPS, sauvegardes et validation appareil

## Tâches

### En cours

- [x] P1 — Implémenter le merge initial, les conflits et la gestion des sessions côté UI (validation locale ; parcours distant à vérifier).
- [x] P2 — Relier les pièces jointes SQLite existantes au stockage MinIO (validation de déploiement et restauration encore à faire).

### À faire

- [ ] TODO-001 — P1 — Bilan mensuel par compte : solde début, transactions et solde fin
  - Statut : À faire
  - Propriétaire : non assigné
  - Créée par : Codex
  - Créée le : 2026-08-21

- [ ] Déployer PostgreSQL/API/MinIO derrière nginx sur le VPS avec secrets hors Git.
- [ ] Configurer un job quotidien `ops/backup-postgres.sh` et tester une restauration isolée.
- [ ] Vérifier le parcours Android sur téléphone réel et le parcours web sur PC.

### Terminé

- [x] Backend Fastify, migration PostgreSQL, auth email/mot de passe et synchronisation structurée initiale.
- [x] Migration SQLite v21 : `sync_id`, version locale et file d’attente hors ligne.
- [x] Migration SQLite v22 : synchronisation des associations `transaction_tags`.
- [x] Écran de bienvenue natif : choix compte ou utilisation sans compte.
- [x] Synchronisation automatique au lancement et au retour au premier plan, sans bloquer le mode invité.
- [x] Vérification email, renvoi de vérification et réinitialisation du mot de passe côté API/UI.
- [x] Rotation et révocation du refresh token mobile à la déconnexion.
- [x] Centre local de conflits avec choix explicite serveur/local.
- [x] Suppression cloud différée de 30 jours, récupération par email et purge opérable séparément.
- [x] Script de sauvegarde PostgreSQL chiffrée et vérifiée avant upload S3-compatible.
- [x] Script de restauration isolée protégée et vérificateur des variables de production.
- [x] HMAC-SHA256 associé aux sauvegardes et vérifié avant restauration.
- [x] API MinIO privée : upload multipart limité à 10 Mo, URL temporaire et suppression par workspace.
- [x] `npm test -- --runInBand` : 40 suites, 284 tests réussis.
- [x] `npx tsc --noEmit` et `git diff --check` réussis.
- [x] `npm run lint` : 0 erreur (3 avertissements historiques dans `src/db/journal.test.ts`).
- [x] `npm run build:apk-sm` : APK arm64 généré dans `dist/` avec nom horodaté.

## Notes de contexte

<!-- Ajouter ici les décisions, contraintes, commandes utiles et résultats importants. -->

- Un build précédent avait produit `dist/wallet-manager-arm64-20-08-2026-17-39-05.apk`.
- Le dernier APK arm64 vérifié produit `dist/wallet-manager-arm64-20-08-2026-21-59-05.apk`, label Android `Wallet Manager`, package `com.ananianatid.wallettheapp`, ABI `arm64-v8a`, URL cloud HTTPS embarquée. SHA-256 : `17e4ac52aa461ab48eb19c0f574157481a4ae16e8a8a59f9c7ef5a3a4e7a068f`. Les alias `dist/app-release.apk` et `public/app-release.apk` pointent vers ce build.
- L’image `wallet-manager-api:validation` se construit correctement. La validation Compose complète attend `server/.env`, volontairement absent tant que les secrets de déploiement ne sont pas fournis.
- L’image API a été reconstruite après l’ajout de MinIO et du cycle de vie des comptes ; le build Docker est réussi.
- Validation d’intégration locale : Compose a démarré PostgreSQL, MinIO, API et Nginx ; `/api/healthz` et `/api/readyz` ont répondu 200, la page web a servi `Wallet Manager`, et les migrations PostgreSQL `001` et `002` ont été appliquées. Les volumes et le `.env` de test ont été supprimés ensuite.
- Export web SDK 57 validé dans `/private/tmp/wallet-manager-web-check` : 71 routes statiques générées, dont `/`, `/cloud-welcome`, `/cloud-account`, `/sync-conflicts` et `/reset-password`.
- Déploiement web VPS validé le 20 août : le service Swarm `wallet-manager-web-tsifzj` sert désormais l’image corrigée, `https://wallet-manager.causalset.sbs/` répond 200 et `/app-release.apk` répond 200 avec une empreinte SHA-256 identique au fichier local.
- Après le build cloud-aware, l’image `wallet-manager-web-tsifzj:20260820-215905` a été chargée sur le VPS et le service Swarm a convergé en `1/1`. L’APK public répond 200, taille `55355893` octets, avec la même empreinte SHA-256 que le build local.
- L’image web a été rendue démarrable sans API grâce à la résolution Nginx à la requête ; le proxy `/api/` détectera `wallet-api` lorsqu’il sera déployé. La première tentative a été automatiquement rollbackée par Swarm car l’ancien proxy résolvait l’upstream au démarrage.
- `docker-stack.vps.yml` est un déploiement Docker Swarm manuel à côté de Dokploy : API sur `dokploy-network`, PostgreSQL et MinIO sur un réseau overlay privé. Il n’est pas enregistré comme un déploiement dans le dashboard Dokploy ; l’application web Dokploy et la stack `wallet-manager` sont deux objets distincts.
- Le 21 août, les secrets d’exploitation ont été configurés directement sur le VPS hors Git ; le transport SMTP Infomaniak a été vérifié depuis le conteneur API sans envoyer de message de test.
- PostgreSQL 17 et MinIO sont déployés sur `wallet-manager_wallet-private`, sans ports publics ; l’API utilise l’image `wallet-manager-api:20260821-054726`.
- Vérification publique du 21 août : `https://wallet-manager.causalset.sbs/api/healthz` et `/api/readyz` répondent `200` avec `{"ok":true}` ; le service API, PostgreSQL et MinIO sont tous en `1/1`.
- L’image API `wallet-manager-api:20260820-214800` a été construite localement puis chargée avec succès sur le VPS ; elle est prête pour le déploiement Swarm.
- La politique de confidentialité décrit désormais les deux modes : utilisation locale sans compte et synchronisation cloud facultative avec compte vérifié.
- `ops/deploy-vps-stack.sh` automatise la validation des secrets, la configuration Swarm et l’attente de la convergence de `wallet-api` ; il ne contient aucune valeur secrète.
- Le défaut découvert au premier démarrage (SSL PostgreSQL forcé alors que la base privée n’utilise pas TLS) a été corrigé par `DATABASE_SSL`, désactivé par défaut pour le réseau interne.
- Les contrôles sans effet de bord retournent `401 AUTH_REQUIRED` pour `/api/auth/me` et `401 INVALID_CREDENTIALS` pour une connexion invalide, confirmant que les routes d’authentification sont accessibles derrière Nginx.
- Contrôle de reprise du 21 août : la vitrine, l’API, PostgreSQL et MinIO restent tous en `1/1`, et les endpoints publics de santé répondent toujours `200`. Aucun appareil Android ADB n’est connecté pour la validation physique.
- Le 21 août, une vitrine indépendante `wallet-manager_wallet-web` a été ajoutée à la stack Swarm avec une route Traefik prioritaire. L’ancienne application Dokploy `wallet-manager-web-tsifzj` peut rester à `0/0` : le domaine HTTPS et `/app-release.apk` répondent toujours `200`, et l’API répond `{"ok":true}`.
- L’inscription est transactionnelle avec l’insertion du jeton de vérification : un échec SMTP ne laisse plus de compte partiellement créé et renvoie `EMAIL_DELIVERY_FAILED`.
- L’ADB n’a pas permis de valider l’installation sur téléphone dans cet environnement ; la validation appareil reste à faire.
- Ne pas ajouter de vraies valeurs SMTP, PostgreSQL, MinIO ou tokens dans `.env`, Git ou l’APK.

> ## Consignes pour l’agent — fin de fichier
>
> Avant de terminer :
>
> - mets à jour les cases et les sections concernées ;
> - conserve les tâches non terminées et les blocages ;
> - vérifie `git diff --check` ainsi que les validations pertinentes ;
> - résume les fichiers modifiés, les tests exécutés et leurs résultats ;
> - distingue clairement ce qui est terminé, proposé, non vérifié ou bloqué ;
> - ne fais pas de commit sans demande ou autorisation explicite.
