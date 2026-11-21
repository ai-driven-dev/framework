import { describe, expect, it } from "vitest";
import { CapturingLogger } from "../../../shared/testing/capturing-logger.fake.js";
import { aCachedTokenProvider } from "../testing/auth.builder.js";
import { anExternalRecord, aStoredRecord } from "../testing/credential-record.builder.js";
import { FakeCliAuthProvider } from "../testing/fake-cli-auth-provider.fake.js";
import { InMemoryCredentialRecordRepository } from "../testing/in-memory-credential-record-repository.fake.js";

interface Row {
  commandLine?: string;
  environment?: string;
  project?: ReturnType<typeof aStoredRecord>;
  user?: ReturnType<typeof aStoredRecord>;
  token: string | null;
  logged: string;
}

const ROWS: [string, Row][] = [
  [
    "a command-line token alone",
    { commandLine: "cli", token: "cli", logged: "Token given on the command line" },
  ],
  [
    "the command line wins over AIDD_TOKEN and a stored record",
    {
      commandLine: "flag-token",
      environment: "env-token",
      project: aStoredRecord({ level: "project", token: "project-token" }),
      token: "flag-token",
      logged: "Token given on the command line",
    },
  ],
  [
    "AIDD_TOKEN answers when no command line was given",
    {
      environment: "env-token",
      project: aStoredRecord({ level: "project", token: "project-token" }),
      token: "env-token",
      logged: "Token resolved from AIDD_TOKEN env",
    },
  ],
  [
    "a stored project record",
    {
      project: aStoredRecord({ level: "project", token: "project-token" }),
      user: aStoredRecord({ token: "user-token" }),
      token: "project-token",
      logged: "Token resolved from project auth.json (stored)",
    },
  ],
  [
    "a stored user record",
    {
      user: aStoredRecord({ token: "user-token" }),
      token: "user-token",
      logged: "Token resolved from user auth.json (stored)",
    },
  ],
  [
    "an external project record",
    {
      project: anExternalRecord({ level: "project" }),
      token: "gh_tok",
      logged: "Token resolved from project auth.json (external)",
    },
  ],
  [
    "an external user record",
    {
      user: anExternalRecord(),
      token: "gh_tok",
      logged: "Token resolved from user auth.json (external)",
    },
  ],
  ["nothing", { token: null, logged: "No token available" }],
];

function aProviderOver(
  given: Omit<Row, "token" | "logged">,
  token: string,
  logger: CapturingLogger
) {
  const records = new InMemoryCredentialRecordRepository();
  if (given.project) records.seed("project", given.project);
  if (given.user) records.seed("user", given.user);
  const builder = aCachedTokenProvider()
    .withRecords(records)
    .withExternalTokens(new FakeCliAuthProvider({ token }))
    .withLogger(logger);
  if (given.commandLine !== undefined) builder.withCommandLine(given.commandLine);
  if (given.environment !== undefined) builder.withEnvironmentToken(given.environment);
  return builder.build();
}

describe("CachedTokenProvider", () => {
  describe("the order of sources", () => {
    it.each(ROWS)("%s answers its token and logs where it came from", async (_row, row) => {
      const logger = new CapturingLogger();

      expect(await aProviderOver(row, "gh_tok", logger).resolve()).toBe(row.token);
      expect(logger.debugMessages).toStrictEqual([row.logged]);
    });
  });

  describe("when asked several times", () => {
    it("reads each record once and asks the provider once", async () => {
      const records = new InMemoryCredentialRecordRepository().seed("user", anExternalRecord());
      const gh = new FakeCliAuthProvider();
      const provider = aCachedTokenProvider().withRecords(records).withExternalTokens(gh).build();

      await provider.resolve();
      await provider.resolve();
      await provider.resolve();

      expect(records.reads).toEqual(["project", "user"]);
      expect(gh.reads).toBe(1);
    });
  });

  describe("logging", () => {
    it.each([
      ["the command line", { commandLine: "my-secret" }],
      ["AIDD_TOKEN", { environment: "my-secret" }],
      ["a stored record", { user: aStoredRecord({ token: "my-secret" }) }],
      ["an external record", { user: anExternalRecord() }],
    ])("never logs the token, whatever the source: %s", async (_source, given) => {
      const logger = new CapturingLogger();

      expect(await aProviderOver(given, "my-secret", logger).resolve()).toBe("my-secret");
      expect(logger.allMessages.length).toBeGreaterThan(0);
      expect(logger.allMessages.filter((message) => message.includes("my-secret"))).toEqual([]);
    });
  });
});
