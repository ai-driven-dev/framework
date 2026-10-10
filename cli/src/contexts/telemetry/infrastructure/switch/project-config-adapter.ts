import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AIDD_CONFIG_FILENAME, AIDD_DIR } from "../../../../kernel/paths.js";
import { readTextIfPresent } from "../../../../kernel/reading/text-file.js";
import type { ProjectConfigFile } from "../../domain/ports/switch/project-config-file.js";

/** `.aidd/config.json` is a project file a team may track: written as an ordinary file, not
 * with the owner-only storage a person's own measurement gets. */
export class ProjectConfigAdapter implements ProjectConfigFile {
  read(root: string): Promise<string | null> {
    return readTextIfPresent(join(root, AIDD_DIR, AIDD_CONFIG_FILENAME));
  }

  async write(root: string, text: string): Promise<void> {
    await mkdir(join(root, AIDD_DIR), { recursive: true });
    await writeFile(join(root, AIDD_DIR, AIDD_CONFIG_FILENAME), text, "utf8");
  }

  async remove(root: string): Promise<void> {
    await rm(join(root, AIDD_DIR, AIDD_CONFIG_FILENAME), { force: true });
  }
}
