#!/usr/bin/env bash
set -euo pipefail

required=(
  DATABASE_URL WEB_ORIGIN SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD SMTP_FROM PUBLIC_API_URL
  MINIO_ENDPOINT MINIO_PORT MINIO_ACCESS_KEY MINIO_SECRET_KEY MINIO_BUCKET
  POSTGRES_PASSWORD MINIO_ROOT_USER MINIO_ROOT_PASSWORD
)

missing=0
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" || "${!name}" == *change-me* || "${!name}" == *example.com* ]]; then
    echo "Variable absente ou valeur de démonstration: $name" >&2
    missing=1
  fi
done

if [[ "${EXPO_PUBLIC_API_URL:-}" != https://* ]]; then
  echo "EXPO_PUBLIC_API_URL doit être une URL HTTPS absolue pour Android." >&2
  missing=1
fi

if (( missing )); then exit 1; fi
echo "Variables de déploiement présentes et non démonstratives."
