import { existsSync } from "node:fs";

export function resolveProjectRoot(): string {
  const pwd = process.env.PWD;
  if (pwd && existsSync(pwd)) return pwd;
  return process.cwd();
}
