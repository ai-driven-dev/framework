import { join } from "node:path";
import { AIDD_CONFIG_FILENAME, AIDD_DIR } from "../../../kernel/paths.js";
import { readTextIfPresent } from "../../../kernel/reading/text-file.js";
import type { ConsentSource } from "../domain/ports/consent-source.js";

export class ConsentSourceAdapter implements ConsentSource {
  read(root: string): Promise<string | null> {
    return readTextIfPresent(join(root, AIDD_DIR, AIDD_CONFIG_FILENAME));
  }
}
