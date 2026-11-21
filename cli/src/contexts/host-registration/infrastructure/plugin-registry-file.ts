import { readFile } from "node:fs/promises";
import { describeError } from "../../../shared/domain/describe-error.js";
import type { HostPluginRegistryReading } from "../domain/reading/plugin-registry-reading.js";

/**
 * A host registry file, read once and handed to the layout that knows its content. A file that
 * does not exist is absent, an answer; one that cannot be opened or understood is unreadable,
 * never a guess.
 */
export async function readPluginRegistryFile(
  path: string,
  layout: (content: string) => HostPluginRegistryReading | Promise<HostPluginRegistryReading>
): Promise<HostPluginRegistryReading> {
  let content: string;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "ENOENT"
      ? { location: path, absent: true }
      : { location: path, unreadable: describeError(error) };
  }
  try {
    return await layout(content);
  } catch (error) {
    return { location: path, unreadable: describeError(error) };
  }
}
