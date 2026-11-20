# Backup and restore

**Supabase's free plan takes no backups.** Daily backups are a Pro-plan feature, and Supabase's own docs tell free projects to export with the CLI and keep the copy somewhere else ([backups](https://supabase.com/docs/guides/platform/backups), read 20 Nov 2026). Until this workflow runs, the live database is the only copy of every farmer's fields and every job.

## What runs

`.github/workflows/backup.yml`, every night at 03:00 India time:

1. `backend/scripts/backup.sh` dumps three files with the Supabase CLI. These are Supabase's documented procedure: roles, schema, and data including the `auth` accounts.
2. They are tarred, gzipped and encrypted with `gpg` (AES-256) using `BACKUP_PASSPHRASE`.
3. The encrypted file is uploaded as a GitHub Actions artifact and **kept for 30 days**.

## One-time setup (your part)

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | Supabase dashboard → Connect → **Session pooler** connection string, with the database password filled in. GitHub's runners have no IPv6, so the direct connection will not work. |
| `BACKUP_PASSPHRASE` | Long and random. **Write it down somewhere that is not GitHub**, e.g. on paper next to the keystore backup. If it is lost, every backup is unreadable, including to you. If it leaks, so is every backup. |

Until both exist, the job runs, prints "nothing backed up" and stays green. Then trigger it once by hand (**Actions → Nightly backup → Run workflow**) and check that an artifact appears.

## Restoring

Only into a **new, empty Supabase project**. The schema file creates every table, so it cannot load on top of an existing one.

1. Create the new project. Copy its Session pooler connection string.
2. Download the artifact from the Actions run (it is a zip containing the `.gpg` file) and unzip it.
3. With the Supabase CLI, `psql` and `gpg` installed:
   ```bash
   BACKUP_PASSPHRASE='…' backend/scripts/restore.sh zamindara-2027-04-12.tar.gz.gpg 'postgresql://…'
   ```
4. Point the app at the new project. The URL and anon key are in the app config, so this is an over-the-air update rather than a new APK.

The restore runs in one transaction, so it either loads completely or changes nothing.

## How we know the restore works

A backup that has never been restored does not count. **Every CI run** does the following:

1. Inserts a real farmer, with his sign-in account, a field and a job.
2. Backs up and encrypts. A wrong passphrase must fail to restore.
3. Wipes the database back to what a new Supabase project looks like, and restores.
4. Compares the rows, the field boundary, the trigger-computed area, RLS, the policies, and **who can call or read every function and table**.
5. Runs all the database guarantee tests again, on the restored copy.

### What the proof caught

The first run matched every row count, and the guarantee tests still failed on the restored copy. **Two locked functions had come back callable by anyone:** `dispatch_job` by signed-out users, and the internal `accept_job_claim` by everyone.

The cause: a new Supabase project automatically grants `anon` and `authenticated` on everything created in `public`. pg_dump writes each object's permissions relative to plain Postgres, so it writes `REVOKE … FROM PUBLIC` but never `REVOKE … FROM anon`. `restore.sh` now turns those automatic grants off while the schema loads, and back on afterwards.

**A trap that remains, guarded by CI:** the Supabase CLI drops every `GRANT` and `REVOKE` line that mentions `"extensions"`, to skip platform schemas. A function with a PostGIS parameter (type `extensions.geography`) therefore loses its grants in the dump. Today that only affects `road_km`, which everyone may call anyway, so nothing changes. If a future migration **locks down** a function with a geography parameter, the restore would open it again, and the CI fingerprint will fail. If that happens, re-apply that function's `REVOKE` at the end of `restore.sh`.

## Cost, measured

- **Size:** 22 KB encrypted with the seed data and one farmer. It grows with fields and jobs. Thirty copies stay far inside the free **500 MB** of artifact storage, which GitHub shares with Packages, until a single backup passes about 15 MB. At that point cut `retention-days`.
- **Minutes:** GitHub Free includes $12 a month of Actions compute, about 2,000 standard Linux minutes, and with no card on file it **stops rather than bills** ([billing](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions)). A nightly backup is about 2 minutes, so roughly 60 minutes a month. See [COSTS](COSTS.md) for the whole budget.

## Not verified

- A backup of the **hosted** project. There is none yet. The first manual run after adding the secrets is that check.
- Whether a nightly dump counts as "activity" for Supabase's rule that **free projects pause after 1 week of inactivity**. Do not rely on it: in season the app keeps the project awake, and out of season, check the dashboard.
