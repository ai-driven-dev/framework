import { readFileSync } from "node:fs";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function getPackageVersion(): string {
  try {
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(currentDir, "..", "package.json");
    const raw = readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

export function formatVersion(): string {
  const version = getPackageVersion();
  const nodeVersion = process.versions.node;
  const arch = process.arch;
  const os = platform();
  return `aidd/${version} node/${nodeVersion} ${os}-${arch}`;
}

export function printSuccess(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function printError(message: string): void {
  process.stderr.write(`Error: ${message}\n`);
}

export function printWarning(message: string): void {
  process.stderr.write(`Warning: ${message}\n`);
}

export function printVerbose(message: string): void {
  process.stderr.write(`[verbose] ${message}\n`);
}

export function printProgress(message: string): void {
  process.stderr.write(`${message}\n`);
}
