# Central database reference for platform bootstrap

The central dump supplied on 2026-11-10 contains 41 tables. A **structure-only** reference is stored at `src/app/backend/central-schema/20261110_reference.sql`; its machine-readable required table/column/unique-index manifest is under `deployment/ubuntu/central-baseline.manifest.json`.

No INSERT statements, administrators, password hashes, customer data, encrypted secrets, infrastructure addresses, audit records or runtime settings from the supplied dump are committed. Table AUTO_INCREMENT counters are removed. The reference contains 491 column names and 89 unique indexes, including primary keys. It is not a migration and is not a seeded fresh central database. It must not be replayed onto an existing populated database.

## Separation of central and network databases

Initial platform hosting prepares the frontend, backend and **central** database. This central reference is never a template for tenant databases. Creating a new environment continues to use the existing `src/app/backend/tenant-schema/create_tenant_database.sql` and the existing provisioning flow, which creates an isolated database and installs the chosen manager account, subscription/license data and operating configuration.

A record in `tenant_databases`, `tenants` or `schema_versions` does not mean that that tenant database has been copied or exists on the new host. The supplied central dump records multiple historical tenant schema versions. Existing registered network databases are not silently regenerated, wiped or certified by importing the central database. A platform deployment intended to start new networks does not need to copy test-network data, but it must preserve/review existing central records explicitly rather than treating them as a clean central seed.

## Central import and read-only verification

`database-import` still requires an approved SHA256 and an empty scoped target database. After importing, it validates all required tables and column names and the exact names/ordered column lists of unique indexes, rather than only checking seven table names. Additional columns/tables are allowed; the reference is a required structural floor.

For an already restored central database, use the read-only SQL verification phase:

```bash
sudo bash deployment/ubuntu/radius-installer.sh database-verify --profile /root/radius-deployment-profile.json --secrets /root/radius-private-secrets.json
```

The SQL verification uses the application account and `information_schema` only. It writes a host-private verification receipt, never alters SQL structure/data, and does not expose row values. Receiver setup copies the matching manifest beside the trusted Git hook. New-host preflight requires the receipt's reference version to match it.

The receipt explicitly leaves `migrationsVerified=false` and `tenantDatabasesVerified=false`. Column types/defaults/collations, foreign keys, reference seed completeness, business invariants and tenant compatibility are **not** certified by this table/column/index inventory. Those are separate reviewed migration/acceptance concerns. The existing release migration adapter is still required when SQL changes are involved; passing this verification does not bypass it.

## Static review of supplied dump

The dump declares MySQL 8.0.46, has no CREATE DATABASE/USE directives and no DEFINER clauses. Those properties fit the scoped single-database import path. No SQL was executed, no live database was accessed and the raw dump was not added to Git. Lexical extraction and reference inventory were performed locally; Bash/Python syntax checks were used for modified setup files. Live import and application/provisioning acceptance remain pending.
