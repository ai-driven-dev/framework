import { constants } from "node:fs";
import { open } from "node:fs/promises";

export async function readSettings(path: string, initial: string) {
  const handle = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
  ).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!handle) return { content: initial, private: false, exists: false };
  try {
    const info = await handle.stat();
    if (!info.isFile()) throw new Error("OTLP configuration must be a regular file.");
    return {
      content: await handle.readFile("utf8"),
      private: (info.mode & 0o077) === 0,
      exists: true,
    };
  } finally {
    await handle.close();
  }
}
