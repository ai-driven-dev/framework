import { parse, stringify } from "smol-toml";

/** TOML through smol-toml. Satisfies the tools context's `TomlCodec` by shape. */
export class SmolTomlCodec {
  parse(content: string): Record<string, unknown> {
    return parse(content);
  }

  stringify(data: Record<string, unknown>): string {
    return stringify(data);
  }
}
