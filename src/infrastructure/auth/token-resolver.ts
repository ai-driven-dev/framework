import { execSync } from "node:child_process";
import type { Logger } from "../../domain/ports/logger.js";

export interface TokenResolverOptions {
  flag?: string;
  logger?: Logger;
}

export class TokenResolver {
  resolve(options?: TokenResolverOptions): string | null {
    const logger = options?.logger;

    if (options?.flag) {
      logger?.debug("Token resolved from --token flag");
      return options.flag;
    }

    const envToken = process.env.AIDD_TOKEN;
    if (envToken) {
      logger?.debug("Token resolved from AIDD_TOKEN env");
      return envToken;
    }

    const ghToken = resolveFromGh();
    if (ghToken) {
      logger?.debug("Token resolved from gh auth token");
      return ghToken;
    }

    logger?.debug("No token available");
    return null;
  }
}

function resolveFromGh(): string | null {
  try {
    const output = execSync("gh auth token", {
      timeout: 3000,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const token = output.trim();
    return token || null;
  } catch {
    return null;
  }
}
