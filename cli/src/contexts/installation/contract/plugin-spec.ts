/** A plugin argument as typed on the command line: `name` or `name@version`. */
export function parsePluginSpec(arg: string): { name: string; version?: string } {
  const at = arg.lastIndexOf("@");
  if (at <= 0) return { name: arg };
  return { name: arg.slice(0, at), version: arg.slice(at + 1) };
}
