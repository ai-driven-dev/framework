import { describe, expect, it } from "vitest";
import {
  activeCredential,
  type CredentialSource,
  firstToken,
  type SuppliedTokens,
  sourcesInOrder,
} from "../../../../src/contexts/auth/domain/credential-sources.js";
import { InMemoryEnvironment } from "../../../helpers/ports/in-memory-environment.js";
import { anExternalRecord, aStoredRecord } from "../testing/credential-records.js";
import { InMemoryCredentialRecordRepository } from "../testing/in-memory-credential-record-repository.js";

function supplied(commandLine?: string, environmentToken?: string): SuppliedTokens {
  const environment = new InMemoryEnvironment(
    environmentToken === undefined ? {} : { AIDD_TOKEN: environmentToken }
  );
  return commandLine === undefined ? { environment } : { commandLine, environment };
}

function sources(
  tokens: SuppliedTokens,
  records: InMemoryCredentialRecordRepository
): AsyncIterable<CredentialSource> {
  return sourcesInOrder(tokens, (level) => records.read(level));
}

async function all(iterable: AsyncIterable<CredentialSource>): Promise<CredentialSource[]> {
  const out: CredentialSource[] = [];
  for await (const source of iterable) out.push(source);
  return out;
}

const noExternal = (): string | null => {
  throw new Error("the provider was asked");
};

describe("the sources, in order", () => {
  it("are the command line, then AIDD_TOKEN, then the project record, then the user one", async () => {
    const records = new InMemoryCredentialRecordRepository()
      .seed("project", aStoredRecord({ level: "project" }))
      .seed("user", aStoredRecord());

    const found = await all(sources(supplied("cli", "env"), records));

    expect(found.map((source) => (source.kind === "record" ? source.level : source.kind))).toEqual([
      "command-line",
      "environment",
      "project",
      "user",
    ]);
  });

  it("leave out an empty command-line token, an empty AIDD_TOKEN and a level holding no record", async () => {
    const records = new InMemoryCredentialRecordRepository().seed("user", aStoredRecord());

    const found = await all(sources(supplied("", ""), records));

    expect(found).toStrictEqual([{ kind: "record", level: "user", record: aStoredRecord() }]);
  });

  it("read a level only once every source before it was passed over", async () => {
    const records = new InMemoryCredentialRecordRepository();

    await firstToken(sources(supplied(undefined, "env"), records), noExternal);
    expect(records.reads, "AIDD_TOKEN answered, so no record is read").toEqual([]);

    records.seed("project", aStoredRecord({ level: "project", token: "ghp_p" }));
    await firstToken(sources(supplied(), records), noExternal);
    expect(records.reads, "the project record answered, so the user one is not read").toEqual([
      "project",
    ]);
  });
});

describe("when a record yields no token", () => {
  it("falls past a stored record carrying none", async () => {
    const records = new InMemoryCredentialRecordRepository()
      .seed("project", aStoredRecord({ level: "project", token: undefined }))
      .seed("user", aStoredRecord({ token: "ghp_u" }));

    expect((await firstToken(sources(supplied(), records), noExternal))?.token).toBe("ghp_u");
  });

  it("never asks the provider for a stored record", async () => {
    const records = new InMemoryCredentialRecordRepository().seed(
      "project",
      aStoredRecord({ level: "project", token: "" })
    );

    expect(await firstToken(sources(supplied(), records), noExternal)).toBeNull();
  });

  it("asks the provider for an external record even when a token sits in it", async () => {
    const records = new InMemoryCredentialRecordRepository().seed(
      "project",
      anExternalRecord({ level: "project", token: "stale" })
    );

    const found = await firstToken(sources(supplied(), records), () => "gh_tok");

    expect(found?.token).toBe("gh_tok");
  });

  it.each([
    ["nothing", null],
    ["an empty token", ""],
  ])("falls past an external record the provider answers %s for", async (_answer, token) => {
    const records = new InMemoryCredentialRecordRepository()
      .seed("project", anExternalRecord({ level: "project" }))
      .seed("user", aStoredRecord({ token: "ghp_u" }));

    const found = await firstToken(sources(supplied(), records), () => token);

    expect(found).toStrictEqual({
      token: "ghp_u",
      source: { kind: "record", level: "user", record: aStoredRecord({ token: "ghp_u" }) },
    });
  });

  it("answers nothing when no source yields a token", async () => {
    expect(
      await firstToken(sources(supplied(), new InMemoryCredentialRecordRepository()), noExternal)
    ).toBeNull();
  });
});

describe("the active credential", () => {
  it("is a project record even when it carries no token", async () => {
    const records = new InMemoryCredentialRecordRepository()
      .seed("project", anExternalRecord({ level: "project", provider: undefined }))
      .seed("user", aStoredRecord({ token: "user-tok" }));

    expect(await activeCredential(sources(supplied(), records))).toStrictEqual(
      anExternalRecord({ level: "project", provider: undefined })
    );
  });

  it("is the project record when one exists", async () => {
    const records = new InMemoryCredentialRecordRepository()
      .seed("project", aStoredRecord({ level: "project", token: "project-tok" }))
      .seed("user", aStoredRecord());

    expect(await activeCredential(sources(supplied(), records))).toMatchObject({
      level: "project",
      token: "project-tok",
    });
  });

  it("is the user record when no project record exists", async () => {
    const records = new InMemoryCredentialRecordRepository().seed(
      "user",
      aStoredRecord({ token: "user-tok" })
    );

    expect(await activeCredential(sources(supplied(), records))).toMatchObject({
      level: "user",
      token: "user-tok",
    });
  });

  it("is nothing when nothing is stored", async () => {
    expect(
      await activeCredential(sources(supplied(), new InMemoryCredentialRecordRepository()))
    ).toBeNull();
  });

  it("with AIDD_TOKEN set, is a stored user credential carrying it, whatever is on disk", async () => {
    const records = new InMemoryCredentialRecordRepository().seed(
      "project",
      anExternalRecord({ level: "project" })
    );

    expect(await activeCredential(sources(supplied(undefined, "ghp_env"), records))).toStrictEqual({
      method: "stored",
      level: "user",
      token: "ghp_env",
    });
  });

  it("is never a token the command line carried", async () => {
    expect(
      await activeCredential(sources(supplied("cli"), new InMemoryCredentialRecordRepository()))
    ).toBeNull();
  });
});

describe("the two stop rules", () => {
  it("take the token from the user record while the active credential is the tokenless project record", async () => {
    const records = new InMemoryCredentialRecordRepository()
      .seed("project", aStoredRecord({ level: "project", token: undefined }))
      .seed("user", aStoredRecord({ token: "ghp_u" }));

    expect((await firstToken(sources(supplied(), records), noExternal))?.token).toBe("ghp_u");
    expect(await activeCredential(sources(supplied(), records))).toMatchObject({
      level: "project",
    });
  });
});
