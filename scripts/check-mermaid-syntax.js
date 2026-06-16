#!/usr/bin/env node

/**
 * Check Mermaid syntax in Markdown files
 * Usage: node scripts/check-mermaid-syntax.js [directories...] [--ignore pattern]
 *
 * Uses mermaid.parse() directly for fast validation
 */

const fs = require('fs');
const path = require('path');

// Check for verbose flag early
let verbose = false;
for (const arg of process.argv) {
  if (arg === '--verbose' || arg === '-v') verbose = true;
}

const MERMAID_BLOCK_REGEX = /```mermaid\s*\n([\s\S]*?)```/g;

function findMarkdownFiles(dirs, ignorePatterns = []) {
  const files = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    const stat = fs.statSync(dir);
    if (stat.isFile() && dir.endsWith('.md')) {
      files.push(dir);
      continue;
    }

    if (!stat.isDirectory()) continue;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (ignorePatterns.some(p => fullPath.includes(p))) continue;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;

      if (entry.isDirectory()) {
        files.push(...findMarkdownFiles([fullPath], ignorePatterns));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

function extractMermaidBlocks(content, filePath) {
  const blocks = [];
  let match;
  const regex = new RegExp(MERMAID_BLOCK_REGEX.source, 'g');

  while ((match = regex.exec(content)) !== null) {
    const code = match[1].trim();
    // Skip placeholder blocks (template/doc stubs, not real diagrams):
    // - a single <token>
    // - comment-only blocks, or empty after stripping HTML comments
    // - a single [bracketed placeholder]
    const stripped = code
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/^\s*%%.*$/gm, '')
      .trim();
    const isPlaceholder =
      stripped.length === 0 ||
      /^<[^>]*>$/.test(stripped) ||
      /^\[[\s\S]*\]$/.test(stripped);
    if (!isPlaceholder) {
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      blocks.push({ code, lineNumber, filePath });
    }
  }

  return blocks;
}

async function validateMermaidBlock(mermaid, code) {
  try {
    await mermaid.parse(code);
    return { valid: true };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Ignore DOMPurify errors (Node.js limitation, not syntax errors)
    if (errorMsg.includes('DOMPurify') ||
        errorMsg.includes('is not a function') ||
        errorMsg.includes('is not defined')) {
      return { valid: true };
    }

    return { valid: false, error: errorMsg };
  }
}

async function validateMermaidBlocks(blocks) {
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose'
  });

  const errors = [];
  for (const block of blocks) {
    const result = await validateMermaidBlock(mermaid, block.code);
    if (!result.valid) {
      errors.push({
        filePath: block.filePath,
        lineNumber: block.lineNumber,
        error: result.error
      });
    }
  }

  return errors;
}

async function run(inputs, { ignore = [] } = {}) {
  if (!inputs || inputs.length === 0) {
    return 0;
  }

  const ignorePatterns = ['/sandbox/', 'node_modules/', ...ignore];
  const files = findMarkdownFiles(inputs, ignorePatterns);

  const allBlocks = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const blocks = extractMermaidBlocks(content, file);
    allBlocks.push(...blocks);
  }

  if (allBlocks.length === 0) {
    if (verbose) console.log('✅ No Mermaid diagrams found');
    return 0;
  }

  const fileCount = new Set(allBlocks.map(b => b.filePath)).size;
  if (verbose) console.log(`Validating ${allBlocks.length} Mermaid diagram(s) in ${fileCount} file(s)...`);

  const errors = await validateMermaidBlocks(allBlocks);

  for (const err of errors) {
    console.error(`\n❌ ${err.filePath}:${err.lineNumber}`);
    console.error(`   ${err.error}`);
  }

  if (errors.length > 0) {
    console.error(`❌ Found ${errors.length} invalid Mermaid diagram(s)`);
    return 1;
  }

  if (verbose) console.log(`✅ All ${allBlocks.length} Mermaid diagrams valid`);
  return 0;
}

async function main() {
  const args = process.argv.slice(2);
  const dirs = [];
  const ignore = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ignore' && args[i + 1]) {
      ignore.push(args[i + 1]);
      i++;
    } else if (args[i] === '--verbose' || args[i] === '-v') {
      // Already parsed above, skip
    } else {
      dirs.push(args[i]);
    }
  }

  if (dirs.length === 0) {
    dirs.push('.');
  }

  const exitCode = await run(dirs, { ignore });
  process.exit(exitCode);
}

if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = {
  findMarkdownFiles,
  extractMermaidBlocks,
  validateMermaidBlocks,
  run
};
