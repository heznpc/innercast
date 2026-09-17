import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { root, validateHandoff, validateProduct, evidenceFile, checkRepository } from "../../scripts/project-harness.mjs";

const fixture = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "innercast-harness-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, "observation.txt"), "Fixture observation, not real product evidence.");
  return dir;
};
const record = () => ({
  version: 1, updatedAt: "2026-09-17", task: "Native pet fixture", summary: "Fixture only",
  requestedSurface: "native-pet", deliveredSurface: "native-pet", status: "complete",
  remaining: [], productGaps: [], nextAction: "Review evidence",
  runs: [{ surface: "native-pet", kind: "runtime", action: "Install and exercise pet",
    observed: "Pet appears and performs the requested behavior", evidence: "observation.txt",
    host: "Fixture host 1.0", checks: { installed: true, visibleInHost: true, requestedBehaviorObserved: true } }],
});

test("accepts native-pet completion only with its host observation record", (t) => {
  assert.equal(validateHandoff(record(), fixture(t)).status, "complete");
});
test("rejects a web character substituted for a native pet", (t) => {
  const value = record();
  value.deliveredSurface = "web-preview";
  value.runs[0].surface = "web-preview";
  assert.throws(() => validateHandoff(value, fixture(t)), /different surface/);
});
test("rejects relabeled completion backed only by a web runtime or tests", (t) => {
  const dir = fixture(t);
  for (const run of [ { ...record().runs[0], surface: "web-preview" }, { ...record().runs[0], kind: "test" } ]) {
    const value = record(); value.runs = [run];
    assert.throws(() => validateHandoff(value, dir), /runtime evidence/);
  }
});
test("installation without visibility or requested behavior cannot complete", (t) => {
  const dir = fixture(t);
  for (const key of ["installed", "visibleInHost", "requestedBehaviorObserved"]) {
    const value = record(); value.runs[0].checks[key] = false;
    assert.throws(() => validateHandoff(value, dir), /runtime evidence/);
  }
});
test("allows honest partial progress on a different surface", (t) => {
  const value = record();
  value.status = "partial"; value.deliveredSurface = "web-preview";
  value.runs[0].surface = "web-preview"; value.remaining = ["Install in native host"];
  assert.equal(validateHandoff(value, fixture(t)).requestedSurface, "native-pet");
});
test("rejects completion with unfinished work and missing evidence", (t) => {
  const dir = fixture(t);
  const value = record(); value.remaining = ["Still need to install"];
  assert.throws(() => validateHandoff(value, dir), /remaining/);
  value.remaining = []; value.runs[0].evidence = "missing.txt";
  assert.throws(() => validateHandoff(value, dir), /ENOENT/);
  fs.writeFileSync(path.join(dir, "empty.txt"), "");
  assert.throws(() => evidenceFile("empty.txt", dir), /nonempty/);
});
test("rejects absolute paths, traversal and symlink escape", (t) => {
  const dir = fixture(t);
  assert.throws(() => evidenceFile(path.join(dir, "observation.txt"), dir), /relative/);
  assert.throws(() => evidenceFile("..", dir), /inside/);
  fs.symlinkSync(path.join(root, "README.md"), path.join(dir, "outside.txt"));
  assert.throws(() => evidenceFile("outside.txt", dir), /inside/);
});
test("keeps user intent separate from unsupported implementation claims", () => {
  const product = JSON.parse(fs.readFileSync(path.join(root, "harness/product.json")));
  const changed = structuredClone(product); changed.intent.character = "agent-adapter";
  assert.throws(() => validateProduct(changed), /character = native-pet/);
  const capability = product.capabilities.find((item) => item.id === "native-pet-installation");
  capability.status = "implemented"; capability.evidence = ["README.md"];
  assert.throws(() => validateProduct(product), /Evidence path/);
});
test("repository entry points and durable context remain connected", () => {
  assert.equal(checkRepository().product.intent.character, "native-pet");
});
test("context runs from the nested kit directory without invoking models", () => {
  const run = spawnSync(process.execPath, [path.join(root, "scripts/project-harness.mjs"), "context"], {
    cwd: path.join(root, "innercast"), encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /built-in Pets/);
  assert.match(run.stdout, /native-pet-installation:/);
  assert.match(run.stdout, /Next action:/);
});
test("CLI rejects unknown commands and extra arguments", () => {
  for (const args of [["unknown"], ["verify"], ["check", "ignored.json"]]) {
    const run = spawnSync(process.execPath, [path.join(root, "scripts/project-harness.mjs"), ...args], { encoding: "utf8" });
    assert.equal(run.status, 1);
  }
});
