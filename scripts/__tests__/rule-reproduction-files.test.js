const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const commonPath = require.resolve("../../aidd_docs/tasks/2026_10/2026_10_09_autonomous-rule-generation/realistic-sandbox/reproduction/common.cjs");
const { readRegular, open } = require(commonPath);
const hasProtections = ["O_NOFOLLOW", "O_NONBLOCK"].every(flag => Number.isInteger(fs.constants[flag]) && fs.constants[flag] !== 0);
const posixOnly = { skip: hasProtections ? false : "POSIX fixture requires nonzero O_NOFOLLOW and O_NONBLOCK protections." };

function sandbox(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), "aidd-realistic-rule-repro-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("ownership rejects symlink and nonregular markers", posixOnly, (t) => {
  const root = sandbox(t);
  const marker = path.join(root, ".sandbox-owner.json");
  const target = path.join(root, "outside.json");
  fs.writeFileSync(target, JSON.stringify({ owner: "aidd-realistic-rule-reproduction-v1", root, repo: __dirname }));
  const argv = process.argv;
  process.argv = [argv[0], argv[1], root];
  t.after(() => { process.argv = argv; });
  fs.symlinkSync(target, marker);
  assert.throws(() => open(), { code: "ELOOP" });
  fs.unlinkSync(marker);
  fs.mkdirSync(marker);
  assert.throws(() => open(), /regular file/);
});

test("regular reads reject symlinks without reading their targets", posixOnly, (t) => {
  const root = sandbox(t);
  const target = path.join(root, "target");
  const link = path.join(root, "link");
  fs.writeFileSync(target, "external bytes");
  fs.symlinkSync(target, link);
  assert.throws(() => readRegular(link), { code: "ELOOP" });
});

test("ownership reads the validated marker even if its pathname is replaced", posixOnly, (t) => {
  const root = sandbox(t);
  const marker = path.join(root, ".sandbox-owner.json");
  const replacement = path.join(root, "replacement.json");
  const metadata = { owner: "aidd-realistic-rule-reproduction-v1", root, repo: fs.realpathSync(__dirname) };
  fs.writeFileSync(marker, JSON.stringify({ ...metadata, probe: "original" }));
  fs.writeFileSync(replacement, JSON.stringify({ ...metadata, probe: "replacement" }));
  const argv = process.argv;
  const originals = { lstatSync: fs.lstatSync, fstatSync: fs.fstatSync };
  let replaced = false;
  function replace() {
    if (replaced) return;
    replaced = true;
    fs.renameSync(marker, path.join(root, "original.json"));
    fs.symlinkSync(replacement, marker);
  }
  process.argv = [argv[0], argv[1], root];
  fs.lstatSync = (file, ...args) => { const stat = originals.lstatSync(file, ...args); if (file === marker) replace(); return stat; };
  fs.fstatSync = (...args) => { const stat = originals.fstatSync(...args); replace(); return stat; };
  try {
    assert.equal(open().probe, "original");
    assert.equal(replaced, true);
  } finally {
    Object.assign(fs, originals);
    process.argv = argv;
  }
});

test("read stays bound to the validated descriptor when its pathname is replaced", posixOnly, (t) => {
  const root = sandbox(t);
  const file = path.join(root, "file");
  const outside = path.join(root, "outside");
  fs.writeFileSync(file, "validated bytes");
  fs.writeFileSync(outside, "replacement bytes");
  const original = fs.fstatSync;
  fs.fstatSync = (fd) => {
    const stat = original(fd);
    fs.renameSync(file, path.join(root, "original"));
    fs.symlinkSync(outside, file);
    return stat;
  };
  try {
    assert.equal(readRegular(file).toString(), "validated bytes");
  } finally {
    fs.fstatSync = original;
  }
});

for (const failure of [null, "nonregular", "fstatSync", "readFileSync"]) {
  test(`descriptor closes after ${failure || "successful read"}`, posixOnly, (t) => {
    const root = sandbox(t);
    const file = path.join(root, "file");
    if (failure === "nonregular") fs.mkdirSync(file);
    else fs.writeFileSync(file, "bytes");
    const originalOpen = fs.openSync;
    const originalFailure = failure !== "nonregular" && failure && fs[failure];
    let descriptor;
    fs.openSync = (...args) => { descriptor = originalOpen(...args); return descriptor; };
    if (originalFailure) fs[failure] = () => { throw new Error("injected failure"); };
    try {
      if (failure === "nonregular") assert.throws(() => readRegular(file), /nonregular file/);
      else if (failure) assert.throws(() => readRegular(file), /injected failure/);
      else assert.equal(readRegular(file).toString(), "bytes");
    } finally {
      fs.openSync = originalOpen;
      if (originalFailure) fs[failure] = originalFailure;
    }
    assert.equal(typeof descriptor, "number");
    assert.throws(() => fs.fstatSync(descriptor), { code: "EBADF" });
  });
}

test("missing or invalid POSIX protections refuse before any filesystem I/O", () => {
  const source = fs.readFileSync(commonPath, "utf8");
  for (const flag of ["O_NOFOLLOW", "O_NONBLOCK"]) {
    for (const value of [undefined, 0, 1.5]) {
      let io = 0;
      const constants = { O_RDONLY: 0, O_NOFOLLOW: 1, O_NONBLOCK: 2, [flag]: value };
      const mockedFs = new Proxy({ constants }, {
        get(target, key) {
          if (key === "constants") return target.constants;
          return () => { io++; throw new Error("Unexpected filesystem I/O"); };
        },
      });
      const module = { exports: {} };
      vm.runInNewContext(source, { module, require: name => name === "node:fs" ? mockedFs : require(name) }, { filename: commonPath });
      assert.throws(() => module.exports.readRegular("unreadable-fixture"), /requires POSIX O_NOFOLLOW and O_NONBLOCK/);
      assert.equal(io, 0, `${flag}=${value} must refuse before any filesystem I/O`);
    }
  }
  if (!hasProtections) {
    const originalOpen = fs.openSync;
    let opens = 0;
    fs.openSync = () => { opens++; throw new Error("Unexpected open"); };
    try {
      assert.throws(() => readRegular("unreadable-fixture"), /requires POSIX O_NOFOLLOW and O_NONBLOCK/);
      assert.equal(opens, 0, "Actual unsupported platform must refuse before opening");
    } finally {
      fs.openSync = originalOpen;
    }
  }
});
