import { describe, expect, it } from "vitest";
import { ElevatedPermissionUpdateError } from "../../../../src/shared/domain/errors.js";
import { FakeCliInstaller } from "../testing/fake-cli-installer.js";
import { FakeCliReleaseSource } from "../testing/fake-cli-release-source.js";
import { aSelfUpdate } from "../testing/update-builders.js";

const NOTES = { version: "2.6.0", changelog: "Release notes" };
const off = { check: false, dryRun: false, force: false };

function over(installed: string, installer = new FakeCliInstaller()) {
  const useCase = aSelfUpdate()
    .installed(installed)
    .withReleases(new FakeCliReleaseSource(NOTES))
    .withInstaller(installer)
    .build();
  return { useCase, installer };
}

describe("SelfUpdate", () => {
  it("says what is waiting when asked only to check", async () => {
    const { useCase, installer } = over("2.5.0");

    expect(await useCase.execute({ ...off, check: true })).toStrictEqual({
      kind: "check-available",
      latestVersion: "2.6.0",
      currentVersion: "2.5.0",
    });
    expect(installer.ran).toStrictEqual([]);
  });

  it("installs when outdated and answers the notes and the binary replaced", async () => {
    const { useCase, installer } = over("2.5.0");

    expect(await useCase.execute(off)).toStrictEqual({
      kind: "updated",
      latestVersion: "2.6.0",
      changelog: "Release notes",
      binaryPath: "/usr/local/bin/aidd",
    });
    expect(installer.ran).toHaveLength(1);
  });

  it("installs nothing when already on the latest, unless forced", async () => {
    const { useCase, installer } = over("2.6.0");

    expect(await useCase.execute(off)).toStrictEqual({ kind: "up-to-date", version: "2.6.0" });
    expect(installer.ran).toStrictEqual([]);
    expect((await useCase.execute({ ...off, force: true })).kind).toBe("updated");
  });

  it("previews without installing", async () => {
    const { useCase, installer } = over("2.5.0");

    expect(await useCase.execute({ ...off, dryRun: true })).toStrictEqual({
      kind: "dry-run",
      latestVersion: "2.6.0",
    });
    expect(installer.ran).toStrictEqual([]);
  });

  it("lets the installer's refusal through", async () => {
    const { useCase } = over("2.5.0", new FakeCliInstaller({ kind: "fails", stderr: "EPERM" }));

    await expect(useCase.execute(off)).rejects.toBeInstanceOf(ElevatedPermissionUpdateError);
  });
});
