/** A warning raised while a tool's native plugins are activated, named as such. */
export const nativeActivationWarning = (text: string): string =>
  `Native plugin activation: ${text}`;
