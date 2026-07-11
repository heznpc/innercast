#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  compileExecutionPlan,
  renderExecutionPlanJson,
  renderExecutionPrompt,
} from "./innercast-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rosterPath = path.join(root, "roster", "innercast.roles.json");
const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));

const fail = (message) => {
  throw new Error(message);
};

const runNode = (args, { expectFailure = false } = {}) => {
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    encoding: "utf8",
  });
  if (expectFailure) {
    if (result.status === 0) fail(`Expected command to fail: node ${args.join(" ")}`);
    return `${result.stdout || ""}${result.stderr || ""}`;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
  return result.stdout;
};

const requireString = (object, field, label) => {
  if (typeof object[field] !== "string" || !object[field].trim()) {
    fail(`${label} missing string field: ${field}`);
  }
};

const expectedIds = ["doubt", "spark", "forge"];
if (JSON.stringify(roster.characters?.map((character) => character.id)) !== JSON.stringify(expectedIds)) {
  fail(`Default roster must be the three inner voices in order: ${expectedIds.join(", ")}`);
}
if (roster.namingStatus !== "candidate") {
  fail("Current default roster must stay candidate until character names are owner-approved.");
}
if (!roster.namingNote || !roster.namingNote.includes("pending owner approval")) {
  fail("Candidate roster must include a clear namingNote.");
}
const expectedProtocol = {
  scope: "current-task",
  dispatch: "parallel",
  decisionOwner: "host",
  contextMode: "shared-decision",
};
for (const [field, value] of Object.entries(expectedProtocol)) {
  if (roster.protocol?.[field] !== value) fail(`Roster protocol ${field} must be ${value}.`);
}
const expectedSynthesisLeadLines = ["Decision: <one clear choice>", "Confidence: Low / Medium / High"];
const expectedSynthesisSections = ["Character Positions", "Main Tension", "Decision Rationale", "Risks Accepted", "Next Action"];
if (JSON.stringify(roster.protocol?.synthesisLeadLines) !== JSON.stringify(expectedSynthesisLeadLines)) {
  fail("Roster must define the canonical Decision and Confidence synthesis lead lines.");
}
if (JSON.stringify(roster.protocol?.synthesisSections) !== JSON.stringify(expectedSynthesisSections)) {
  fail("Roster must define the canonical five host synthesis sections.");
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
  if (!character.rules.some((rule) => /not the final decision maker/i.test(rule))) {
    fail(`${character.id} must explicitly keep final authority with the host.`);
  }

  const surfaces = [
    ["Codex", path.join(root, "adapters", "codex", "agents", `${character.id}.toml`)],
    ["Claude", path.join(root, "adapters", "claude", "agents", `${character.id}.md`)],
    ["Gemini", path.join(root, "adapters", "gemini", "agents", `${character.id}.md`)],
  ];
  for (const [label, file] of surfaces) {
    if (!fs.existsSync(file)) fail(`${label} adapter missing: ${file}`);
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes(character.displayName)) fail(`${label} adapter missing display name: ${file}`);
    if (!text.includes("The host owns the final decision")) fail(`${label} adapter lost host decision ownership: ${file}`);
    if (!text.includes("one recurring inner voice")) fail(`${label} adapter lost same-task character identity: ${file}`);
  }
}

for (const surface of ["codex", "claude", "gemini"]) {
  const dir = path.join(root, "adapters", surface, "agents");
  const names = fs.readdirSync(dir).sort();
  const extension = surface === "codex" ? ".toml" : ".md";
  const expected = expectedIds.map((id) => `${id}${extension}`).sort();
  if (JSON.stringify(names) !== JSON.stringify(expected)) {
    fail(`${surface} adapters must contain only ${expected.join(", ")}; found ${names.join(", ")}`);
  }
}

runNode([path.join(root, "scripts", "generate-adapters.mjs"), "--check"]);

const sampleInput = path.join(root, "examples", "sample-decision.json");
const engineScript = path.join(root, "scripts", "innercast-engine.mjs");
const firstJson = runNode([engineScript, "--input", sampleInput, "--format", "json"]);
const secondJson = runNode([engineScript, "--input", sampleInput, "--format", "json"]);
if (firstJson !== secondJson) fail("Engine output must be byte-for-byte deterministic for identical input.");
const plan = JSON.parse(firstJson);
if (plan.schema !== "innercast.execution-plan.v1") fail("Engine returned the wrong schema.");
if (plan.executionPlan.finalDecisionOwner !== "root-agent-person") fail("Root/person must own the final decision.");
if (plan.executionPlan.waves[0]?.parallel !== true) fail("Character wave must be parallel.");
if (JSON.stringify(plan.cast.characterOrder) !== JSON.stringify(expectedIds)) fail("Engine plan lost the default cast order.");
if (!plan.rootSynthesisPrompt.includes("Make the final decision yourself")) fail("Root synthesis prompt must retain authority.");
for (const expected of [...expectedSynthesisLeadLines, ...expectedSynthesisSections.map((section, index) => `${index + 1}. ${section}`)]) {
  if (!plan.rootSynthesisPrompt.includes(expected)) fail(`Root synthesis prompt missing canonical output field: ${expected}`);
}
if (/\d+\. Decision:|\d+\. Confidence:/.test(plan.rootSynthesisPrompt)) {
  fail("Decision and Confidence must remain unnumbered synthesis lead lines.");
}
if (firstJson.includes('"characterId": "verdict"')) fail("Default execution plan must not contain a Verdict worker.");
if (renderExecutionPlanJson(compileExecutionPlan({ decision: "Test", platform: "codex" })) !== renderExecutionPlanJson(compileExecutionPlan({ decision: "Test", platform: "codex" }))) {
  fail("Import API must be deterministic.");
}

for (const platform of ["codex", "claude", "gemini", "generic"]) {
  const prompt = runNode([engineScript, "--decision", "Choose a reversible next move", "--platform", platform, "--format", "prompt"]);
  for (const expected of ["Doubt", "Spark", "Forge", "Root synthesis"]) {
    if (!prompt.includes(expected)) fail(`${platform} execution prompt missing ${expected}.`);
  }
  if (/^## Verdict$/m.test(prompt) || /Target: .*\bverdict\b/i.test(prompt)) {
    fail(`${platform} execution prompt must not create a Verdict worker.`);
  }
  if (platform === "gemini") {
    for (const id of expectedIds) {
      if (!prompt.includes(`invoke_agent(agent_name: "${id}", prompt: <character prompt>)`)) {
        fail(`Gemini execution prompt missing invoke_agent target for ${id}.`);
      }
    }
    if (/Target: .*@(?:doubt|spark|forge)/.test(prompt)) {
      fail("Gemini execution prompt must not claim @name invocation syntax.");
    }
  }
}

const invalidOwner = structuredClone(roster);
invalidOwner.protocol.decisionOwner = "character";
try {
  compileExecutionPlan({ decision: "Test", castDefinition: invalidOwner });
  fail("Engine must reject character-owned final decisions.");
} catch (error) {
  if (!/decisionOwner/.test(error.message)) throw error;
}
const duplicateCast = structuredClone(roster);
duplicateCast.characters.push(structuredClone(duplicateCast.characters[0]));
try {
  compileExecutionPlan({ decision: "Test", castDefinition: duplicateCast });
  fail("Engine must reject duplicate character ids.");
} catch (error) {
  if (!/duplicate character id/.test(error.message)) throw error;
}
if (!renderExecutionPrompt(plan).includes("current task")) fail("Execution prompt must remain inside the current task.");

const packScript = path.join(root, "scripts", "innercast-pack.mjs");
const harnessScript = path.join(root, "scripts", "innercast-harness.mjs");
runNode([packScript, "list"]);
for (const packId of ["innercast-default", "noir-review"]) {
  runNode([packScript, "validate", packId]);
  runNode([packScript, "preview", packId]);
  const doctor = runNode([packScript, "doctor", packId]);
  if (!doctor.includes("Generated agent ids:")) fail(`Pack doctor missing generated ids for ${packId}`);
  if (!doctor.includes("namingStatus is candidate")) fail(`Pack doctor must warn about candidate names for ${packId}`);
  if (doctor.includes("no protocol")) fail(`Bundled pack must include a runtime protocol: ${packId}`);
}

const sameDiff = runNode([packScript, "diff", "innercast-default", "innercast-default"]);
if (!sameDiff.includes("No character changes.")) fail("Pack diff should report no changes for identical packs.");
if (!sameDiff.includes("Protocol: unchanged")) fail("Pack diff should report unchanged protocol.");
const differentDiff = runNode([packScript, "diff", "innercast-default", "noir-review"]);
if (!differentDiff.includes("Added characters: suspicion, lure, hammer, closure")) fail("Pack diff should report added noir characters.");
if (!differentDiff.includes("Removed characters: doubt, spark, forge")) fail("Pack diff should report removed default characters.");

const defaultPrompt = runNode([harnessScript, "--json", sampleInput, "--format", "prompt"]);
for (const expected of ["inside this current task", "Doubt", "Spark", "Forge", "Root synthesis"]) {
  if (!defaultPrompt.includes(expected)) fail(`Harness missing current-task contract: ${expected}`);
}
if (/final character|Verdict Decision|Kill \/ Narrow \/ Build/.test(defaultPrompt)) {
  fail("Harness must not delegate the host decision to a final character.");
}

const noirPrompt = runNode([
  harnessScript,
  "--pack", "noir-review",
  "--platform", "codex",
  "--decision", "Choose a direction",
  "--format", "prompt",
]);
for (const expected of ["noir-review-suspicion", "noir-review-closure", "Root synthesis"]) {
  if (!noirPrompt.includes(expected)) fail(`Noir harness missing ${expected}`);
}
if (!noirPrompt.includes("Make the final decision yourself")) fail("Noir pack must preserve host authority.");

const exportDir = fs.mkdtempSync(path.join(os.tmpdir(), "innercast-pack-"));
try {
  runNode([packScript, "export", "innercast-default", "--out", exportDir]);
  for (const surface of ["codex", "claude", "gemini"]) {
    const extension = surface === "codex" ? ".toml" : ".md";
    for (const id of expectedIds) {
      const file = path.join(exportDir, surface, "agents", `innercast-default-${id}${extension}`);
      if (!fs.existsSync(file)) fail(`Pack export missing file: ${file}`);
    }
  }
  if (fs.existsSync(path.join(exportDir, "codex", "agents", "innercast-default-verdict.toml"))) {
    fail("Pack export must not retain the retired default Verdict worker.");
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
  if (!customDoctor.includes("namingStatus is candidate")) fail("Starter pack must retain candidate naming status.");
  if (customDoctor.includes("no protocol")) fail("Starter pack must include the current-task protocol.");
  const customPrompt = runNode([harnessScript, "--pack", packDir, "--decision", "Custom decision"]);
  for (const expected of ["custom-pack-doubt", "custom-pack-spark", "custom-pack-forge", "Root synthesis"]) {
    if (!customPrompt.includes(expected)) fail(`Path-based pack harness missing ${expected}`);
  }
} finally {
  fs.rmSync(initDir, { recursive: true, force: true });
}

runNode([packScript, "install", "innercast-default", "--all", "--dry-run"]);
runNode([packScript, "uninstall", "innercast-default", "--all", "--dry-run"]);

const installScript = path.join(root, "scripts", "install-adapters.mjs");
const installRoot = fs.mkdtempSync(path.join(os.tmpdir(), "innercast-install-"));
try {
  const codexDir = path.join(installRoot, "codex-agents");
  const skillDir = path.join(installRoot, "skill");
  const oldAdapters = path.join(skillDir, "adapters", "codex", "agents");
  fs.mkdirSync(oldAdapters, { recursive: true });
  fs.mkdirSync(codexDir, { recursive: true });
  const legacyVerdict = "legacy generated verdict\n";
  fs.writeFileSync(path.join(oldAdapters, "verdict.toml"), legacyVerdict);
  fs.writeFileSync(path.join(codexDir, "verdict.toml"), legacyVerdict);
  runNode([
    installScript, "--codex", "--skill",
    "--codex-dir", codexDir,
    "--skill-dir", skillDir,
  ]);
  if (fs.existsSync(path.join(codexDir, "verdict.toml"))) fail("Installer must remove an unchanged stale Verdict adapter.");
  if (fs.existsSync(path.join(skillDir, "adapters", "codex", "agents", "verdict.toml"))) fail("Installed skill must not retain stale Verdict source.");
  const installManifest = path.join(installRoot, ".skill-innercast-install.json");
  if (!fs.existsSync(installManifest)) fail("Skill installer must record a managed-file manifest.");

  if (process.platform !== "win32") {
    const sourceEngine = path.join(root, "scripts", "innercast-engine.mjs");
    const installedEngine = path.join(skillDir, "scripts", "innercast-engine.mjs");
    fs.chmodSync(installedEngine, 0o644);
    const modeSync = runNode([
      installScript, "--skill",
      "--skill-dir", skillDir,
    ]);
    if (!modeSync.includes("sync mode") || (fs.statSync(installedEngine).mode & 0o777) !== (fs.statSync(sourceEngine).mode & 0o777)) {
      fail("Skill installer must synchronize executable modes for unchanged managed files.");
    }
  }

  const upgradeSource = path.join(installRoot, "upgrade-source");
  fs.cpSync(root, upgradeSource, { recursive: true });
  const upgradeSkillSource = path.join(upgradeSource, "SKILL.md");
  const installedSkillTarget = path.join(skillDir, "SKILL.md");
  fs.appendFileSync(upgradeSkillSource, "\n<!-- managed upgrade fixture -->\n");
  runNode([
    path.join(upgradeSource, "scripts", "install-adapters.mjs"), "--skill",
    "--skill-dir", skillDir,
  ]);
  const installedSkillBytes = fs.readFileSync(installedSkillTarget);
  const upgradeSkillBytes = fs.readFileSync(upgradeSkillSource);
  if (!installedSkillBytes.equals(upgradeSkillBytes)) {
    fail(`Installer must upgrade unchanged managed skill files without --force (installed fixture: ${installedSkillBytes.includes("managed upgrade fixture")}; source fixture: ${upgradeSkillBytes.includes("managed upgrade fixture")}).`);
  }
  fs.appendFileSync(installedSkillTarget, "\n<!-- user change fixture -->\n");
  fs.appendFileSync(upgradeSkillSource, "\n<!-- next source fixture -->\n");
  const skillRefusal = runNode([
    path.join(upgradeSource, "scripts", "install-adapters.mjs"), "--skill",
    "--skill-dir", skillDir,
  ], { expectFailure: true });
  if (!skillRefusal.includes("Refusing to overwrite changed file")) {
    fail("Installer must protect user-modified managed skill files.");
  }

  fs.writeFileSync(path.join(codexDir, "doubt.toml"), "user modified\n");
  const refusal = runNode([
    installScript, "--codex",
    "--codex-dir", codexDir,
    "--skill-dir", skillDir,
  ], { expectFailure: true });
  if (!refusal.includes("Refusing to overwrite changed file")) fail("Installer must protect user-modified adapters.");
} finally {
  fs.rmSync(installRoot, { recursive: true, force: true });
}

process.stdout.write(`Innercast validation passed: ${expectedIds.length} same-task characters, host-owned synthesis, four runtime targets.\n`);
