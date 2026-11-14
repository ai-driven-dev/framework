import { describe, expect, it } from "vitest";
import { TOOL } from "../../tools/testing/catalog-of.js";
import { PROJECT, registryHome } from "../testing/registry-home.js";

const { write, readerFor } = registryHome();

describe("Codex's own config.toml", () => {
  const PATH = ".codex/config.toml";

  it("finds its plugin tables among the arbitrary ones around them", async () => {
    await write(
      PATH,
      [
        '[projects."/somewhere/else"]',
        'trust_level = "trusted"',
        "",
        '[plugins."aidd-telemetry@aidd-framework"]',
        "enabled = true",
        "",
        '[plugins."aidd-dev@aidd-framework"]',
        "enabled = false",
        "",
        '[hooks.state."aidd-telemetry@aidd-framework:hooks/hooks.json:session_start:0:0"]',
        'trusted_hash = "abc"',
        "",
      ].join("\n")
    );

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect(reading.refs?.get("aidd-telemetry@aidd-framework")).toEqual({ enabled: true });
    expect(reading.refs?.get("aidd-dev@aidd-framework")).toEqual({ enabled: false });
    expect(reading.refs?.size).toBe(2);
  });

  // Codex writes no plugin table without `enabled`. Asserted against the next table rather
  // than end-of-file, so it cannot pass by conflating "no key" with "no more input".
  it("treats a table with no enabled line as enabled", async () => {
    await write(
      PATH,
      '[plugins."aidd-telemetry@aidd-framework"]\n[plugins."other@elsewhere"]\nenabled = true\n'
    );

    expect(
      (await readerFor(TOOL.codex).read(PROJECT)).refs?.get("aidd-telemetry@aidd-framework")
    ).toEqual({ enabled: true });
  });

  it.each([
    ["a blank line before it", "\nenabled = false\n"],
    ["a comment line before it", "# why\nenabled = false\n"],
    ["another key before it", 'version = "1"\nenabled = false\n'],
    ["a trailing comment on it", "enabled = false # turned off\n"],
  ])("finds enabled = false with %s", async (_shape, body) => {
    await write(PATH, `[plugins."aidd-telemetry@aidd-framework"]\n${body}`);

    expect(
      (await readerFor(TOOL.codex).read(PROJECT)).refs?.get("aidd-telemetry@aidd-framework")
    ).toEqual({ enabled: false });
  });

  it("finds a plugin whose header carries a trailing comment", async () => {
    await write(
      PATH,
      '[plugins."aidd-telemetry@aidd-framework"] # installed by hand\nenabled = true\n'
    );

    expect(
      (await readerFor(TOOL.codex).read(PROJECT)).refs?.get("aidd-telemetry@aidd-framework")
    ).toEqual({ enabled: true });
  });

  /**
   * A header spelled inside a multi-line string is not a table, and TOML forbids the real one
   * being defined twice — so exactly one occurrence is real, whichever comes first.
   */
  it.each([
    [
      "before the real table",
      '[projects."/p"]\nnotes = """\n[plugins."aidd-telemetry@aidd-framework"]\nenabled = true\n"""\n\n[plugins."aidd-telemetry@aidd-framework"]\nenabled = false\n',
    ],
    [
      "after the real table",
      '[plugins."aidd-telemetry@aidd-framework"]\nenabled = false\n\n[projects."/p"]\nnotes = """\n[plugins."aidd-telemetry@aidd-framework"]\nenabled = true\n"""\n',
    ],
  ])("ignores a header inside a multi-line string, %s", async (_where, content) => {
    await write(PATH, content);

    expect(
      (await readerFor(TOOL.codex).read(PROJECT)).refs?.get("aidd-telemetry@aidd-framework")
    ).toEqual({ enabled: false });
  });

  it("stays outside a multi-line string that opens and closes on one line", async () => {
    await write(
      PATH,
      '[projects."/p"]\nnotes = """one line"""\n\n[plugins."aidd-telemetry@aidd-framework"]\nenabled = false\n'
    );

    expect(
      (await readerFor(TOOL.codex).read(PROJECT)).refs?.get("aidd-telemetry@aidd-framework")
    ).toEqual({ enabled: false });
  });

  it("does not read the next table's enabled as this table's", async () => {
    await write(PATH, '[plugins."a@m"]\n[plugins."b@m"]\nenabled = false\n');

    const refs = (await readerFor(TOOL.codex).read(PROJECT)).refs;

    expect(refs?.get("a@m")).toEqual({ enabled: true });
    expect(refs?.get("b@m")).toEqual({ enabled: false });
  });

  it("distinguishes an absent config from an unreadable one", async () => {
    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect(reading.refs).toBeUndefined();
    expect(reading.absent).toBe(true);
    expect(reading.unreadable).toBeUndefined();
  });
});

describe("Codex's config.toml, at the edges of its shape", () => {
  const PATH = ".codex/config.toml";

  it("reads a plugin table whose header is indented", async () => {
    await write(PATH, '  [plugins."a@m"]\n  enabled = false\n');

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect(reading.refs?.get("a@m")).toStrictEqual({ enabled: false });
  });

  it("reads no table off a line that only contains a header, or carries text after one", async () => {
    await write(PATH, 'x[plugins."a@m"]\n[plugins."b@m"] junk\n');

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect(reading.refs?.size).toBe(0);
  });

  it("reads an enabled line however the spaces around its equals sign fall", async () => {
    await write(
      PATH,
      '[plugins."a@m"]\nenabled=false\n[plugins."b@m"]\nenabled  =  false\n[plugins."c@m"]\nenabled =false # off\n'
    );

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect([...(reading.refs ?? [])]).toStrictEqual([
      ["a@m", { enabled: false }],
      ["b@m", { enabled: false }],
      ["c@m", { enabled: false }],
    ]);
  });

  it("reads a value that is not a bare boolean as no answer, so the default stands", async () => {
    await write(PATH, '[plugins."a@m"]\nenabled = falsey\n');

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect(reading.refs?.get("a@m")).toStrictEqual({ enabled: true });
  });

  it("does not mistake a bracket inside a value for the next table", async () => {
    await write(PATH, '[plugins."a@m"]\nargs = ["x"]\nenabled = false\n');

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect(reading.refs?.get("a@m")).toStrictEqual({ enabled: false });
  });

  it("reads past a multi-line string inside the table body, and a header spelled inside it", async () => {
    await write(
      PATH,
      '[plugins."a@m"]\nnote = """\n[plugins."fake@m"]\nenabled = true\n"""\nenabled = false\n'
    );

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect([...(reading.refs ?? [])]).toStrictEqual([["a@m", { enabled: false }]]);
  });

  it("treats the last table in the file as enabled when it declares nothing", async () => {
    await write(PATH, '[projects."/x"]\ntrust = "trusted"\n[plugins."a@m"]\n');

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect(reading.refs?.get("a@m")).toStrictEqual({ enabled: true });
  });
});

describe("Codex's config.toml, keys that merely end in enabled", () => {
  it("does not read another key ending in enabled as the plugin's own flag", async () => {
    await write(".codex/config.toml", '[plugins."a@m"]\nauto_enabled = false\n');

    const reading = await readerFor(TOOL.codex).read(PROJECT);

    expect(reading.refs?.get("a@m")).toStrictEqual({ enabled: true });
  });
});
