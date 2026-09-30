import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { TelemetrySinkRecord } from "../../../../src/contexts/telemetry/domain/telemetry-sink-record.js";
import { TelemetrySinkAdapter } from "../../../../src/contexts/telemetry/infrastructure/telemetry-sink-adapter.js";

const RECORD: TelemetrySinkRecord = {
  sink_schema_version: 2,
  kind: "request",
  provenance: "export",
  tool: "claude",
  vendor_id: "s-1",
  vendor_field: "session.id",
  cost_usd: 1,
  step_attribution: "unattributed",
};

const ENV_KEYS = [
  "PATH",
  "HOME",
  "APPDATA",
  "USERDOMAIN",
  "USERNAME",
  "ICACLS_LOG",
  "AIDD_TELEMETRY_DIR",
  "AIDD_USER_CONFIG_DIR",
] as const;

const DAY = new Date("2026-08-17T10:00:00Z");

describe.skipIf(process.platform === "win32")(
  "a default location on Windows is restricted to this account through icacls",
  () => {
    const previousEnv = new Map<string, string | undefined>();
    const previousPlatform = Object.getOwnPropertyDescriptor(process, "platform");
    let sandbox: string;
    let logPath: string;

    beforeEach(() => {
      for (const key of ENV_KEYS) previousEnv.set(key, process.env[key]);
      sandbox = mkdtempSync(join(tmpdir(), "aidd-sink-acl-"));
      const bin = join(sandbox, "bin");
      mkdirSync(bin);
      logPath = join(sandbox, "icacls.log");
      writeFileSync(join(bin, "icacls"), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$ICACLS_LOG"\n');
      chmodSync(join(bin, "icacls"), 0o755);
      process.env.PATH = `${bin}:${process.env.PATH ?? ""}`;
      process.env.ICACLS_LOG = logPath;
      process.env.HOME = join(sandbox, "home");
      process.env.APPDATA = join(sandbox, "appdata");
      process.env.USERDOMAIN = "ACME";
      process.env.USERNAME = "ada";
      delete process.env.AIDD_TELEMETRY_DIR;
      delete process.env.AIDD_USER_CONFIG_DIR;
      Object.defineProperty(process, "platform", { value: "win32", configurable: true });
    });

    afterEach(() => {
      if (previousPlatform) Object.defineProperty(process, "platform", previousPlatform);
      for (const key of ENV_KEYS) {
        const value = previousEnv.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
      rmSync(sandbox, { recursive: true, force: true });
    });

    function calls(): string[] {
      try {
        return readFileSync(logPath, "utf8").trim().split("\n");
      } catch {
        return [];
      }
    }

    it("grants the directory to DOMAIN\\user alone, recursively, on ensureWritable", async () => {
      const sink = new TelemetrySinkAdapter();

      await sink.ensureWritable();

      expect(sink.rootDir).toBe(join(sandbox, "appdata", "aidd", "telemetry"));
      expect(calls()).toStrictEqual([
        `${sink.rootDir} /inheritance:r /grant:r ACME\\ada:(OI)(CI)F /T /C /Q`,
      ]);
    });

    it("grants a day file to this user alone, once, on the append that creates it", async () => {
      const sink = new TelemetrySinkAdapter();

      const { filePath } = await sink.appendRecord(RECORD, DAY);
      await sink.appendRecord(RECORD, DAY);

      const dir = `${sink.rootDir} /inheritance:r /grant:r ACME\\ada:(OI)(CI)F /T /C /Q`;
      expect(calls()).toStrictEqual([
        dir,
        `${filePath} /inheritance:r /grant:r ACME\\ada:F /C /Q`,
        dir,
      ]);
    });

    it("names the user without a domain when USERDOMAIN is unset", async () => {
      delete process.env.USERDOMAIN;
      const sink = new TelemetrySinkAdapter();

      await sink.ensureWritable();

      expect(calls()).toStrictEqual([
        `${sink.rootDir} /inheritance:r /grant:r ada:(OI)(CI)F /T /C /Q`,
      ]);
    });

    it("runs icacls for nobody when no account name resolves", async () => {
      delete process.env.USERDOMAIN;
      process.env.USERNAME = "";
      const sink = new TelemetrySinkAdapter();

      await sink.ensureWritable();
      await sink.appendRecord(RECORD, DAY);

      expect(calls()).toStrictEqual([]);
    });

    it("leaves a location the person named themselves untouched, directory and day file alike", async () => {
      process.env.AIDD_TELEMETRY_DIR = join(sandbox, "shared");
      const sink = new TelemetrySinkAdapter();

      await sink.ensureWritable();
      await sink.appendRecord(RECORD, DAY);

      expect(calls()).toStrictEqual([]);
    });
  }
);
