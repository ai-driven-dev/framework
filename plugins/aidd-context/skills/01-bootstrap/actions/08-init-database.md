# 08 - Init database

Stand up the database: connection, migration tool, a baseline migration, seed fixtures, and a proven round-trip. Conditional - skip when the project has no database (no DB driver was installed in `06`).

## Inputs

- The database driver and migration tool installed by `06-init-dependencies`.
- The connection config from `07-init-env`.

## Process

1. Configure the connection from the environment (see `07-init-env`).
2. Set up the migration tool installed in `06`.
3. Create and run a baseline migration.
4. Add seed **fixtures** (minimal sample data) behind a repeatable, idempotent load command.
5. Prove a round-trip: load the fixtures, then connect and query them back.

## Test

- [ ] Baseline migration runs.
- [ ] Fixtures load idempotently (re-running the loader is safe).
- [ ] Connection round-trips: a query returns the seeded data.
