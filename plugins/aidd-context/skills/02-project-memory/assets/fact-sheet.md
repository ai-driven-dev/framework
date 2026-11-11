<!-- Path: `aidd_docs/tasks/{{yyyy_mm}}/{{yyyy_mm_dd}}_memory-{{scope}}/facts.md`, the scope being setup or refresh. Replace every `{{...}}` and delete every comment; never add, rename, or reorder a block. One fact per line under a block: `- <id> | <file> > <section> | <fact> | <source> | <answer>`. No `|` in a fact. The source is one existing plain path, no backticks, line number or glob; a removal cites the memory file; a `Q` may cite none. Leave the answer empty. -->

# Facts: {{scope}}

- Capabilities: C1 {{name}}, C2 {{name}}
- {{the `Since` line `changes` printed}}

<!-- Refresh only, copied as it is. -->

## Read

<!-- From the file that defines the fact. R1, R2. -->

- R1 | {{file}}.md > {{section}} | {{fact}} | {{source}} |

## Inferred

<!-- Deduced from the code. D1, D2. To change or remove an existing line, start with `remove` or `replace` and quote the old line exactly between double quotes. To relocate a misplaced file, write `move <path> to <path>`. -->

- D1 | {{file}}.md > {{section}} | {{fact}} | {{source}} |

## Unknown

<!-- What the code cannot say. Q1, Q2. At most eight. -->

- Q1 | {{file}}.md > {{section}} | {{question}} | {{source, or none}} |
