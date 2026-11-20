import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createContainer } from "../../src/composition/container.js";
import { wireInstallation } from "../../src/composition/installation.js";
import { CLIOutput } from "../../src/presentation/output.js";
import { catalogOf } from "../contexts/tools/testing/catalog-of.js";

vi.mock("../../src/composition/installation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/composition/installation.js")>();
  return { ...actual, wireInstallation: vi.fn(actual.wireInstallation) };
});

describe("createContainer", () => {
  const tools = catalogOf();
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "aidd-create-container-"));
    vi.mocked(wireInstallation).mockClear();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("hands the same instance each time a context is read", () => {
    const container = createContainer({ projectRoot: root, verbose: false, tools });

    expect(container.shared).toBe(container.shared);
    expect(container.installation).toBe(container.installation);
    expect(container.update).toBe(container.update);
  });

  it("shares nothing between two containers", () => {
    const first = createContainer({ projectRoot: root, verbose: false, tools });
    const second = createContainer({ projectRoot: root, verbose: false, tools });

    expect(second.shared).not.toBe(first.shared);
    expect(second.update).not.toBe(first.update);
  });

  it("wires installation only when a context that needs it is read", () => {
    const container = createContainer({ projectRoot: root, verbose: false, tools });

    container.update.selfUpdate;
    expect(wireInstallation).not.toHaveBeenCalled();

    container.installation;
    expect(wireInstallation).toHaveBeenCalledTimes(1);
  });

  it("reads the version of the running binary from its shared context", () => {
    const container = createContainer({ projectRoot: root, verbose: false, tools });

    expect(container.shared.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("logs through the output it was handed", () => {
    const output = new CLIOutput(false);
    const container = createContainer({ projectRoot: root, verbose: false, output, tools });

    expect(container.shared.logger).toBe(output);
  });
});
