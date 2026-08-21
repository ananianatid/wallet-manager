#!/usr/bin/env bash
set -euo pipefail

# À exécuter depuis la racine du projet sur le manager Swarm. Les secrets
# doivent être injectés dans l'environnement du job ou du shell, jamais dans
# ce script ni dans Git.
project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

: "${WALLET_API_IMAGE:?WALLET_API_IMAGE est requis}"
: "${WALLET_WEB_IMAGE:?WALLET_WEB_IMAGE est requis}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD est requis}"
: "${MINIO_ROOT_USER:?MINIO_ROOT_USER est requis}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD est requis}"

if [[ ! -f server/.env ]]; then
  echo "ERREUR: server/.env est absent sur le manager Swarm." >&2
  exit 1
fi

set -a
# server/.env est un fichier d’exploitation local, exclu de Git.
source server/.env
set +a

# Le fichier de contrôle refuse les valeurs de démonstration et vérifie aussi
# l'URL HTTPS destinée aux builds Android.
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-https://wallet-api.causalset.sbs/api}"
export POSTGRES_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD
bash ops/check-deployment-env.sh

docker stack config \
  --compose-file docker-stack.vps.yml \
  >/dev/null

echo "==> Déploiement de la stack wallet-manager..."
docker stack deploy \
  --compose-file docker-stack.vps.yml \
  --with-registry-auth \
  wallet-manager

echo "==> Attente de la convergence Swarm..."
deadline=$((SECONDS + 120))
while (( SECONDS < deadline )); do
  api_replicas="$(docker service ls --filter name=wallet-manager_wallet-api --format '{{.Replicas}}' | head -n 1)"
  web_replicas="$(docker service ls --filter name=wallet-manager_wallet-web --format '{{.Replicas}}' | head -n 1)"
  if [[ "$api_replicas" == "1/1" && "$web_replicas" == "1/1" ]]; then
    echo "API convergée: $api_replicas; web convergent: $web_replicas"
    exit 0
  fi
  echo "API: ${api_replicas:-service absente}; web: ${web_replicas:-service absent}; nouvelle vérification..."
  sleep 5
done

echo "ERREUR: la stack n'a pas convergé dans le délai prévu." >&2
docker service ps wallet-manager_wallet-api --no-trunc || true
docker service ps wallet-manager_wallet-web --no-trunc || true
exit 1
