const { readFileSync, writeFileSync } = require('node:fs');

const [inputPath, outputPath] = process.argv.slice(2);
const text = readFileSync(inputPath, 'utf8');
const modelId = 'kilo/cohere/north-mini-code:free';
const marker = `${modelId}\n`;
const start = text.indexOf(marker);

if (start < 0) throw new Error(`Model catalog did not contain ${modelId}`);

const jsonStart = start + marker.length;
let depth = 0;
let inString = false;
let escaped = false;
let jsonEnd = -1;

for (let index = jsonStart; index < text.length; index += 1) {
  const character = text[index];
  if (inString) {
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (character === '"') inString = false;
    continue;
  }
  if (character === '"') inString = true;
  else if (character === '{') depth += 1;
  else if (character === '}') {
    depth -= 1;
    if (depth === 0) {
      jsonEnd = index + 1;
      break;
    }
  }
}

if (jsonEnd < 0) throw new Error('Selected model JSON was incomplete');
const model = JSON.parse(text.slice(jsonStart, jsonEnd));
const freeZeroCost = model.cost?.input === 0
  && model.cost?.output === 0
  && model.cost?.cache?.read === 0
  && model.cost?.cache?.write === 0;

if (model.id !== 'cohere/north-mini-code:free' || !model.name.includes('(free)') || !freeZeroCost) {
  throw new Error('Selected catalog entry is not the expected explicitly free, zero-cost model');
}

writeFileSync(outputPath, `${modelId}\n${JSON.stringify(model, null, 2)}\n`);
