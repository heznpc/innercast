#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  MAX_FILE_BYTES,
  MAX_METADATA_CHARS,
  PLATFORM_IDS,
  compileCastPlan,
  normalizePack,
  renderExecutionPlanJson,
  renderExecutionPlanMarkdown,
  renderExecutionPrompt,
} from "../lib/core.mjs";
import { evaluateExecutionBudget, evaluateProjectedExecutionBudget } from "../lib/budget.mjs";
import { isMainModule, parseJsonFile, readLimitedFile, resolvePackPath, writePrivateText } from "../lib/node-io.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const canonicalRosterPath = path.join(root, "roster", "innercast.roles.json");
const bundledPacksDir = path.join(root, "packs");
const PLATFORM_OPTIONS = new Set([...PLATFORM_IDS, "all"]);
const FORMAT_OPTIONS = new Set(["json", "markdown", "prompt"]);

const usage = `Innercast host-agnostic execution engine

Builds a deterministic execution plan and prompts. It never calls a model.

Usage:
  node scripts/innercast-engine.mjs --decision "..." [options]
  node scripts/innercast-engine.mjs --input examples/sample-decision.json
  node scripts/innercast-engine.mjs --pack innercast-default --decision "..."
  node scripts/innercast-engine.mjs --roster /path/to/roster.json --decision @brief.txt

Options:
  --decision TEXT|@FILE|-       Decision or question to deliberate (required)
  --context TEXT|@FILE|-        Background and evidence shared with every character
  --constraints TEXT|@FILE|-    Hard limits, non-negotiables, or available resources
  --stakes TEXT|@FILE|-         Consequences, reversibility, and cost of being wrong
  --input FILE                  JSON object with decision/context and optional settings
  --pack PACK_ID_OR_PATH        Bundled pack id, pack directory, or pack JSON file
  --roster FILE                 Canonical-roster-shaped JSON file
  --platform all|codex|claude|gemini|generic
                                Select the host target used in execution steps (default: all)
  --format json|markdown|prompt Output format (default: json)
  --out FILE                    Write output to a file instead of stdout
  --help                        Show this help

The output always includes target metadata for Codex, Claude, Gemini, and a
generic prompt fallback. --platform chooses which target an executor should use.
`;

const fail = (message) => {
  throw new Error(message);
};

const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

let stdinCache;
const readTextArgument = (value, label) => {
  if (value === "-") {
    if (stdinCache === undefined) {
      stdinCache = fs.readFileSync(0, "utf8");
      if (Buffer.byteLength(stdinCache, "utf8") > MAX_FILE_BYTES) {
        fail(`stdin exceeds the ${MAX_FILE_BYTES.toLocaleString("en-US")} byte limit.`);
      }
    }
    return stdinCache;
  }
  if (value.startsWith("@")) {
    if (value.length === 1) fail(`${label} @FILE reference is missing a path.`);
    return readLimitedFile(value.slice(1), `${label} file`);
  }
  return value;
};

const parseCli = (argv) => {
  const raw = {};
  const seen = new Set();
  const known = new Set([
    "decision",
    "context",
    "constraints",
    "stakes",
    "input",
    "pack",
    "roster",
    "platform",
    "format",
    "out",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      raw.help = true;
      continue;
    }
    if (!arg.startsWith("--")) fail(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2);
    if (!known.has(key)) fail(`Unknown option: --${key}`);
    if (seen.has(key)) fail(`Option may only be supplied once: --${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for --${key}`);
    seen.add(key);
    raw[key] = value;
    index += 1;
  }
  return raw;
};

const validateCliString = (value, field) => {
  if (typeof value !== "string") fail(`${field} must be a string.`);
  if (value.includes("\0")) fail(`${field} must not contain NUL characters.`);
  if (/\r|\n/.test(value)) fail(`${field} must stay on one line.`);
  if (value.length > MAX_METADATA_CHARS) {
    fail(`${field} exceeds the ${MAX_METADATA_CHARS.toLocaleString("en-US")} character limit.`);
  }
  return value;
};

const parseInput = (raw) => {
  let input = {};
  if (raw.input !== undefined) {
    input = parseJsonFile(raw.input, "Input file");
    if (!isPlainObject(input)) fail("Input file must contain a JSON object.");
    const allowed = new Set(["decision", "context", "constraints", "stakes", "pack", "roster", "platform", "format"]);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) fail(`Input file contains unsupported field: ${key}`);
    }
  }

  const merged = {
    decision: raw.decision !== undefined ? readTextArgument(raw.decision, "Decision") : input.decision,
    context: raw.context !== undefined ? readTextArgument(raw.context, "Context") : (input.context ?? ""),
    constraints: raw.constraints !== undefined ? readTextArgument(raw.constraints, "Constraints") : (input.constraints ?? ""),
    stakes: raw.stakes !== undefined ? readTextArgument(raw.stakes, "Stakes") : (input.stakes ?? ""),
    pack: raw.pack ?? input.pack ?? "",
    roster: raw.roster ?? input.roster ?? "",
    platform: raw.platform ?? input.platform ?? "all",
    format: raw.format ?? input.format ?? "json",
    out: raw.out ?? "",
  };

  for (const field of ["pack", "roster", "platform", "format", "out"]) {
    merged[field] = validateCliString(merged[field], field);
  }
  if (merged.pack && merged.roster) fail("--pack and --roster are mutually exclusive.");
  if (!PLATFORM_OPTIONS.has(merged.platform)) {
    fail("--platform must be all, codex, claude, gemini, or generic.");
  }
  if (!FORMAT_OPTIONS.has(merged.format)) fail("--format must be json, markdown, or prompt.");
  return merged;
};

const readCastDefinition = ({ pack, roster }) => {
  if (pack) {
    const packPath = resolvePackPath(pack, bundledPacksDir);
    const definition = parseJsonFile(packPath, "Pack");
    const normalized = normalizePack(definition, "pack-definition");
    return { definition, sourceLabel: `pack:${normalized.id}@${normalized.version}` };
  }
  if (roster) {
    return { definition: parseJsonFile(roster, "Roster"), sourceLabel: "roster-file" };
  }
  return {
    definition: parseJsonFile(canonicalRosterPath, "Canonical roster"),
    sourceLabel: "canonical-roster",
  };
};

const compileExecutionPlan = ({
  decision,
  context = "",
  constraints = "",
  stakes = "",
  platform = "all",
  castDefinition,
  sourceLabel = "embedded-cast",
  hostRegistry,
} = {}) => {
  const definition = castDefinition === undefined
    ? parseJsonFile(canonicalRosterPath, "Canonical roster")
    : castDefinition;
  return compileCastPlan({
    decision,
    context,
    constraints,
    stakes,
    platform,
    castDefinition: definition,
    sourceLabel: castDefinition === undefined ? "canonical-roster" : sourceLabel,
    hostRegistry,
  });
};

const renderByFormat = (output, format) => {
  if (format === "markdown") return renderExecutionPlanMarkdown(output);
  if (format === "prompt") return renderExecutionPrompt(output);
  return renderExecutionPlanJson(output);
};

const enforceCliBudget = (output) => {
  const budget = evaluateExecutionBudget(output);
  if (budget.violations.length) {
    fail(`Prompt budget exceeded: ${budget.violations.join(" ")} Estimated aggregate input: ${budget.measurement.estimatedAggregateTokens.toLocaleString("en-US")} tokens.`);
  }
  for (const warning of budget.warnings) {
    process.stderr.write(`Innercast budget warning: ${warning}\n`);
  }
};

const writeOutput = (content, outputPath) => {
  if (!outputPath) {
    process.stdout.write(`${content}\n`);
    return;
  }
  writePrivateText(outputPath, `${content}\n`);
};

const main = () => {
  const raw = parseCli(process.argv.slice(2));
  if (raw.help) {
    process.stdout.write(usage);
    return;
  }
  const input = parseInput(raw);
  const cast = readCastDefinition(input);
  const projection = evaluateProjectedExecutionBudget({
    decision: input.decision,
    context: input.context,
    constraints: input.constraints,
    stakes: input.stakes,
    castDefinition: cast.definition,
  });
  if (!projection.ok) {
    fail(`Projected prompt budget exceeded before materialization: ${projection.violations.join(" ")} Estimated aggregate input: ${projection.projection.projectedEstimatedAggregateTokens.toLocaleString("en-US")} tokens.`);
  }
  const output = compileCastPlan({
    decision: input.decision,
    context: input.context,
    constraints: input.constraints,
    stakes: input.stakes,
    platform: input.platform,
    castDefinition: cast.definition,
    sourceLabel: cast.sourceLabel,
  });
  enforceCliBudget(output);
  writeOutput(renderByFormat(output, input.format), input.out);
};

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Innercast engine error: ${error.message}\n\n${usage}`);
    process.exit(1);
  }
}

export {
  compileExecutionPlan,
  renderExecutionPrompt,
  renderExecutionPlanJson,
  renderExecutionPlanMarkdown,
};
