const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { extractMermaidBlocks, validateMermaidBlocks, run } = require('../check-mermaid-syntax');

function withTempDir(t, setup) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-check-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return setup(dir);
}

test('passes when mermaid syntax is valid', async (t) => {
  return withTempDir(t, async (dir) => {
    const file = path.join(dir, 'doc.md');
    fs.writeFileSync(file, `# Documentation

\`\`\`mermaid
flowchart TD
    A[Start] --> B[Process]
    B --> C[End]
\`\`\`
`);
    const exitCode = await run([file]);
    assert.strictEqual(exitCode, 0);
  });
});

test('fails when mermaid syntax is invalid', async (t) => {
  return withTempDir(t, async (dir) => {
    const file = path.join(dir, 'doc.md');
    fs.writeFileSync(file, `# Documentation

\`\`\`mermaid
// This is not valid mermaid
Just random text here
1. A list item
2. Another item
\`\`\`
`);
    const exitCode = await run([file]);
    assert.strictEqual(exitCode, 1);
  });
});

test('extracts mermaid blocks with correct line numbers', (t) => {
  const content = `# Title

Some text

\`\`\`mermaid
flowchart TD
    A --> B
\`\`\`

More text

\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hi
\`\`\`
`;
  const blocks = extractMermaidBlocks(content, 'test.md');
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0].lineNumber, 5);
  assert.strictEqual(blocks[1].lineNumber, 12);
});

test('detects invalid flowchart keyword', async (t) => {
  return withTempDir(t, async (dir) => {
    const file = path.join(dir, 'doc.md');
    fs.writeFileSync(file, `\`\`\`mermaid
flowcharttt TD
    A --> B
\`\`\`
`);
    const exitCode = await run([file]);
    assert.strictEqual(exitCode, 1);
  });
});

test('detects unescaped parentheses in node labels', async (t) => {
  return withTempDir(t, async (dir) => {
    const file = path.join(dir, 'doc.md');
    fs.writeFileSync(file, `\`\`\`mermaid
flowchart TD
    A[Function(param)] --> B[End]
\`\`\`
`);
    const exitCode = await run([file]);
    assert.strictEqual(exitCode, 1);
  });
});

test('validates sequence diagrams correctly', async (t) => {
  return withTempDir(t, async (dir) => {
    const file = path.join(dir, 'doc.md');
    fs.writeFileSync(file, `\`\`\`mermaid
sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi back
\`\`\`
`);
    const exitCode = await run([file]);
    assert.strictEqual(exitCode, 0);
  });
});

test('returns 0 when no mermaid blocks found', async (t) => {
  return withTempDir(t, async (dir) => {
    const file = path.join(dir, 'doc.md');
    fs.writeFileSync(file, '# Just a title\n\nSome text without mermaid.');
    const exitCode = await run([file]);
    assert.strictEqual(exitCode, 0);
  });
});

test('handles empty input gracefully', async () => {
  const exitCode = await run([]);
  assert.strictEqual(exitCode, 0);
});
