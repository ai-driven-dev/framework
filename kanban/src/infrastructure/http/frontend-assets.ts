import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface FrontendAssets {
  indexHtml: string;
  stylesCss: string;
  appJs: string;
}

// "kanban-frontend" is where the CLI build copies the assets (cli/tsup.config.ts);
// "frontend" is their location when running from the kanban sources.
const FRONTEND_DIRECTORY_CANDIDATES = ["kanban-frontend", "frontend"];

function resolveFrontendDirectory(): string {
  const moduleDirectory = dirname(fileURLToPath(import.meta.url));

  for (const candidateName of FRONTEND_DIRECTORY_CANDIDATES) {
    const candidate = join(moduleDirectory, candidateName);

    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `KANBAN_FRONTEND_ASSETS_NOT_FOUND: no frontend assets directory next to ${moduleDirectory}`
  );
}

function readAsset(frontendDirectory: string, fileName: string): string {
  return readFileSync(join(frontendDirectory, fileName), "utf-8");
}

export function readFrontendAssets(): FrontendAssets {
  const frontendDirectory = resolveFrontendDirectory();

  return {
    indexHtml: readAsset(frontendDirectory, "index.html"),
    stylesCss: readAsset(frontendDirectory, "styles.css"),
    appJs: readAsset(frontendDirectory, "app.js"),
  };
}
