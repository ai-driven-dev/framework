import { homedir as osHomedir } from "node:os";

/** `HOME` first, because `os.homedir()` never reads it on Windows: a `HOME` set under Git
 * Bash or by a test sandbox is ignored by a bare call there. Every site naming a tool's
 * session files resolves through here. */
export function resolveHomeDir(
  env: NodeJS.ProcessEnv = process.env,
  osHomedirFn: () => string = osHomedir
): string {
  return env.HOME || osHomedirFn();
}
