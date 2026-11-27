import type { AiToolId } from "../../../src/shared/domain/tool.js";

/** The tool ids a scenario names, handed in by the test: a builder never mints a registered id. */
export type NamedTools<Name extends string> = Readonly<Record<Name, AiToolId>>;
