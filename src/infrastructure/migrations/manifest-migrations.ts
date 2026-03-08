export interface ManifestMigration {
  fromVersion: number;
  toVersion: number;
  migrate(data: Record<string, unknown>): Record<string, unknown>;
}

export const CURRENT_MANIFEST_VERSION = 1;

export const MANIFEST_MIGRATIONS: ManifestMigration[] = [
  {
    fromVersion: 0,
    toVersion: 1,
    migrate(data) {
      return { ...data, version: 1 };
    },
  },
];

export function applyMigrations(
  data: Record<string, unknown>,
  logger?: { info(msg: string): void },
  migrations: ManifestMigration[] = MANIFEST_MIGRATIONS
): Record<string, unknown> {
  const currentVersion = typeof data.version === "number" ? data.version : 0;

  if (currentVersion === CURRENT_MANIFEST_VERSION) {
    return data;
  }

  let result = { ...data };
  let version = currentVersion;

  for (const migration of migrations) {
    if (version === migration.fromVersion) {
      logger?.info(`Migrating manifest from v${migration.fromVersion} to v${migration.toVersion}`);
      try {
        result = migration.migrate(result);
        version = migration.toVersion;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Manifest migration failed from version ${migration.fromVersion} to ${migration.toVersion}: ${msg}. Run \`aidd doctor\` to diagnose.`
        );
      }
    }
  }

  return result;
}
