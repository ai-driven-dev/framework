import { constants } from "node:fs";
import { lstat, mkdir, open, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import openCodePlugin from "../../../../../../assets/configs/otel-opencode-plugin.js.txt";
import { type Host, openCodeConfigDir } from "../settings.js";

export const openCodePluginDirectory = (host: Host) =>
  join(openCodeConfigDir(host), "plugins", "aidd-otel");

export async function hasOpenCodePlugin(host: Host): Promise<boolean> {
  const directory = openCodePluginDirectory(host);
  try {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error("Invalid OpenCode plugin directory.");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
  for (const name of await readdir(directory)) {
    if (
      name === "package.json" ||
      name === "server" ||
      name.startsWith("server.") ||
      (name !== "index.js" && (name === "index" || name.startsWith("index.")))
    )
      throw new Error("OpenCode telemetry plugin has a competing entry point.");
  }
  try {
    const file = await open(
      join(directory, "index.js"),
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    );
    try {
      const info = await file.stat();
      if (
        !info.isFile() ||
        (info.mode & 0o022) !== 0 ||
        (await file.readFile("utf8")) !== openCodePlugin
      )
        throw new Error("OpenCode telemetry plugin is unsafe or has different content.");
      return true;
    } finally {
      await file.close();
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

export async function installOpenCodePlugin(host: Host): Promise<boolean> {
  if (await hasOpenCodePlugin(host)) return false;
  const directory = openCodePluginDirectory(host);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink())
    throw new Error("Invalid OpenCode plugin directory.");
  if (await hasOpenCodePlugin(host)) return false;
  await writeFile(join(directory, "index.js"), openCodePlugin, { flag: "wx", mode: 0o600 });
  return true;
}
