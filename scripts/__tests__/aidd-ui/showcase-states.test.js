const assert = require("node:assert/strict");
const path = require("node:path");
const { describe, it } = require("node:test");
const { LIB } = require("../fixtures/aidd-ui/project.js");
const { stateDocument } = require(path.join(LIB, "showcase.cjs"));

const render = '<!doctype html><html><head><title>x</title></head><body><p class="label">default</p><button data-state="default">Go</button><p class="label">hover</p><button data-state="hover">Go</button></body></html>';

describe("one state of a render in its frame", () => {
  it("hides the other states and the caption standing before each of them", () => {
    const frame = stateDocument(render, null, "hover", false);
    assert.ok(frame.includes('[data-state]:not([data-state="hover"]) { display: none !important; }'), "the other states");
    assert.ok(frame.includes(':not([data-state]):not(:has([data-state])):has(+ [data-state]:not([data-state="hover"])) { display: none !important; }'), "their captions");
  });
});
