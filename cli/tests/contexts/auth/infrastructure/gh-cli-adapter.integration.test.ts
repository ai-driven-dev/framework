import { afterEach, describe, expect, it } from "vitest";
import { GhCliAdapter } from "../../../../src/contexts/auth/infrastructure/gh-cli-adapter.js";
import { AuthenticationError } from "../../../../src/shared/domain/shared.error.js";
import {
  aMachineWith,
  type StubBehaviour,
  type StubBinary,
} from "../testing/stub-binary.builder.js";

describe("GhCliAdapter on a machine with a gh script", () => {
  let machine: StubBinary;

  afterEach(async () => {
    await machine.dispose();
  });

  async function givenGh(behaviour: StubBehaviour | null): Promise<GhCliAdapter> {
    machine = await aMachineWith("gh", behaviour);
    return new GhCliAdapter();
  }

  describe("the commands it runs", () => {
    it("reads the token through `gh auth token`", async () => {
      const gh = await givenGh({ stdout: "ghp_abc\n" });

      gh.read();

      expect(await machine.invocations()).toStrictEqual([["auth", "token"]]);
    });

    it("reads the login through `gh api user`", async () => {
      const gh = await givenGh({ stdout: "octocat\n" });

      await gh.verify();

      expect(await machine.invocations()).toStrictEqual([["api", "user", "--jq", ".login"]]);
    });

    it("gives up on a gh that never answers a token read, after 3 s", async () => {
      const gh = await givenGh({ hangs: true });
      const started = Date.now();

      expect(gh.read()).toBeNull();

      expect(Date.now() - started).toBeGreaterThanOrEqual(2900);
      expect(Date.now() - started).toBeLessThan(4500);
    }, 10_000);

    it("gives up on a gh that never answers a login read, after 5 s", async () => {
      const gh = await givenGh({ hangs: true });
      const started = Date.now();

      await expect(gh.verify()).rejects.toThrow(new AuthenticationError("gh CLI"));

      expect(Date.now() - started).toBeGreaterThanOrEqual(4900);
      expect(Date.now() - started).toBeLessThan(6500);
    }, 12_000);
  });

  describe("resolving a token", () => {
    it("answers the token gh prints, trimmed", async () => {
      expect((await givenGh({ stdout: "ghp_abc123\n" })).read()).toBe("ghp_abc123");
    });

    it("answers null when gh is absent", async () => {
      expect((await givenGh(null)).read()).toBeNull();
    });

    it("answers null when gh prints nothing", async () => {
      expect((await givenGh({ stdout: "   " })).read()).toBeNull();
    });
  });

  describe("when gh fails", () => {
    it.each([
      ["names the exit code when gh wrote nothing", { status: 1 }, "exited with code 1"],
      [
        "names the upgrade when gh lacks `auth token`",
        { status: 1, stderr: 'unknown command "token" for "gh auth"' },
        "gh CLI is too old to support",
      ],
      [
        "names its stderr, trimmed",
        { status: 1, stderr: "  boom  \n" },
        "gh auth token failed: boom",
      ],
    ])("%s", async (_case, behaviour, detail) => {
      const gh = await givenGh(behaviour);

      expect(() => gh.read()).toThrow(
        expect.objectContaining({ detail: expect.stringContaining(detail) })
      );
    });
  });

  it.skipIf(process.platform === "win32")(
    "says the code is unknown when gh left none",
    async () => {
      const gh = await givenGh({ killed: true });

      expect(() => gh.read()).toThrow(
        expect.objectContaining({ detail: expect.stringContaining("exited with code unknown") })
      );
    }
  );

  describe("verifying", () => {
    it("answers the login gh prints, trimmed", async () => {
      expect(await (await givenGh({ stdout: "  octocat\n" })).verify()).toBe("octocat");
    });

    it.each([
      ["is absent", null],
      ["exits non-zero", { status: 1, stderr: "not logged in", stdout: "octocat\n" }],
      ["prints an empty login", { stdout: "  \n" }],
    ])("refuses when gh %s", async (_situation, behaviour) => {
      const gh = await givenGh(behaviour);

      await expect(gh.verify()).rejects.toThrow(new AuthenticationError("gh CLI"));
    });
  });
});
