import { parse, stringify } from "smol-toml";
import type { TomlCodec } from "../domain/formats/toml.js";

/** TOML through smol-toml. */
export class SmolTomlCodec implements TomlCodec {
  parse(content: string): Record<string, unknown> {
    return parse(content);
  }

  stringify(data: Record<string, unknown>): string {
    return stringify(data);
  }
}
