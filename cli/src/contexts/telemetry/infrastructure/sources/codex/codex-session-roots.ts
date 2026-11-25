import { join } from "node:path";

/** Where Codex keeps its session files. `codexHome` is `CODEX_HOME`. Archiving moves a file
 * from the first to the second. */
export function codexSessionRoots(codexHome: string | undefined, home: string): string[] {
  const dir = codexHome === undefined || codexHome === "" ? join(home, ".codex") : codexHome;
  return [join(dir, "sessions"), join(dir, "archived_sessions")];
}
