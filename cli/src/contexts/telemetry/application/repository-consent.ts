import type { ConsentSource } from "../domain/ports/consent-source.js";
import { type Consent, consentOf } from "../domain/telemetry-consent.js";

/** What a clone grants. The key lives in the repository's common git config, so every linked
 * worktree answers as the clone does. */
export async function consentOfRoot(source: ConsentSource, root: string): Promise<Consent> {
  return consentOf(await source.read(root));
}
