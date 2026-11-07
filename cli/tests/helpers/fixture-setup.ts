import { join } from "node:path";

/** The real-shaped framework a command reads as a local source. */
export const FRAMEWORK_REAL = join(import.meta.dirname, "..", "fixtures", "framework-real");

/** `setup` from the local framework fixture, answering every question. */
export function setupFromFixture(
  ai: string,
  plugins: string,
  extra: readonly string[] = [],
  source: string = FRAMEWORK_REAL
): string[] {
  return [
    "setup",
    "--source",
    "local",
    "--path",
    source,
    "--ai",
    ai,
    "--plugins",
    plugins,
    "--yes",
    ...extra,
  ];
}
