/** Reads and writes TOML text. The domain names the capability; the composition root hands it
 * the adapter, so no domain file imports a TOML library. */
export interface TomlCodec {
  parse(content: string): Record<string, unknown>;
  stringify(data: Record<string, unknown>): string;
}
