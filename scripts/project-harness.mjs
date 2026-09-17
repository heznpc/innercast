#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const surfaces = ["native-pet", "agent-adapter", "web-preview", "core", "repository-harness"];
const fail = (message) => { throw new Error(message); };
const string = (value, label) => {
  if (typeof value !== "string" || !value.trim()) fail(`${label} must be a nonempty string.`);
};
const strings = (value, label) => {
  if (!Array.isArray(value)) fail(`${label} must be an array.`);
  value.forEach((item) => string(item, label));
};
const object = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${label} must be an object.`);
};
const choice = (value, allowed, label) => {
  if (!allowed.includes(value)) fail(`${label} must be one of: ${allowed.join(", ")}.`);
};
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));

export function evidenceFile(reference, repo = root) {
  string(reference, "Evidence path");
  if (path.isAbsolute(reference)) fail("Evidence must use a repository-relative path.");
  const base = fs.realpathSync(repo);
  const resolved = fs.realpathSync(path.resolve(base, reference));
  const relative = path.relative(base, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail("Evidence must stay inside the repository, including symlink targets.");
  }
  const stat = fs.statSync(resolved);
  if (!stat.isFile() || stat.size === 0) fail(`Evidence must be a nonempty file: ${reference}`);
  return resolved;
}

export function validateHandoff(record, repo = root) {
  object(record, "Handoff");
  if (record.version !== 1) fail("Unsupported handoff version.");
  for (const key of ["updatedAt", "task", "summary", "nextAction"]) string(record[key], key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.updatedAt) || Number.isNaN(Date.parse(record.updatedAt))) {
    fail("updatedAt must be a date in YYYY-MM-DD format.");
  }
  choice(record.requestedSurface, surfaces, "requestedSurface");
  choice(record.deliveredSurface, [...surfaces, "none"], "deliveredSurface");
  choice(record.status, ["in-progress", "partial", "blocked", "complete"], "status");
  strings(record.remaining, "remaining");
  strings(record.productGaps, "productGaps");
  if (!Array.isArray(record.runs)) fail("runs must be an array.");
  for (const run of record.runs) {
    object(run, "Run");
    choice(run.surface, surfaces, "Run surface");
    choice(run.kind, ["runtime", "test"], "Run kind");
    string(run.action, "Run action");
    string(run.observed, "Run observation");
    evidenceFile(run.evidence, repo);
    if (run.surface === "native-pet" && run.kind === "runtime") {
      string(run.host, "Native-pet host/version");
      object(run.checks, "Native-pet checks");
      for (const key of ["installed", "visibleInHost", "requestedBehaviorObserved"]) {
        if (typeof run.checks[key] !== "boolean") fail(`Native-pet ${key} must be a boolean.`);
      }
    }
  }
  if (record.status === "complete") {
    if (record.requestedSurface !== record.deliveredSurface) {
      fail("Cannot complete a task on a different surface: a web demo or agent is not a native pet.");
    }
    if (record.remaining.length) fail("Complete tasks cannot have remaining task work.");
    const observed = record.runs.some((run) => run.kind === "runtime"
      && run.surface === record.requestedSurface
      && (run.surface !== "native-pet" || ["installed", "visibleInHost", "requestedBehaviorObserved"]
        .every((key) => run.checks[key] === true)));
    if (!observed) fail("Completion requires runtime evidence on the requested surface; tests alone are insufficient.");
  } else if (!record.remaining.length) {
    fail("Unfinished tasks must state remaining work.");
  }
  return record;
}

export function validateProduct(product, repo = root) {
  object(product, "Product");
  if (product.version !== 1) fail("Unsupported product contract version.");
  object(product.intent, "Product intent");
  if (product.intent.character !== "native-pet") fail("Product intent must preserve character = native-pet.");
  for (const key of ["source", "definition"]) string(product.intent[key], `Intent ${key}`);
  for (const key of ["journey", "constraints"]) {
    strings(product.intent[key], `Intent ${key}`);
    if (!product.intent[key].length) fail(`Intent ${key} cannot be empty.`);
  }
  object(product.harnessDefaults, "Harness defaults");
  string(product.harnessDefaults.source, "Harness defaults source");
  string(product.harnessDefaults.completion, "Completion rule");
  if (JSON.stringify(product.harnessDefaults.surfaces) !== JSON.stringify(surfaces)) {
    fail("Harness surface definitions differ from the validator.");
  }
  if (!Array.isArray(product.capabilities) || !product.capabilities.length) fail("Capabilities are required.");
  const seen = new Set();
  for (const capability of product.capabilities) {
    object(capability, "Capability");
    string(capability.id, "Capability id");
    if (seen.has(capability.id)) fail(`Duplicate capability: ${capability.id}`);
    seen.add(capability.id);
    choice(capability.status, ["implemented", "unverified", "unsupported"], "Capability status");
    string(capability.description, "Capability description");
    strings(capability.evidence, "Capability evidence");
    capability.evidence.forEach((ref) => evidenceFile(ref, repo));
    if (capability.status !== "unverified" && !capability.evidence.length) {
      fail(`${capability.id}: implemented/unsupported claims require evidence.`);
    }
    if (["native-pet-installation", "session-reaction-bridge"].includes(capability.id)
      && capability.status === "implemented") {
      const proof = validateHandoff(readJson(evidenceFile(capability.verification, repo)), repo);
      if (proof.status !== "complete" || proof.requestedSurface !== "native-pet") {
        fail(`${capability.id}: implemented native-pet capabilities require a completed native-pet verification record.`);
      }
    }
  }
  for (const id of ["native-pet-installation", "session-reaction-bridge"]) {
    if (!seen.has(id)) fail(`Missing product capability: ${id}`);
  }
  return product;
}

export function checkRepository(repo = root) {
  const product = validateProduct(readJson(path.join(repo, "harness/product.json")), repo);
  const handoff = validateHandoff(readJson(path.join(repo, "harness/handoff.json")), repo);
  for (const entry of ["AGENTS.md", "CLAUDE.md", "GEMINI.md"]) {
    const content = fs.readFileSync(evidenceFile(entry, repo), "utf8");
    if (!content.includes("harness:context")) fail(`${entry} must route tasks to harness:context.`);
  }
  for (const entry of ["README.md", "docs/surface-map.md", "docs/user-guide.md"]) {
    const content = fs.readFileSync(evidenceFile(entry, repo), "utf8");
    if (!content.includes("development-harness.md")) fail(`${entry} must link to the development harness.`);
  }
  return { product, handoff };
}

function context() {
  const { product, handoff } = checkRepository();
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  console.log(`# Innercast task context\n\nCheckout: ${git("branch", "--show-current")} @ ${git("rev-parse", "--short", "HEAD")}`);
  console.log("\nPRODUCT INTENT (not a host capability claim)\n" + product.intent.definition);
  console.log("Source: " + product.intent.source);
  for (const item of product.intent.journey) console.log(`- ${item}`);
  for (const item of product.intent.constraints) console.log(`- ${item}`);
  console.log("\nCAPABILITIES (implemented means code exists; runtime proof is separate)");
  for (const cap of product.capabilities) console.log(`- ${cap.id}: ${cap.status}. ${cap.description}`);
  console.log(`\nHANDOFF: ${handoff.task}\nStatus: ${handoff.status}; requested: ${handoff.requestedSurface}; delivered: ${handoff.deliveredSurface}\n${handoff.summary}`);
  for (const run of handoff.runs) console.log(`Observed (${run.kind}, ${run.surface}): ${run.observed}\nEvidence: ${run.evidence}`);
  for (const item of handoff.remaining) console.log(`Remaining: ${item}`);
  for (const item of handoff.productGaps) console.log(`Product gap: ${item}`);
  console.log(`Next action: ${handoff.nextAction}`);
  console.log("\nRead AGENTS.md and docs/development-harness.md. Update the handoff with the work.\nExisting forks/worktrees require integrating these commits; context is not synchronized automatically.");
}

export function main(args) {
  const [command, file, ...extra] = args;
  if (extra.length || (command !== "verify" && file)) fail("Unexpected arguments.");
  if (command === "context") context();
  else if (command === "check") {
    const { handoff } = checkRepository();
    console.log(`Harness records valid. Task: ${handoff.status}. Native-pet product completion is not implied.`);
  } else if (command === "verify" && file) {
    const record = validateHandoff(readJson(path.resolve(file)));
    console.log(`Handoff valid: ${record.status} (${record.requestedSurface}). Evidence content still requires human/agent inspection.`);
  } else fail("Usage: node scripts/project-harness.mjs context|check|verify <record.json>");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(`Harness: ${error.message}`); process.exitCode = 1; }
}
