import { randomUUID } from "node:crypto";
import { mkdir, open, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readSettings } from "../files.js";
import {
  type Config,
  configurationEdit,
  type Edit,
  type Endpoint,
  type Host,
} from "../settings.js";

async function applyEdit(edit: Edit): Promise<boolean> {
  const before = await readSettings(edit.path, edit.initial);
  const next = edit.update(before.content);
  if (next === before.content && (before.private || edit.containsToken === false)) return false;

  await mkdir(dirname(edit.path), { recursive: true, mode: 0o700 });
  const lockPath = `${edit.path}.aidd-otel.lock`;
  const lock = await open(lockPath, "wx", 0o600);
  try {
    const current = await readSettings(edit.path, edit.initial);
    if (
      current.content !== before.content ||
      current.private !== before.private ||
      current.exists !== before.exists
    ) {
      throw new Error("OTLP settings changed during initialization. Retry with the updated file.");
    }
    const temporary = `${edit.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, next, { flag: "wx", mode: 0o600 });
      await rename(temporary, edit.path);
    } finally {
      await rm(temporary, { force: true });
    }
  } finally {
    await lock.close();
    await rm(lockPath, { force: true });
  }
  return true;
}

export async function initializeOtel(config: Config, endpoint: Endpoint, host: Host) {
  const edit = await configurationEdit(config, endpoint, host);
  return { path: edit.path, launch: edit.launch, changed: await applyEdit(edit) };
}
