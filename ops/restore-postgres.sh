#!/usr/bin/env bash
set -euo pipefail

# Restauration volontairement séparée de la base de production.
: "${BACKUP_FILE:?BACKUP_FILE doit pointer vers un fichier .dump.enc}"
: "${BACKUP_HMAC_FILE:?BACKUP_HMAC_FILE doit pointer vers le fichier .dump.enc.sha256 associé}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL doit pointer vers une base isolée}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE est requis}"
: "${RESTORE_CONFIRM:?RESTORE_CONFIRM doit être égal à I_UNDERSTAND}"

if [[ "$RESTORE_CONFIRM" != "I_UNDERSTAND" ]]; then
  echo "Refus: définissez RESTORE_CONFIRM=I_UNDERSTAND pour confirmer la restauration destructive." >&2
  exit 1
fi

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
dump_file="$work_dir/restore.dump"

expected_checksum="$(awk '{print $1}' "$BACKUP_HMAC_FILE")"
actual_checksum="$(openssl dgst -sha256 -hmac "$BACKUP_ENCRYPTION_PASSPHRASE" "$BACKUP_FILE" | awk '{print $2}')"
if [[ -z "$expected_checksum" || "$actual_checksum" != "$expected_checksum" ]]; then
  echo "Refus: l’intégrité HMAC de la sauvegarde n’est pas valide." >&2
  exit 1
fi

openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$BACKUP_FILE" -out "$dump_file" \
  -pass env:BACKUP_ENCRYPTION_PASSPHRASE
pg_restore --list "$dump_file" > /dev/null

pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl \
  --dbname "$TARGET_DATABASE_URL" "$dump_file"

echo "Restauration terminée dans la base explicitement fournie par TARGET_DATABASE_URL."
