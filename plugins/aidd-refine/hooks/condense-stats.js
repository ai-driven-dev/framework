#!/usr/bin/env node
/**
 * condense-stats.js
 *
 * UserPromptSubmit hook for aidd-refine:03-condense :: action 02-stats.
 *
 * Triggers on user prompts that ask for condense stats. Reads the current
 * Claude Code session transcript, detects intensity transitions emitted by
 * the condense action, approximates token usage, and returns a formatted
 * report so the model does not need to recompute.
 *
 * Trigger patterns (case-insensitive):
 *   /condense-stats
 *   /condense stats
 *   condense stats
 *   how much have we saved
 *   token savings
 *
 * Hook contract: receives a JSON payload on stdin with at least
 *   { hook_event_name, session_id, transcript_path, cwd, prompt }
 * Returns JSON on stdout when blocking; exits silently when not matched.
 */

'use strict';

const fs = require('fs');

const TRIGGER_PATTERNS = [
  /\/condense[-\s]?stats\b/i,
  /\bcondense\s+stats\b/i,
  /how\s+much\s+(have\s+)?we\s+saved\b/i,
  /\btoken\s+savings\b/i,
];

const LEVEL_DEFAULT = 'full';
const COMPRESSION_RATIO = {
  lite: 0.18,
  full: 0.38,
  ultra: 0.58,
};

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

function passthrough() {
  process.exit(0);
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }) + '\n');
  process.exit(0);
}

function matchTrigger(prompt) {
  if (!prompt || typeof prompt !== 'string') return false;
  return TRIGGER_PATTERNS.some((re) => re.test(prompt));
}

function readTranscript(transcriptPath) {
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return [];
  const lines = fs.readFileSync(transcriptPath, 'utf8').split(/\r?\n/);
  const messages = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      messages.push(JSON.parse(line));
    } catch {
      // ignore malformed lines
    }
  }
  return messages;
}

function extractAssistantText(message) {
  if (!message || message.type !== 'assistant') return null;
  const content = message?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && part.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join('\n');
  }
  return null;
}

function detectTransitionLevel(text) {
  if (!text) return null;
  const onMatch = text.match(/Condense:\s*ON\s*\(([a-z]+)\)/i);
  if (onMatch) return onMatch[1].toLowerCase();
  if (/Condense:\s*OFF/i.test(text)) return 'off';
  return null;
}

function approxTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

function computeStats(messages) {
  let activeLevel = null;
  let activeTurns = 0;
  let totalTurns = 0;
  let activeTokens = 0;
  let offTokens = 0;
  const levelTokens = { lite: 0, full: 0, ultra: 0 };
  const levelTurns = { lite: 0, full: 0, ultra: 0 };

  for (const message of messages) {
    const text = extractAssistantText(message);
    if (text === null) continue;
    totalTurns += 1;

    const transition = detectTransitionLevel(text);
    if (transition === 'off') {
      activeLevel = null;
    } else if (transition && transition in COMPRESSION_RATIO) {
      activeLevel = transition;
    }

    const tokens = approxTokens(text);
    if (activeLevel) {
      activeTurns += 1;
      activeTokens += tokens;
      levelTokens[activeLevel] += tokens;
      levelTurns[activeLevel] += 1;
    } else {
      offTokens += tokens;
    }
  }

  let approxSaved = 0;
  for (const [level, tokens] of Object.entries(levelTokens)) {
    const ratio = COMPRESSION_RATIO[level];
    if (!ratio || tokens === 0) continue;
    // tokens here are the compressed output; baseline = tokens / (1 - ratio)
    const baseline = tokens / (1 - ratio);
    approxSaved += baseline - tokens;
  }

  const activeRatio = totalTurns === 0 ? 0 : (activeTurns / totalTurns) * 100;
  const avgSaved = activeTurns === 0
    ? 0
    : (Object.entries(levelTurns).reduce((acc, [level, turns]) => {
        return acc + (turns * (COMPRESSION_RATIO[level] || 0));
      }, 0) / activeTurns) * 100;

  const topSavings = Object.entries(levelTurns)
    .filter(([, turns]) => turns > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([level]) => `${level} (-${Math.round((COMPRESSION_RATIO[level] || 0) * 100)}%)`)
    .join(', ') || 'none yet';

  return {
    mode: activeLevel ? `ON (${activeLevel})` : 'OFF',
    activeTurns,
    totalTurns,
    activeRatio: Math.round(activeRatio),
    activeTokens: Math.round(activeTokens / 10) * 10,
    offTokens: Math.round(offTokens / 10) * 10,
    avgSaved: Math.round(avgSaved),
    approxSaved: Math.round(approxSaved / 10) * 10,
    topSavings,
  };
}

function format(stats) {
  return [
    'Condense session stats',
    '----------------------',
    `Mode:               ${stats.mode}`,
    `Active turns:       ${stats.activeTurns} / ${stats.totalTurns} (${stats.activeRatio}%)`,
    `Tokens out (active):${' '.repeat(Math.max(1, 4 - String(stats.activeTokens).length))}${stats.activeTokens}`,
    `Tokens out (off):   ${stats.offTokens}`,
    `Avg saved / turn:   ~${stats.avgSaved}%`,
    `Approx total saved: ~${stats.approxSaved} tokens`,
    '',
    `Top savings: ${stats.topSavings}.`,
    '',
    'Source: session transcript. Baseline ratios are published averages (lite 18%, full 38%, ultra 58%); replace with measured values when available.',
  ].join('\n');
}

async function main() {
  const raw = await readStdin();
  let payload = {};
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch {
    passthrough();
    return;
  }

  const prompt = payload.prompt || payload.user_prompt || '';
  if (!matchTrigger(prompt)) {
    passthrough();
    return;
  }

  const messages = readTranscript(payload.transcript_path);
  if (messages.length === 0) {
    block('Condense session stats unavailable: transcript not found or empty.');
    return;
  }

  const stats = computeStats(messages);
  block(format(stats));
}

main().catch(() => passthrough());
