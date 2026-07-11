import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  compileCastPlan,
  renderExecutionPlanJson,
  renderExecutionPlanMarkdown,
  renderExecutionPrompt,
  stableSerialize,
} from "../lib/core.mjs";
import { evaluateExecutionBudget, evaluateProjectedExecutionBudget, estimateTokens } from "../lib/budget.mjs";
import { createDefaultHostRegistry, renderAgentFiles } from "../lib/host-adapters.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const roster = JSON.parse(fs.readFileSync(path.join(root, "roster", "innercast.roles.json"), "utf8"));
const sample = JSON.parse(fs.readFileSync(path.join(root, "examples", "sample-decision.json"), "utf8"));
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");

const compileSample = () => compileCastPlan({
  decision: sample.decision,
  context: sample.context,
  constraints: sample.constraints,
  stakes: sample.stakes,
  platform: sample.platform,
  castDefinition: roster,
  sourceLabel: "canonical-roster",
});

test("host-independent core modules do not import Node built-ins", () => {
  for (const file of ["schema.mjs", "compiler.mjs", "renderers.mjs", "core.mjs", "budget.mjs", "host-adapters.mjs"]) {
    const source = fs.readFileSync(path.join(root, "lib", file), "utf8");
    assert.doesNotMatch(source, /from\s+["']node:/, file);
    assert.doesNotMatch(source, /\bprocess\./, file);
  }
});

test("pure core preserves the pre-refactor sample output", () => {
  const output = compileSample();
  assert.equal(output.cast.definitionSha256, "ceee09d04efb5afe7b12855cf1a3e53c78b8187d0a4c74ed1c21b0a2ee62cdc8");
  assert.deepEqual(output.cast.characterOrder, ["doubt", "spark", "forge"]);
  assert.equal(hash(renderExecutionPlanJson(output)), "9e6aca595896b49bbafc95635dc6a2ecf4f0d137ff3dc01f30b01db2390b690b");
  assert.equal(hash(renderExecutionPlanMarkdown(output)), "954d9e4879e7b0fb3dd13a7bbcc605dee5a525343725b8eb9cb391bb3a01dc16");
  assert.equal(hash(renderExecutionPrompt(output)), "096cfd18ecf82909ec1fb200ce155223e07d9b0f2236312d9b53d9352366da46");
});

test("CLI keeps newline and golden output compatibility", () => {
  const expected = {
    json: "9a9d9366dad322ec5eef5c6b400336a5dc6eea1cd88b482e13d6ace1802438f6",
    markdown: "1fb99145fd88f040469dadb20f8def27c15a2f522d955d127226792d7f34c704",
    prompt: "3fe9fae4271c774aaebefde2fd428889f34d4caf8558e2f00b4652bf947808d7",
  };
  for (const [format, digest] of Object.entries(expected)) {
    const result = spawnSync(process.execPath, [
      path.join(root, "scripts", "innercast-engine.mjs"),
      "--input", path.join(root, "examples", "sample-decision.json"),
      "--format", format,
    ], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(hash(result.stdout), digest, format);
  }
});

test("shared host renderers exactly match checked-in canonical adapters", () => {
  const files = renderAgentFiles(roster, { hosts: ["codex", "claude", "gemini"] });
  assert.equal(files.length, 9);
  for (const file of files) {
    const checkedIn = fs.readFileSync(path.join(root, "adapters", file.surface, "agents", file.name), "utf8");
    assert.equal(file.content, checkedIn, `${file.surface}/${file.name}`);
  }
});

test("host registry separates public Gemini syntax from its internal tool contract", () => {
  const adapter = createDefaultHostRegistry().gemini;
  const character = roster.characters[0];
  const invocation = adapter.invocation(roster, character);
  assert.equal(invocation.publicSyntax, "@doubt");
  assert.deepEqual(invocation.internalTool, {
    name: "invoke_agent",
    arguments: { agent_name: "doubt", prompt: "<character prompt>" },
  });
  assert.equal(adapter.target(roster, character).invocation, 'invoke_agent(agent_name: "doubt", prompt: <character prompt>)');
});

test("apps can inject a host registry without changing the compiler", () => {
  const defaults = createDefaultHostRegistry();
  const registry = {
    ...defaults,
    generic: {
      ...defaults.generic,
      target(_cast, character) {
        return {
          characterId: character.id,
          roleId: `external-${character.id}`,
          nickname: character.displayName,
          colorHint: character.color,
          invocation: `external.invoke(${character.id})`,
        };
      },
    },
  };
  const output = compileCastPlan({
    ...sample,
    platform: "generic",
    castDefinition: roster,
    sourceLabel: "external-host-test",
    hostRegistry: registry,
  });
  assert.equal(output.executionPlan.waves[0].steps[0].target.roleId, "external-doubt");
  assert.equal(output.adapterTargets.generic[2].invocation, "external.invoke(forge)");
});

test("definition hashes stay stable across object key order", () => {
  const reversed = Object.fromEntries(Object.entries(roster).reverse());
  assert.equal(stableSerialize(roster), stableSerialize(reversed));
  const original = compileSample();
  const reordered = compileCastPlan({ ...sample, castDefinition: reversed, sourceLabel: "canonical-roster" });
  assert.equal(original.cast.definitionSha256, reordered.cast.definitionSha256);
});

test("budget accounting uses UTF-8 bytes and classifies oversized materialization", () => {
  assert.ok(estimateTokens("한글😀") > Math.ceil("한글😀".length / 4));
  const normal = evaluateExecutionBudget(compileSample());
  assert.equal(normal.ok, true);
  assert.deepEqual(normal.warnings, []);
  assert.equal(normal.measurement.estimator, "ceil(utf8-bytes/4)");

  const large = compileCastPlan({
    decision: "Review the large shared context",
    context: "x".repeat(250_000),
    constraints: "Keep the host decision owner",
    stakes: "High token cost",
    castDefinition: roster,
    sourceLabel: "budget-test",
  });
  const classified = evaluateExecutionBudget(large);
  assert.equal(classified.ok, false);
  assert.ok(classified.warnings.length > 0);
  assert.ok(classified.violations.length > 0);
});

test("CLI rejects an oversized projected prompt before materialization", () => {
  const projection = evaluateProjectedExecutionBudget({
    decision: "Review the large shared context",
    context: "x".repeat(250_000),
    constraints: "Keep the host decision owner",
    stakes: "High token cost",
    castDefinition: roster,
  });
  assert.equal(projection.ok, false);

  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "innercast-budget-test-"));
  try {
    const input = path.join(temporary, "large.json");
    fs.writeFileSync(input, JSON.stringify({
      decision: "Review the large shared context",
      context: "x".repeat(250_000),
      constraints: "Keep the host decision owner",
      stakes: "High token cost",
    }));
    const result = spawnSync(process.execPath, [
      path.join(root, "scripts", "innercast-engine.mjs"),
      "--input", input,
    ], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /before materialization/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

test("root package can import the public Innercast core entry point", async () => {
  const entry = await import(path.join(root, "index.mjs"));
  assert.equal(typeof entry.compileCastPlan, "function");
  assert.equal(typeof entry.renderAgentFiles, "function");
  assert.equal(typeof entry.evaluateExecutionBudget, "function");
});
