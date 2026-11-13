/** A recipe that passes every rule, one line per element, so a test edits the line it is about. */
export function validDirect(title = "Valid recipe"): string[] {
  return [
    `# ${title}`,
    "",
    "Produce one observable result.",
    "",
    "## Steps to produce the result",
    "",
    "### 1) ✅ Run the check",
    "",
    "This command returns the observable result.",
    "",
    "```bash",
    "echo ok",
    "```",
    "",
    "## Verify",
    "",
    "- Confirm the command prints `ok`.",
  ];
}

/** A recipe whose steps sit under two categories and keep one numbering. */
export function categorized(): string[] {
  return [
    "# Categorized recipe",
    "",
    "Produce two observable results.",
    "",
    "## Steps to produce the results",
    "",
    "### 🟢 Beginner",
    "",
    "#### 1) ✅ Run the first check",
    "",
    "This command confirms the prerequisite.",
    "",
    "```bash",
    "echo first",
    "```",
    "",
    "### 🔴 Expert",
    "",
    "#### 2) 🔬 Run the second check",
    "",
    "This command confirms the advanced result.",
    "",
    "```bash",
    "echo second",
    "```",
  ];
}

export function markdown(lines: readonly string[]): string {
  return `${lines.join("\n")}\n`;
}

/** A valid recipe with some lines replaced, by zero-based index. */
export function withLines(changes: Record<number, string>, title?: string): string[] {
  return Object.assign(validDirect(title), changes);
}
