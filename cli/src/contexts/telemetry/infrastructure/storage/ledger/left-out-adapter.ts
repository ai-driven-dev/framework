import { createHash } from "node:crypto";
import { join } from "node:path";
import { compareText } from "../../../domain/text-order.js";
import type { PrivateStorage } from "../../../ports/private-storage.js";
import type { LeftOutEntry, LeftOutReason, LeftOutStore } from "../../../ports/usage-ledger.js";
import { readTextIfPresent } from "../../reading/text-file.js";

/** What ingests measured and could not store, in one file beside the ledger: `<reason> <hash>`
 * per line, the hash of the reason and of what the thing is, in text order, each once. A line
 * this version does not know is kept and not counted. Written under the ledger's lock. */
export class LeftOutAdapter implements LeftOutStore {
  private readonly path: string;

  constructor(
    private readonly dir: string,
    private readonly storage: PrivateStorage
  ) {
    this.path = join(dir, "left-out.txt");
  }

  async add(entries: readonly LeftOutEntry[]): Promise<void> {
    const held = (await readTextIfPresent(this.path)) ?? "";
    const named = entries.map(
      ({ reason, of }) =>
        `${reason} ${createHash("sha256").update(`${reason}\u0000${of}`).digest("hex").slice(0, 32)}`
    );
    const lines = [...new Set([...held.split("\n").filter(Boolean), ...named])].sort(compareText);
    const content = lines.map((line) => `${line}\n`).join("");
    if (content === held) return;
    await this.storage.ensureDirectory(this.dir);
    await this.storage.replace(this.path, content);
  }

  async counts(): Promise<Readonly<Record<LeftOutReason, number>>> {
    const text = `\n${(await readTextIfPresent(this.path)) ?? ""}`;
    const count = (reason: LeftOutReason) => text.split(`\n${reason} `).length - 1;
    return {
      undated: count("undated"),
      unrecognised: count("unrecognised"),
      requestless: count("requestless"),
    };
  }
}
