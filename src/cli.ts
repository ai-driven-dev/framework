import { platform } from "node:os";
import { Command } from "commander";
import { printUpdateBanner } from "./application/check-update.js";
import { registerAdoptCommand } from "./application/commands/adopt.js";
import { registerAuthCommand } from "./application/commands/auth.js";
import { registerCacheCommand } from "./application/commands/cache.js";
import { registerCleanCommand } from "./application/commands/clean.js";
import { registerConfigCommand } from "./application/commands/config.js";
import { registerDoctorCommand } from "./application/commands/doctor.js";
import { registerInitCommand } from "./application/commands/init.js";
import { registerInstallCommand } from "./application/commands/install.js";
import { registerRestoreCommand } from "./application/commands/restore.js";
import { registerSelfUpdateCommand } from "./application/commands/self-update.js";
import { registerSetupCommand } from "./application/commands/setup.js";
import { registerStatusCommand } from "./application/commands/status.js";
import { registerSyncCommand } from "./application/commands/sync.js";
import { registerUninstallCommand } from "./application/commands/uninstall.js";
import { registerUpdateCommand } from "./application/commands/update.js";
import { CLIOutput } from "./application/output.js";
import { CurrentVersionAdapter } from "./infrastructure/adapters/current-version-adapter.js";
import { createDeps } from "./infrastructure/deps.js";

const B = "\x1b[38;2;78;78;249m";
const P = "\x1b[38;2;221;84;117m";
const G = "\x1b[38;2;102;204;153m";
const D = "\x1b[2m";
const R = "\x1b[0m";
const BOLD = "\x1b[1m";

const GLITCH = "█▓▒░▄▀■□▪▫◆◇○●▌▐";
const glitchChar = (): string => GLITCH[Math.floor(Math.random() * GLITCH.length)];

const logoLines = [
  `  ${B}█████╗ ${P}██╗${B}██████╗ ${P}██████╗${R}`,
  `  ${B}██╔══██╗${P}██║${B}██╔══██╗${P}██╔══██╗${R}`,
  `  ${B}███████║${P}██║${B}██║  ██║${P}██║  ██║${R}`,
  `  ${B}██╔══██║${P}██║${B}██║  ██║${P}██║  ██║${R}`,
  `  ${B}██║  ██║${P}██║${B}██████╔╝${P}██████╔╝${R}`,
  `  ${D}╚═╝  ╚═╝╚═╝╚═════╝ ╚═════╝${R}`,
];

// biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — strips ANSI escape codes
const ANSI_RE = /\u001b\[[0-9;]*m/g;
const strippedLines = logoLines.map((l) => l.replace(ANSI_RE, ""));

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const INNER = 44;

function boxLine(styledText: string, textVis: number): string {
  const padding = INNER - 4 - textVis;
  return `  ${D}│${R}  ${styledText}${" ".repeat(padding)}  ${D}│${R}`;
}

async function printBanner(): Promise<void> {
  if (!process.stdout.isTTY) return;

  process.stdout.write("\n");
  const rows = logoLines.length;

  const passes: [number, string][] = [
    [1.0, P],
    [0.85, P],
    [0.65, P],
    [0.45, B],
    [0.28, B],
    [0.14, B],
    [0.05, B],
    [0.01, B],
  ];

  for (const line of logoLines) process.stdout.write(`${line}\n`);

  for (const [intensity, col] of passes) {
    process.stdout.write(`\x1b[${rows}A`);
    for (let i = 0; i < rows; i++) {
      const noisy = strippedLines[i].replace(/[^\s╗╔╝╚║═]/g, (ch: string) =>
        Math.random() < intensity ? glitchChar() : ch
      );
      process.stdout.write(`  ${col}${noisy}${R}\n`);
    }
    await sleep(65);
  }

  process.stdout.write(`\x1b[${rows}A`);
  for (const line of logoLines) {
    process.stdout.write(`${line}\n`);
    await sleep(30);
  }

  await sleep(300);

  const dashes = "─".repeat(INNER);
  const empty = `  ${D}│${R}${" ".repeat(INNER)}${D}│${R}`;

  process.stdout.write(`\n  ${BOLD}AI-Driven Dev${R}\n\n`);
  process.stdout.write(`  ${D}┌${dashes}┐${R}\n`);
  process.stdout.write(`${empty}\n`);
  process.stdout.write(`${boxLine(`${G}${BOLD}AI-Driven Development${R}`, 21)}\n`);
  process.stdout.write(`${boxLine(`${D}The methodology for AI coders.${R}`, 30)}\n`);
  process.stdout.write(`${empty}\n`);
  process.stdout.write(`  ${D}└${dashes}┘${R}\n\n`);
}

function formatVersion(version: string): string {
  return `aidd/${version} node/${process.versions.node} ${platform()}-${process.arch}`;
}

const currentVersion = new CurrentVersionAdapter().get();

const program = new Command();

program
  .name("aidd")
  .description("Generate AI coding assistant configurations from the AIDD framework")
  .version(formatVersion(currentVersion), "-V, --version", "Show version number")
  .option("--verbose", "Show detailed diagnostic output", false)
  .option("--repo <owner/repo>", "GitHub repository in owner/repo format");

registerAdoptCommand(program);
registerAuthCommand(program);
registerCacheCommand(program);
registerConfigCommand(program);
registerInitCommand(program);
registerInstallCommand(program);

// Hide legacy entry points — setup orchestrates these flows now
for (const name of ["adopt", "init"]) {
  const cmd = program.commands.find((c) => c.name() === name) as
    | (Command & { _hidden: boolean })
    | undefined;
  if (cmd) cmd._hidden = true;
}
registerUninstallCommand(program);
registerStatusCommand(program);
registerCleanCommand(program);
registerDoctorCommand(program);
registerUpdateCommand(program);
registerRestoreCommand(program);
registerSyncCommand(program);
registerSelfUpdateCommand(program);
registerSetupCommand(program);

program.hook("preAction", async (_thisCommand, actionCommand) => {
  const opts = program.opts<{ verbose?: boolean; repo?: string }>();
  const output = new CLIOutput(opts.verbose ?? false);
  const deps = await createDeps(
    process.cwd(),
    { verbose: opts.verbose ?? false, repo: opts.repo },
    output
  ).catch(() => null);
  if (deps) {
    const cmd = actionCommand.name();
    await printUpdateBanner(
      deps.cliUpdater,
      deps.currentVersionProvider,
      deps.resolver,
      deps.manifestRepo,
      output,
      cmd === "self-update",
      ["self-update", "update", "setup"].includes(cmd)
    );
  }
});

await printBanner();

program.parse(process.argv);
