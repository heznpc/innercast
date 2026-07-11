#!/usr/bin/env node

// Compatibility surface for the original Innercast prompt harness. New calls
// should prefer innercast-engine.mjs; legacy idea-review flags are translated
// into the same current-task decision protocol rather than a cross-app handoff.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { expandHome, isMainModule, parseJsonFile, readLimitedFile, resolvePackPath, writePrivateText } from "../lib/node-io.mjs";
import {
  compileExecutionPlan,
  renderExecutionPlanJson,
  renderExecutionPlanMarkdown,
  renderExecutionPrompt,
} from "./innercast-engine.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPacksDir = path.join(root, "packs");

const usage = `Innercast same-task harness

Usage:
  node scripts/innercast-harness.mjs --decision "..." [options]
  node scripts/innercast-harness.mjs --idea "..." [legacy options]
  node scripts/innercast-harness.mjs --json examples/sample-decision.json

Options:
  --decision TEXT|@FILE
  --idea TEXT|@FILE              Legacy alias for --decision
  --context TEXT|@FILE
  --constraints TEXT|@FILE
  --stakes TEXT|@FILE
  --target-user TEXT|@FILE       Legacy context field
  --tempted-build TEXT|@FILE     Legacy stakes field
  --pack PACK_ID_OR_PATH
  --packs-dir DIR
  --adapter codex|claude|gemini|generic|all
  --platform codex|claude|gemini|generic|all
  --format prompt|markdown|json  Default: prompt
  --json FILE
  --out FILE
  --help
`;

const fail = (message) => {
  throw new Error(message);
};

const readValue = (value, label) => {
  if (typeof value !== "string") return "";
  if (value.startsWith("@")) {
    if (value.length === 1) fail(`${label} @FILE reference is missing a path.`);
    return readLimitedFile(value.slice(1), `${label} file`).trim();
  }
  return value.trim();
};

const parseArgs = (argv) => {
  const parsed = {
    decision: "",
    idea: "",
    context: "",
    constraints: "",
    stakes: "",
    targetUser: "",
    temptedBuild: "",
    pack: "",
    packsDir: defaultPacksDir,
    platform: "generic",
    format: "prompt",
    out: "",
  };
  const seen = new Set();
  const valueKeys = new Set([
    "decision", "idea", "context", "constraints", "stakes", "target-user",
    "tempted-build", "pack", "packs-dir", "adapter", "platform", "format",
    "json", "out",
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith("--")) fail(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (!valueKeys.has(key)) fail(`Unknown option: --${key}`);
    if (seen.has(key)) fail(`Option may only be supplied once: --${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`Missing value for --${key}`);
    seen.add(key);
    index += 1;

    if (key === "json") {
      const data = parseJsonFile(value, "JSON input");
      if (!data || typeof data !== "object" || Array.isArray(data)) fail("JSON input must be an object.");
      Object.assign(parsed, {
        decision: data.decision || parsed.decision,
        idea: data.idea || parsed.idea,
        context: data.context || parsed.context,
        constraints: data.constraints || parsed.constraints,
        stakes: data.stakes || parsed.stakes,
        targetUser: data.targetUser || data.target_user || parsed.targetUser,
        temptedBuild: data.temptedBuild || data.tempted_build || parsed.temptedBuild,
        pack: data.pack || data.pack_id || parsed.pack,
        platform: data.platform || data.adapter || parsed.platform,
        format: data.format || parsed.format,
      });
    } else if (key === "target-user") parsed.targetUser = readValue(value, "Target user");
    else if (key === "tempted-build") parsed.temptedBuild = readValue(value, "Tempted build");
    else if (key === "packs-dir") parsed.packsDir = path.resolve(expandHome(value));
    else if (key === "adapter" || key === "platform") {
      if ((seen.has("adapter") && seen.has("platform")) || (parsed.platform !== "generic" && parsed.platform !== value)) {
        fail("Use either --adapter or --platform, not both.");
      }
      parsed.platform = value;
    } else {
      parsed[key] = ["pack", "format", "out"].includes(key) ? value : readValue(value, key);
    }
  }
  return parsed;
};

const resolvePack = (reference, packsDir) => {
  if (!reference) return undefined;
  return parseJsonFile(resolvePackPath(reference, packsDir), "Pack");
};

const joinContext = (context, targetUser) => {
  return [
    context,
    targetUser ? `Legacy target-user context: ${targetUser}` : "",
  ].filter(Boolean).join("\n\n");
};

const main = () => {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(usage);
    return;
  }
  const decision = parsed.decision || parsed.idea;
  if (!decision) fail("Missing --decision, --idea, or --json decision field.");
  const stakes = [
    parsed.stakes,
    parsed.temptedBuild ? `Legacy tempted-build risk: ${parsed.temptedBuild}` : "",
  ].filter(Boolean).join("\n\n");
  const castDefinition = resolvePack(parsed.pack, parsed.packsDir);
  const output = compileExecutionPlan({
    decision,
    context: joinContext(parsed.context, parsed.targetUser),
    constraints: parsed.constraints,
    stakes,
    platform: parsed.platform,
    castDefinition,
    sourceLabel: parsed.pack ? `pack:${parsed.pack}` : "canonical-roster",
  });
  const rendered = parsed.format === "json"
    ? renderExecutionPlanJson(output)
    : parsed.format === "markdown"
      ? renderExecutionPlanMarkdown(output)
      : parsed.format === "prompt"
        ? renderExecutionPrompt(output)
        : fail("--format must be prompt, markdown, or json.");

  if (parsed.out) {
    writePrivateText(parsed.out, `${rendered}\n`);
  } else {
    process.stdout.write(`${rendered}\n`);
  }
};

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage}`);
    process.exit(1);
  }
}

export { joinContext, parseArgs, resolvePack };
