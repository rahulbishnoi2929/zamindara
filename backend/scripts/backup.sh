#!/usr/bin/env bash
# Dump a Supabase database and encrypt it.
#
#   BACKUP_PASSPHRASE=... ./backup.sh <db-url> <out.tar.gz.gpg>
#
# The free plan has no automatic backups at all (Pro and above only), and
# Supabase's own docs tell free projects to do exactly this. The three files
# and their flags are Supabase's documented backup procedure:
# https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
#
# Encrypted because the dump holds every farmer's phone number and field
# boundary, and it is going to sit in GitHub's artifact storage.
set -euo pipefail

url=${1:?db url}
out=${2:?output file}
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

supabase db dump --db-url "$url" -f "$work/roles.sql" --role-only
supabase db dump --db-url "$url" -f "$work/schema.sql"
supabase db dump --db-url "$url" -f "$work/data.sql" --use-copy --data-only \
  -x storage.buckets_vectors -x storage.vector_indexes

tar -czf "$work/backup.tar.gz" -C "$work" roles.sql schema.sql data.sql
gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
  --symmetric --cipher-algo AES256 -o "$out" "$work/backup.tar.gz" \
  3<<<"$BACKUP_PASSPHRASE"

ls -l "$out"
