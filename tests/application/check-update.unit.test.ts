import { describe, expect, it, vi } from "vitest";
import { CheckUpdateUseCase } from "../../src/application/use-cases/check-update-use-case.js";
import type { Logger } from "../../src/domain/ports/logger.js";
import type { SelfUpdater } from "../../src/domain/ports/self-updater.js";
import type { VersionReader } from "../../src/domain/ports/version-reader.js";

function makeLogger(): { logger: Logger; logs: string[] } {
  const logs: string[] = [];
  const logger: Logger = {
    debug: () => {},
    info: () => {},
    warn: (m: string) => logs.push(m),
  };
  return { logger, logs };
}

function makeSelfUpdater(latestVersion: string): SelfUpdater {
  return {
    fetchLatestRelease: vi.fn().mockResolvedValue({ version: latestVersion, changelog: "" }),
    install: vi.fn().mockReturnValue("/usr/local/bin/aidd"),
  };
}

function makeVersionReader(version: string): VersionReader {
  return { get: () => version };
}

describe("CheckUpdateUseCase", () => {
  it("warns when CLI is outdated", async () => {
    const { logger, logs } = makeLogger();

    await new CheckUpdateUseCase(
      makeSelfUpdater("v2.0.0"),
      makeVersionReader("1.0.0"),
      logger
    ).execute();

    expect(logs.some((l) => l.includes("CLI update available"))).toBe(true);
    expect(logs.some((l) => l.includes("aidd self-update"))).toBe(true);
  });

  it("stays silent when CLI version matches latest", async () => {
    const { logger, logs } = makeLogger();

    await new CheckUpdateUseCase(
      makeSelfUpdater("v1.0.0"),
      makeVersionReader("1.0.0"),
      logger
    ).execute();

    expect(logs).toHaveLength(0);
  });

  it("stays silent when fetch fails", async () => {
    const { logger, logs } = makeLogger();
    const failing: SelfUpdater = {
      fetchLatestRelease: vi.fn().mockRejectedValue(new Error("network failure")),
      install: vi.fn().mockReturnValue("/usr/local/bin/aidd"),
    };

    await new CheckUpdateUseCase(failing, makeVersionReader("1.0.0"), logger).execute();

    expect(logs).toHaveLength(0);
  });

  it("skips banner when skipCliCheck is true", async () => {
    const { logger, logs } = makeLogger();

    await new CheckUpdateUseCase(
      makeSelfUpdater("v2.0.0"),
      makeVersionReader("1.0.0"),
      logger
    ).execute({ skipCliCheck: true });

    expect(logs).toHaveLength(0);
  });
});
