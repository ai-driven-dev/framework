import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AIDD_CONFIG_FILENAME, AIDD_DIR } from "../../../../kernel/paths.js";
import type { ProjectConfigWriter } from "../../domain/ports/switch/project-config-writer.js";

/** `.aidd/config.json` is a project file a team may track: written as an ordinary file, not
 * with the owner-only storage a person's own measurement gets. */
export class ProjectConfigAdapter implements ProjectConfigWriter {
  async write(root: string, text: string): Promise<void> {
    await mkdir(join(root, AIDD_DIR), { recursive: true });
    await writeFile(join(root, AIDD_DIR, AIDD_CONFIG_FILENAME), text, "utf8");
  }
}
