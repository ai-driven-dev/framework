/**
 * Compares what a host sends a hook now with what the committed hook-payload fixtures hold,
 * by shape: keys and types, never values. Pure, so the comparison is tested without a host.
 */

const fs = require("node:fs");
const path = require("node:path");

const SESSION_ID = "00000000-0000-4000-8000-000000000000";
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const ISO_TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;
const DATED_SESSION_FILE = /sessions\/\d{4}\/\d{2}\/\d{2}\/rollout-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}/g;

function typeOf(value) {
  return value === null ? "null" : typeof value;
}

/** The shape of a JSON value. An array is the sorted set of its elements' shapes, so its length
 * and the order of its elements do not count. */
function shapeOf(value) {
  if (Array.isArray(value)) {
    const shapes = new Set(value.map((item) => JSON.stringify(shapeOf(item))));
    return { "[]": [...shapes].sort() };
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, shapeOf(item)]));
  }
  return typeOf(value);
}

function isObjectShape(shape) {
  return shape !== null && typeof shape === "object";
}

function nameOf(shape) {
  return isObjectShape(shape) ? "object" : shape;
}

/** What differs between two shapes, as one line each, at the path where it differs. */
function diffShapes(was, now, path = "") {
  if (!isObjectShape(was) || !isObjectShape(now)) {
    return was === now ? [] : [`type: ${path || "(root)"} ${nameOf(was)} -> ${nameOf(now)}`];
  }
  if ("[]" in was || "[]" in now) {
    const same = JSON.stringify(was) === JSON.stringify(now);
    return same ? [] : [`array: ${path || "(root)"} element shapes changed`];
  }
  const lines = [];
  for (const key of Object.keys(was)) {
    const at = path === "" ? key : `${path}.${key}`;
    if (!(key in now)) lines.push(`missing: ${at}`);
    else lines.push(...diffShapes(was[key], now[key], at));
  }
  for (const key of Object.keys(now)) {
    if (!(key in was)) lines.push(`added: ${path === "" ? key : `${path}.${key}`}`);
  }
  return lines;
}

/** Judges one moment: the committed fixture file against every payload a fresh run delivered.
 * Each fresh shape must equal the shape of some committed sample; otherwise it is judged against
 * the closest one. */
function compareMoment(fixture, freshPayloads) {
  if (freshPayloads.length === 0) return { status: "not-fired", differences: [] };
  const known = fixture.samples.map((sample) => shapeOf(sample.payload));
  const seen = new Set();
  const differences = [];
  for (const payload of freshPayloads) {
    const shape = shapeOf(payload);
    const key = JSON.stringify(shape);
    if (seen.has(key)) continue;
    seen.add(key);
    const closest = known.map((was) => diffShapes(was, shape)).sort((a, b) => a.length - b.length)[0] ?? [];
    differences.push(...closest);
  }
  return { status: differences.length === 0 ? "match" : "drift", differences };
}

/** Puts a captured payload in the committed form: the home and project paths, every session id,
 * the account email and every ISO timestamp or dated session-file name replaced by the
 * placeholders the fixtures README names. A timestamp that is a bare number is left alone. */
function scrub(value, { home, project }) {
  if (typeof value === "string") {
    return value
      .split(project)
      .join("/Users/user/project")
      .split(home)
      .join("/Users/user")
      .replace(DATED_SESSION_FILE, "sessions/1970/01/01/rollout-1970-01-01T00-00-00")
      .replace(ISO_TIME, "1970-01-01T00:00:00.000Z")
      .replace(UUID, SESSION_ID)
      .replace(EMAIL, "user@example.com");
  }
  if (Array.isArray(value)) return value.map((item) => scrub(item, { home, project }));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item, { home, project })]));
  }
  return value;
}

/** The fixtures of one host, one per moment, in file-name order. */
function readHostFixtures(dir, host) {
  return fs
    .readdirSync(dir)
    .filter((name) => name.startsWith(`${host}-`) && name.endsWith(".json"))
    .sort()
    .map((name) => ({ file: name, ...JSON.parse(fs.readFileSync(path.join(dir, name), "utf8")) }));
}

/** The fixture with each fresh payload whose shape no committed sample has, added once as a
 * logged sample. Nothing committed is removed: the samples that carry an answer or a refusal were
 * captured by hand and no run reproduces them. */
function withFreshSamples(fixture, payloads) {
  const seen = new Set(fixture.samples.map((sample) => JSON.stringify(shapeOf(sample.payload))));
  const added = [];
  for (const payload of payloads) {
    const key = JSON.stringify(shapeOf(payload));
    if (seen.has(key)) continue;
    seen.add(key);
    added.push({ run: "log", payload, hookAnswer: null });
  }
  return { ...fixture, samples: [...fixture.samples, ...added] };
}

module.exports = { shapeOf, diffShapes, compareMoment, scrub, readHostFixtures, withFreshSamples };
