import { Command } from "commander";

const VERSION = "3.0.0";

const program = new Command();

program.name("aidd").description("AI-Driven Development CLI").version(VERSION);

program.parse(process.argv);
