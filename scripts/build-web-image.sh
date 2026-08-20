#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

image_tag="${WALLET_WEB_IMAGE:-wallet-manager-web:latest}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERREUR: Docker est requis pour construire l'image web." >&2
  exit 1
fi

if [[ ! -s public/app-release.apk ]]; then
  echo "ERREUR: public/app-release.apk est absent." >&2
  echo "Construisez d'abord l'APK avec: npm run build:apk-sm" >&2
  exit 1
fi

echo "==> Construction de l'image $image_tag..."
docker build --tag "$image_tag" .
echo "==> Image prête: $image_tag"
