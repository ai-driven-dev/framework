import { createTestEnv } from "../e2e/helpers.js";

type Sandbox = Awaited<ReturnType<typeof createTestEnv>>;

/**
 * Two captures in two sandboxes, `<prefix>-1` and `<prefix>-2`, the second started once the
 * first is done, so a difference that depends on the time still shows. A golden suite's
 * determinism test compares them and its baseline test compares the first to the stored
 * snapshot: a capture of its own would check nothing more. Each capture runs once, whichever
 * test asks first; `cleanup` removes both sandboxes.
 */
export function twoCaptures<T>(prefix: string, capture: (sandbox: Sandbox) => Promise<T>) {
  const sandboxes: Sandbox[] = [];
  let first: Promise<T> | undefined;
  let second: Promise<T> | undefined;
  const captureIn = async (name: string): Promise<T> => {
    const sandbox = await createTestEnv(name);
    sandboxes.push(sandbox);
    return capture(sandbox);
  };
  const firstCapture = (): Promise<T> => {
    first ??= captureIn(`${prefix}-1`);
    return first;
  };
  const secondCapture = (): Promise<T> => {
    second ??= firstCapture().then(() => captureIn(`${prefix}-2`));
    return second;
  };
  const cleanup = async (): Promise<void> => {
    for (const sandbox of sandboxes) await sandbox.cleanup();
  };
  return { first: firstCapture, second: secondCapture, cleanup };
}
