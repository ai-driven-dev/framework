#!/usr/bin/env node
// Peak memory of reading one generated transcript through ReadUsageUseCase and the real adapter.
//
//   node memory-bench.mjs <megabytes> [<cli src dir>]
//
// The source defaults to this repository's `cli/src`. To measure another revision, extract its
// source first, e.g. `git archive origin/next cli/src | tar -x -C /tmp/old`, then pass
// `/tmp/old/cli/src`. The transcript is synthetic (fake ids, ~2 KB lines that are no usage line,
// one usage line in 50), written to a temporary directory and deleted afterwards. The read runs
// in its own `node` process, whose peak RSS is printed. Needs `pnpm install` in `cli/`.
import { spawnSync } from "node:child_process";
import { closeSync, mkdirSync, mkdtempSync, openSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = resolve(here, "../../../../cli");
const megabytes = Number(process.argv[2]);
const src = resolve(process.argv[3] ?? join(cli, "src"));
if (!(megabytes > 0)) {
  console.error("usage: node memory-bench.mjs <megabytes> [<cli src dir>]");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "aidd-memory-bench-"));
try {
  const entry = join(work, "entry.ts");
  writeFileSync(
    entry,
    `import { ReadUsageUseCase } from ${JSON.stringify(`${src}/contexts/telemetry/application/read-usage-use-case.js`)};
import { readClaudeUsageLine } from ${JSON.stringify(`${src}/contexts/telemetry/domain/formats/claude-transcript-usage.js`)};
import { ClaudeTranscriptSourceAdapter } from ${JSON.stringify(`${src}/contexts/telemetry/infrastructure/claude-transcript-source-adapter.js`)};
const reading = await new ReadUsageUseCase(
  new ClaudeTranscriptSourceAdapter(process.argv[2]),
  readClaudeUsageLine
).execute(new Map());
const [position] = [...reading.positions.values()];
console.log(JSON.stringify({
  records: reading.records.length,
  offset: position?.offset,
  maxRssMB: Math.round(process.resourceUsage().maxRSS / 1024),
}));
`
  );
  // esbuild is the CLI's bundler, reached through tsup, which depends on it.
  const fromCli = createRequire(join(cli, "package.json"));
  const esbuild = createRequire(fromCli.resolve("tsup/package.json"))("esbuild");
  const bundle = join(work, "bench.mjs");
  esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: bundle,
    logLevel: "warning",
  });

  const projects = join(work, "projects");
  mkdirSync(join(projects, "p"), { recursive: true });
  const fd = openSync(join(projects, "p", "s.jsonl"), "w");
  const pad = "lorem ipsum ".repeat(160);
  let written = 0;
  for (let n = 0; written < megabytes * 2 ** 20; ) {
    const lines = [];
    for (let i = 0; i < 1000; i += 1, n += 1) {
      lines.push(
        JSON.stringify(
          n % 50 === 0
            ? {
                type: "assistant",
                sessionId: "s-bench",
                requestId: `req_${n}`,
                timestamp: "2026-10-08T12:00:00.000Z",
                cwd: "/work/bench",
                message: {
                  id: `msg_${n}`,
                  model: "m",
                  usage: {
                    input_tokens: 1,
                    output_tokens: 2,
                    cache_read_input_tokens: 3,
                    cache_creation_input_tokens: 4,
                  },
                },
              }
            : {
                type: "user",
                sessionId: "s-bench",
                timestamp: "2026-10-08T12:00:00.000Z",
                cwd: "/work/bench",
                message: { content: pad },
              }
        )
      );
    }
    written += writeSync(fd, `${lines.join("\n")}\n`);
  }
  closeSync(fd);

  const run = spawnSync(process.execPath, [bundle, projects], { encoding: "utf8" });
  if (run.status !== 0) throw new Error(run.stderr);
  const result = JSON.parse(run.stdout);
  console.log(JSON.stringify({ transcriptBytes: written, ...result }));
} finally {
  rmSync(work, { recursive: true, force: true });
}
