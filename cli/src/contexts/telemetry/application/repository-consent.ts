import type { ConsentSource } from "../domain/ports/consent-source.js";
import { type Consent, consentOf } from "../domain/telemetry-consent.js";

/** What a working tree's project grants. A linked worktree often carries no
 * `.aidd/config.json` of its own, the file being untracked, so the main working tree answers
 * for it. */
export async function consentOfRoot(
  source: ConsentSource,
  root: string,
  mainRoot: string
): Promise<Consent> {
  const own = await source.read(root);
  const text = own === null && mainRoot !== root ? await source.read(mainRoot) : own;
  return consentOf(text);
}
