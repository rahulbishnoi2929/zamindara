#!/usr/bin/env bash
# Decrypt a backup and load it into a database.
#
#   BACKUP_PASSPHRASE=... ./restore.sh <in.tar.gz.gpg> <db-url>
#
# The target must be a NEW, empty Supabase project: the schema file creates
# every table. This is Supabase's documented restore, unchanged: one
# transaction, stop on the first error, triggers off while data loads (so
# the audit and area triggers do not run a second time on restored rows).
set -euo pipefail

in=${1:?backup file}
url=${2:?db url}
: "${BACKUP_PASSPHRASE:?set BACKUP_PASSPHRASE}"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

gpg --batch --yes --pinentry-mode loopback --passphrase-fd 3 \
  --decrypt -o "$work/backup.tar.gz" "$in" 3<<<"$BACKUP_PASSPHRASE"
tar -xzf "$work/backup.tar.gz" -C "$work"

# A new Supabase project grants anon and authenticated everything created in
# public, automatically. pg_dump writes each object's grants relative to
# Postgres' own default, not Supabase's: it writes "REVOKE ... FROM PUBLIC"
# and the GRANTs, never "REVOKE ... FROM anon". So every function a migration
# had locked away from anon came back callable by anyone — CI caught exactly
# that. The automatic grants are off while the schema loads, so each object
# gets precisely the grants it had, and back on after (the dump's trailing
# ALTER DEFAULT PRIVILEGES also restores them) so later migrations behave as
# they always have.
cat > "$work/defaults-off.sql" <<'SQL'
alter default privileges in schema public revoke all on tables from anon, authenticated, service_role;
alter default privileges in schema public revoke all on sequences from anon, authenticated, service_role;
alter default privileges in schema public revoke all on functions from anon, authenticated, service_role;
SQL
cat > "$work/defaults-on.sql" <<'SQL'
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
SQL

psql \
  --single-transaction \
  --variable ON_ERROR_STOP=1 \
  --file "$work/roles.sql" \
  --file "$work/defaults-off.sql" \
  --file "$work/schema.sql" \
  --file "$work/defaults-on.sql" \
  --command 'SET session_replication_role = replica' \
  --file "$work/data.sql" \
  --dbname "$url"
