#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rosterPath = path.join(root, "roster", "innercast.roles.json");
const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));

const fail = (message) => {
  throw new Error(message);
};

const runNode = (args) => {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
  return result.stdout;
};

const requireString = (object, field, label) => {
  if (typeof object[field] !== "string" || !object[field].trim()) {
    fail(`${label} missing string field: ${field}`);
  }
};

if (!Array.isArray(roster.characters) || roster.characters.length < 2) {
  fail("Roster must include at least two characters.");
}
if (roster.namingStatus !== "candidate") {
  fail("Current default roster must stay candidate until character names are owner-approved.");
}
if (!roster.namingNote || !roster.namingNote.includes("pending owner approval")) {
  fail("Candidate roster must include a clear namingNote.");
}

const ids = new Set();
for (const character of roster.characters) {
  for (const field of ["id", "displayName", "archetype", "description", "oneLine", "color"]) {
    requireString(character, field, character.id || "<unknown>");
  }
  if (ids.has(character.id)) fail(`Duplicate character id: ${character.id}`);
  ids.add(character.id);
  for (const field of ["focus", "rules", "returnSections"]) {
    if (!Array.isArray(character[field]) || character[field].length === 0) {
      fail(`${character.id} missing non-empty array field: ${field}`);
    }
  }

  const codexPath = path.join(root, "adapters", "codex", "agents", `${character.id}.toml`);
  const claudePath = path.join(root, "adapters", "claude", "agents", `${character.id}.md`);
  const codex = fs.readFileSync(codexPath, "utf8");
  const claude = fs.readFileSync(claudePath, "utf8");
  if (!codex.includes(`name = "${character.id}"`)) fail(`Codex adapter has wrong name: ${codexPath}`);
  if (!codex.includes(`nickname_candidates = ["${character.displayName}"]`)) {
    fail(`Codex adapter missing display nickname: ${codexPath}`);
  }
  if (!codex.includes("Naming status: candidate")) {
    fail(`Codex adapter must disclose candidate naming status: ${codexPath}`);
  }
  if (!claude.startsWith("---\n")) fail(`Claude adapter missing frontmatter: ${claudePath}`);
  if (!claude.includes(`name: ${character.id}`)) fail(`Claude adapter has wrong name: ${claudePath}`);
  if (!claude.includes(`color: ${character.color}`)) fail(`Claude adapter missing color: ${claudePath}`);
  if (!claude.includes("Naming status: candidate")) {
    fail(`Claude adapter must disclose candidate naming status: ${claudePath}`);
  }
  if (character.id === "verdict") {
    for (const [label, text] of [["Codex", codex], ["Claude", claude]]) {
      if (!text.includes("\nSignal: Kill / Narrow / Build\n\n1. Why This Signal")) {
        fail(`${label} Verdict adapter must keep Signal as an unnumbered lead line.`);
      }
      if (text.includes("1. Signal: Kill / Narrow / Build")) {
        fail(`${label} Verdict adapter must not number the Signal line.`);
      }
    }
  }
}

runNode([path.join(root, "scripts", "generate-adapters.mjs"), "--check"]);

const packScript = path.join(root, "scripts", "innercast-pack.mjs");
const harnessScript = path.join(root, "scripts", "innercast-harness.mjs");
runNode([packScript, "list"]);
for (const packId of ["innercast-default", "noir-review"]) {
  runNode([packScript, "validate", packId]);
  runNode([packScript, "preview", packId]);
  const doctor = runNode([packScript, "doctor", packId]);
  if (!doctor.includes("Generated agent ids:")) fail(`Pack doctor missing generated ids for ${packId}`);
  if (!doctor.includes("namingStatus is candidate")) fail(`Pack doctor must warn about candidate names for ${packId}`);
}

const sameDiff = runNode([packScript, "diff", "innercast-default", "innercast-default"]);
if (!sameDiff.includes("No character changes.")) fail("Pack diff should report no changes for identical packs.");
if (!sameDiff.includes("Naming metadata: unchanged")) fail("Pack diff should report unchanged naming metadata for identical packs.");
const differentDiff = runNode([packScript, "diff", "innercast-default", "noir-review"]);
if (!differentDiff.includes("Naming metadata: changed")) fail("Pack diff should report changed naming metadata state.");
if (!differentDiff.includes("Added characters: suspicion, lure, hammer, closure")) fail("Pack diff should report added noir-review characters.");
if (!differentDiff.includes("Removed characters: doubt, spark, forge, verdict")) fail("Pack diff should report removed default characters.");

const defaultHandoff = runNode([harnessScript, "--json", path.join(root, "examples", "sample-idea.json"), "--format", "markdown"]);
if (!defaultHandoff.includes("Doubt: challenge assumptions")) fail("Default harness no longer emits the default cast.");
if (defaultHandoff.includes("Pack:")) fail("Default harness should not label a pack when none was requested.");

const noirHandoff = runNode([
  harnessScript,
  "--pack",
  "noir-review",
  "--adapter",
  "codex",
  "--idea",
  "Test idea",
  "--format",
  "prompt",
]);
for (const expected of ["noir-review-suspicion", "noir-review-closure", "Naming status: candidate", "Verdict: Kill / Narrow / Build", "4. Closure Decision"]) {
  if (!noirHandoff.includes(expected)) fail(`Pack harness missing expected text: ${expected}`);
}
if (noirHandoff.includes("5. Final Decision")) fail("Pack harness should resolve through the final character, not a generic final section.");

const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "innercast-pack-"));
try {
  runNode([packScript, "export", "innercast-default", "--out", exportDir]);
  for (const file of [
    path.join(exportDir, "innercast-pack.json"),
    path.join(exportDir, "codex", "agents", "innercast-default-doubt.toml"),
    path.join(exportDir, "codex", "agents", "innercast-default-verdict.toml"),
    path.join(exportDir, "claude", "agents", "innercast-default-doubt.md"),
    path.join(exportDir, "claude", "agents", "innercast-default-verdict.md"),
  ]) {
    if (!fs.existsSync(file)) fail(`Pack export missing file: ${file}`);
  }
} finally {
  fs.rmSync(exportDir, { recursive: true, force: true });
}

const initDir = fs.mkdtempSync(path.join(os.tmpdir(), "innercast-init-"));
try {
  const packDir = path.join(initDir, "custom-pack");
  runNode([packScript, "init", "custom-pack", "--name", "Custom Pack", "--out", packDir]);
  runNode([packScript, "validate", packDir]);
  const customDoctor = runNode([packScript, "doctor", packDir]);
  if (!customDoctor.includes("namingStatus is candidate")) fail("Starter pack doctor must warn that names are candidates.");
  runNode([packScript, "export", packDir, "--out", path.join(initDir, "exported")]);
  const customHandoff = runNode([harnessScript, "--pack", packDir, "--idea", "Custom idea"]);
  for (const expected of ["custom-pack-doubt", "Verdict Decision", "Signal: Kill / Narrow / Build"]) {
    if (!customHandoff.includes(expected)) fail(`Path-based pack harness missing expected text: ${expected}`);
  }
} finally {
  fs.rmSync(initDir, { recursive: true, force: true });
}

runNode([packScript, "install", "innercast-default", "--all", "--dry-run"]);
runNode([packScript, "uninstall", "innercast-default", "--all", "--dry-run"]);

process.stdout.write(`Innercast validation passed for ${roster.characters.length} characters and bundled packs.\n`);
