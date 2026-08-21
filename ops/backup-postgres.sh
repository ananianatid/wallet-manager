#!/usr/bin/env bash
set -euo pipefail

# Exécution attendue sur l’hôte VPS, avec pg_dump, pg_restore, openssl et aws.
# Les secrets doivent venir de l’environnement du job cron/systemd, jamais du Git.
: "${DATABASE_URL:?DATABASE_URL est requis}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT est requis}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET est requis}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY est requis}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY est requis}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE est requis}"

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT

stamp="$(date -u '+%Y-%m-%dT%H-%M-%SZ')"
dump_file="$work_dir/wallet-${stamp}.dump"
encrypted_file="$work_dir/wallet-${stamp}.dump.enc"
hmac_file="$work_dir/wallet-${stamp}.dump.enc.sha256"

pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > "$dump_file"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 600000 \
  -in "$dump_file" -out "$encrypted_file" \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE

# Vérification locale avant envoi : le fichier doit pouvoir être déchiffré et
# reconnu comme dump PostgreSQL valide.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$encrypted_file" -out "$work_dir/verified.dump" \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE
pg_restore --list "$work_dir/verified.dump" > /dev/null

checksum="$(openssl dgst -sha256 -hmac "$BACKUP_ENCRYPTION_PASSPHRASE" "$encrypted_file" | awk '{print $2}')"
printf '%s  %s\n' "$checksum" "$(basename "$encrypted_file")" > "$hmac_file"

AWS_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" \
AWS_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
AWS_DEFAULT_REGION="${BACKUP_S3_REGION:-us-east-1}" \
aws s3 cp "$encrypted_file" "s3://${BACKUP_S3_BUCKET}/postgres/${stamp}.dump.enc" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --sse AES256
aws s3 cp "$hmac_file" "s3://${BACKUP_S3_BUCKET}/postgres/${stamp}.dump.enc.sha256" \
  --endpoint-url "$BACKUP_S3_ENDPOINT" \
  --sse AES256

echo "Sauvegarde PostgreSQL chiffrée envoyée: postgres/${stamp}.dump.enc"
