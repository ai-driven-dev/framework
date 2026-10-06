import { Command } from "commander";
import { registerKanban } from "../src/index.js";

/**
 * Standalone launcher. The AIDD CLI unmounted `aidd kanban`, so this script is the
 * host: it builds the deps the commands used to receive from the CLI and hands them
 * to the public entrypoint. Run through `pnpm board <subcommand>` in this folder.
 */
const DOCS_DIRECTORY_NAME = "aidd_docs";

const program = new Command();

program.name("kanban").description("Task board over a project's aidd_docs task documents");

registerKanban(program, {
  docsDirectoryName: DOCS_DIRECTORY_NAME,
  output: {
    print: (message: string) => {
      console.log(message);
    },
  },
  onError: (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  },
});

await program.parseAsync(process.argv);
