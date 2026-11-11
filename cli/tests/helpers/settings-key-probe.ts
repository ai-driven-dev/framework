/** The key a settings answer asks of the file it is handed, or null when it asks none: a test
 * reads a declared key through the answer that uses it, never off a getter. */
export function keyAskedOf(ask: (settings: Record<string, unknown>) => unknown): string | null {
  let asked: string | null = null;
  const note = (key: string | symbol): void => {
    asked ??= String(key);
  };
  ask(
    new Proxy<Record<string, unknown>>(
      {},
      {
        has: (_target, key) => (note(key), false),
        get: (_target, key) => (note(key), undefined),
      }
    )
  );
  return asked;
}
