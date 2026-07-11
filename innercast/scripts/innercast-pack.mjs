#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizePack } from "../lib/core.mjs";
import { nativeAgentId, renderAgentFiles } from "../lib/host-adapters.mjs";
import { isMainModule, parseJsonFile, resolvePackPath } from "../lib/node-io.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = os.homedir();
const defaultPacksDir = path.join(root, "packs");

const usage = `Innercast pack manager

Usage:
  node scripts/innercast-pack.mjs list
  node scripts/innercast-pack.mjs init <pack-id> --name "My Pack"
  node scripts/innercast-pack.mjs preview <pack-id-or-path>
  node scripts/innercast-pack.mjs validate <pack-id-or-path>
  node scripts/innercast-pack.mjs doctor <pack-id-or-path>
  node scripts/innercast-pack.mjs diff <pack-a-id-or-path> <pack-b-id-or-path>
  node scripts/innercast-pack.mjs export <pack-id-or-path> --out DIR [--codex] [--claude] [--gemini] [--force]
  node scripts/innercast-pack.mjs install <pack-id-or-path> --all --dry-run
  node scripts/innercast-pack.mjs uninstall <pack-id-or-path> --all --dry-run

Options:
  --packs-dir DIR      Default: ./packs
  --name NAME          Human-facing pack name for init
  --out DIR            Export directory
  --codex              Include Codex agent TOML files
  --claude             Include Claude Code agent Markdown files
  --gemini             Include Gemini CLI agent Markdown files
  --all                Include Codex, Claude, and Gemini surfaces
  --dry-run            Print actions without writing files
  --force              Overwrite or remove changed files
  --codex-dir DIR      Default: ~/.codex/agents
  --claude-dir DIR     Default: ~/.claude/agents
  --gemini-dir DIR     Default: ~/.gemini/agents
  --help
`;

const expandHome = (value) => value.replace(/^~(?=$|\/)/, home);
const riskyTextChecks = [
  { pattern: /\bapi\s*key\b/i, label: "mentions API keys" },
  { pattern: /\bsecret(s)?\b/i, label: "mentions secrets" },
  { pattern: /\bcredential(s)?\b/i, label: "mentions credentials" },
  { pattern: /\brm\s+-rf\b/i, label: "mentions destructive shell removal" },
  { pattern: /\bdelete\s+(user|home|system|root|credential|secret|token)/i, label: "mentions sensitive deletion" },
  { pattern: /\bwrite\s+outside\b/i, label: "mentions writing outside the workspace" },
];

const fail = (message) => {
  throw new Error(message);
};

const parseArgs = (argv) => {
  const command = argv[0];
  const parsed = {
    command,
    ref: undefined,
    otherRef: undefined,
    name: undefined,
    packsDir: defaultPacksDir,
    outDir: undefined,
    codex: false,
    claude: false,
    gemini: false,
    dryRun: false,
    force: false,
    codexDir: path.join(home, ".codex", "agents"),
    claudeDir: path.join(home, ".claude", "agents"),
    geminiDir: path.join(home, ".gemini", "agents"),
  };

  if (!command || command === "--help" || command === "-h" || command === "help") {
    parsed.help = true;
    return parsed;
  }

  let index = 1;
  if (["init", "preview", "validate", "doctor", "export", "install", "uninstall"].includes(command)) {
    parsed.ref = argv[index];
    index += 1;
  } else if (command === "diff") {
    parsed.ref = argv[index];
    parsed.otherRef = argv[index + 1];
    index += 2;
  }

  for (; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--codex") parsed.codex = true;
    else if (arg === "--claude") parsed.claude = true;
    else if (arg === "--gemini") parsed.gemini = true;
    else if (arg === "--all") {
      parsed.codex = true;
      parsed.claude = true;
      parsed.gemini = true;
    } else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--force") parsed.force = true;
    else if (["--packs-dir", "--name", "--out", "--codex-dir", "--claude-dir", "--gemini-dir"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) fail(`Missing value for ${arg}`);
      index += 1;
      if (arg === "--name") parsed.name = value;
      else {
        const resolved = path.resolve(expandHome(value));
        if (arg === "--packs-dir") parsed.packsDir = resolved;
        if (arg === "--out") parsed.outDir = resolved;
        if (arg === "--codex-dir") parsed.codexDir = resolved;
        if (arg === "--claude-dir") parsed.claudeDir = resolved;
        if (arg === "--gemini-dir") parsed.geminiDir = resolved;
      }
    } else {
      fail(`Unknown option: ${arg}`);
    }
  }

  return parsed;
};

const findPackPath = (ref, packsDir) => {
  return resolvePackPath(ref, packsDir);
};

const readPack = (ref, packsDir) => {
  const packPath = findPackPath(ref, packsDir);
  const pack = parseJsonFile(packPath, "Pack");
  validatePack(pack, packPath);
  return { pack, packPath };
};

const validatePack = (pack, label = "<pack>") => {
  if (pack?.protocol?.decisionOwner !== undefined && pack.protocol.decisionOwner !== "host") {
    fail(`${label} pack protocol decisionOwner must be host.`);
  }
  normalizePack(pack, label);
  if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(pack.id)) {
    fail(`${label} has invalid pack id: ${pack.id}`);
  }
  renderAgentFiles(pack, { hosts: ["codex"] });
};

const starterPack = (id, name) => ({
  schema: "innercast.pack.v1",
  id,
  name,
  version: "0.1.0",
  namingStatus: "candidate",
  namingNote: "Role-descriptive starter persona names pending owner approval.",
  author: "Heznpc",
  description: "A custom Innercast character pack.",
  protocol: {
    scope: "current-task",
    dispatch: "parallel",
    decisionOwner: "host",
    contextMode: "shared-decision",
    synthesisLeadLines: ["Decision: <one clear choice>", "Confidence: Low / Medium / High"],
    synthesisSections: ["Character Positions", "Main Tension", "Decision Rationale", "Risks Accepted", "Next Action"],
  },
  characters: [
    {
      id: "doubt",
      displayName: "Doubt",
      archetype: "skeptic",
      color: "purple",
      description: "Use as the cautious inner voice to challenge weak assumptions and the cost of being wrong.",
      oneLine: "Doubt makes the soft spot visible.",
      focus: ["weak assumptions", "missing proof", "irreversible downside"],
      rules: ["You are one inner voice, not the final decision maker.", "Tie each objection to a concrete failure mode."],
      returnSections: ["Position", "Risks", "Evidence", "Recommendation"],
    },
    {
      id: "spark",
      displayName: "Spark",
      archetype: "advocate",
      color: "yellow",
      description: "Use as the possibility-seeking inner voice to find what is meaningful and worth preserving.",
      oneLine: "Spark keeps the useful possibility alive.",
      focus: ["genuine desire", "plausible upside", "smallest worthwhile choice"],
      rules: ["You are one inner voice, not the final decision maker.", "Defend only the most meaningful viable possibility."],
      returnSections: ["Position", "Upside", "What To Preserve", "Recommendation"],
    },
    {
      id: "forge",
      displayName: "Forge",
      archetype: "builder",
      color: "blue",
      description: "Use as the practical inner voice to find feasible paths and a reversible first move.",
      oneLine: "Forge turns inner conflict into something actionable.",
      focus: ["feasible options", "tradeoffs", "reversible first move"],
      rules: ["You are one inner voice, not the final decision maker.", "End with a concrete recommendation."],
      returnSections: ["Position", "Feasible Paths", "Tradeoffs", "Recommendation"],
    },
  ],
});

const agentId = (pack, character) => nativeAgentId(pack, character);

const renderedFiles = (pack, options) => {
  const hosts = [
    options.codex ? "codex" : null,
    options.claude ? "claude" : null,
    options.gemini ? "gemini" : null,
  ].filter(Boolean);
  return renderAgentFiles(pack, { hosts });
};

const writeFileSafe = (target, content, options, actions) => {
  if (fs.existsSync(target)) {
    const current = fs.readFileSync(target, "utf8");
    if (current === content) {
      actions.push(`skip unchanged ${target}`);
      return;
    }
    if (!options.force) {
      if (options.dryRun) {
        actions.push(`would refuse changed ${target} (use --force to overwrite)`);
        return;
      }
      fail(`Refusing to overwrite changed file: ${target}\nRe-run with --force if this is intentional.`);
    }
    actions.push(`overwrite ${target}`);
  } else {
    actions.push(`write ${target}`);
  }
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
};

const removeFileSafe = (target, content, options, actions) => {
  if (!fs.existsSync(target)) {
    actions.push(`skip missing ${target}`);
    return;
  }
  const current = fs.readFileSync(target, "utf8");
  if (current !== content && !options.force) {
    if (options.dryRun) {
      actions.push(`would refuse changed ${target} (use --force to remove)`);
      return;
    }
    fail(`Refusing to remove changed file: ${target}\nRe-run with --force if this is intentional.`);
  }
  actions.push(`remove ${target}`);
  if (!options.dryRun) fs.rmSync(target);
};

const ensureSurfaceSelection = (options, command) => {
  if (!options.codex && !options.claude && !options.gemini) {
    if (command === "export") {
      options.codex = true;
      options.claude = true;
      options.gemini = true;
      return;
    }
    fail(`Choose --codex, --claude, --gemini, or --all for ${command}.`);
  }
};

const listPacks = (options) => {
  if (!fs.existsSync(options.packsDir)) fail(`Packs directory not found: ${options.packsDir}`);
  const rows = [];
  for (const entry of fs.readdirSync(options.packsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packPath = path.join(options.packsDir, entry.name, "innercast-pack.json");
    if (!fs.existsSync(packPath)) continue;
    const pack = parseJsonFile(packPath, "Pack");
    validatePack(pack, packPath);
    rows.push(`${pack.id}@${pack.version} - ${pack.name}: ${pack.description}`);
  }
  if (!rows.length) fail(`No packs found in ${options.packsDir}`);
  process.stdout.write(`${rows.join("\n")}\n`);
};

const initPack = (options) => {
  if (!options.ref) fail("Missing pack id for init.");
  const pack = starterPack(options.ref, options.name || options.ref);
  validatePack(pack, `starter:${options.ref}`);
  const outDir = options.outDir || path.join(options.packsDir, options.ref);
  const actions = [];
  writeFileSafe(path.join(outDir, "innercast-pack.json"), `${JSON.stringify(pack, null, 2)}\n`, options, actions);
  process.stdout.write(`Initialized ${pack.name}:\n${actions.map((action) => `- ${action}`).join("\n")}\n`);
};

const previewPack = (pack) => {
  const lines = [
    `${pack.name} (${pack.id}@${pack.version})`,
    `Naming: ${pack.namingStatus || "unspecified"}${pack.namingNote ? ` - ${pack.namingNote}` : ""}`,
    pack.description,
    "",
    "Characters:",
    ...pack.characters.map((character) => {
      return `- ${character.displayName} -> ${agentId(pack, character)} (${character.archetype})`;
    }),
    "",
    "Dry-run install:",
    `node scripts/innercast-pack.mjs install ${pack.id} --all --dry-run`,
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
};

const allCharacterText = (character) => {
  const parts = [
    character.id,
    character.displayName,
    character.archetype,
    character.description,
    character.oneLine,
    ...(character.focus || []),
    ...(character.rules || []),
    ...(character.leadLines || []),
    ...(character.returnSections || []),
  ];
  return parts.join("\n");
};

const diagnosePack = (pack, packPath) => {
  const warnings = [];
  if (!pack.namingStatus) {
    warnings.push("Pack has no namingStatus; treat character names as unreviewed.");
  } else if (pack.namingStatus !== "approved") {
    warnings.push(`Pack namingStatus is ${pack.namingStatus}; do not treat these names as final brand/IP.`);
  }
  if (pack.namingStatus && pack.namingStatus !== "approved" && !pack.namingNote) {
    warnings.push("Non-approved namingStatus should include namingNote.");
  }
  if (pack.characters.length < 2) warnings.push("Pack has fewer than two characters; it may not behave like a multi-agent cast.");
  if (pack.characters.length > 8) warnings.push("Pack has more than eight characters; cast outputs may become too large for routine use.");
  if (!pack.protocol) warnings.push("Pack has no protocol; runtime will default to current-task parallel voices with the host as decision owner.");
  if (pack.protocol && !pack.protocol.synthesisLeadLines) {
    warnings.push("Pack protocol has no synthesisLeadLines; runtime defaults will supply Decision and Confidence lines.");
  }

  const displayNames = new Map();
  for (const character of pack.characters) {
    const key = character.displayName.toLowerCase();
    if (displayNames.has(key)) {
      warnings.push(`Duplicate displayName: ${character.displayName}`);
    }
    displayNames.set(key, character.id);

    if (character.focus.length > 8) warnings.push(`${character.displayName} has more than eight focus items.`);
    if (character.rules.length > 8) warnings.push(`${character.displayName} has more than eight rules.`);
    if (character.returnSections.length > 8) warnings.push(`${character.displayName} has more than eight return sections.`);

    const text = allCharacterText(character);
    for (const check of riskyTextChecks) {
      if (check.pattern.test(text)) warnings.push(`${character.displayName} ${check.label}.`);
    }
  }

  const lines = [
    `Doctor: ${pack.name} (${pack.id}@${pack.version})`,
    `Path: ${packPath}`,
    `Naming: ${pack.namingStatus || "unspecified"}${pack.namingNote ? ` - ${pack.namingNote}` : ""}`,
    `Characters: ${pack.characters.length}`,
    "Generated agent ids:",
    ...pack.characters.map((character) => `- ${agentId(pack, character)}`),
    "",
    warnings.length ? "Warnings:" : "Warnings: none",
    ...warnings.map((warning) => `- ${warning}`),
  ];
  process.stdout.write(`${lines.join("\n")}\n`);
};

const compareValues = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const diffPacks = (left, right) => {
  const leftById = new Map(left.characters.map((character) => [character.id, character]));
  const rightById = new Map(right.characters.map((character) => [character.id, character]));
  const added = [...rightById.keys()].filter((id) => !leftById.has(id));
  const removed = [...leftById.keys()].filter((id) => !rightById.has(id));
  const comparableFields = ["displayName", "archetype", "color", "description", "oneLine", "focus", "rules", "leadLines", "returnSections"];
  const changed = [];

  for (const id of leftById.keys()) {
    if (!rightById.has(id)) continue;
    const leftCharacter = leftById.get(id);
    const rightCharacter = rightById.get(id);
    const fields = comparableFields.filter((field) => !compareValues(leftCharacter[field], rightCharacter[field]));
    if (fields.length) changed.push(`${id}: ${fields.join(", ")}`);
  }

  const lines = [
    `Diff: ${left.id}@${left.version} -> ${right.id}@${right.version}`,
    compareValues(left.namingStatus, right.namingStatus) && compareValues(left.namingNote, right.namingNote)
      ? "Naming metadata: unchanged"
      : "Naming metadata: changed",
    compareValues(left.protocol, right.protocol) ? "Protocol: unchanged" : "Protocol: changed",
    added.length ? `Added characters: ${added.join(", ")}` : "Added characters: none",
    removed.length ? `Removed characters: ${removed.join(", ")}` : "Removed characters: none",
    changed.length ? "Changed characters:" : "Changed characters: none",
    ...changed.map((item) => `- ${item}`),
  ];
  if (!added.length && !removed.length && !changed.length) lines.push("No character changes.");
  process.stdout.write(`${lines.join("\n")}\n`);
};

const exportPack = (pack, options) => {
  ensureSurfaceSelection(options, "export");
  if (!options.outDir) fail("Missing --out DIR for export.");
  const actions = [];
  writeFileSafe(path.join(options.outDir, "innercast-pack.json"), `${JSON.stringify(pack, null, 2)}\n`, options, actions);
  for (const file of renderedFiles(pack, options)) {
    const surfaceDir = file.surface === "codex"
      ? path.join("codex", "agents")
      : file.surface === "claude"
        ? path.join("claude", "agents")
        : path.join("gemini", "agents");
    writeFileSafe(path.join(options.outDir, surfaceDir, file.name), file.content, options, actions);
  }
  process.stdout.write(`Exported ${pack.name}:\n${actions.map((action) => `- ${action}`).join("\n")}\n`);
};

const installPack = (pack, options, uninstall = false) => {
  ensureSurfaceSelection(options, uninstall ? "uninstall" : "install");
  const actions = [];
  for (const file of renderedFiles(pack, options)) {
    const targetDir = file.surface === "codex"
      ? options.codexDir
      : file.surface === "claude"
        ? options.claudeDir
        : options.geminiDir;
    const target = path.join(targetDir, file.name);
    if (uninstall) removeFileSafe(target, file.content, options, actions);
    else writeFileSafe(target, file.content, options, actions);
  }

  const label = uninstall ? "Uninstalled" : "Installed";
  process.stdout.write(`${options.dryRun ? "Dry run" : label} ${pack.name}:\n${actions.map((action) => `- ${action}`).join("\n")}\n`);
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }

  if (options.command === "list") {
    listPacks(options);
    return;
  }

  if (options.command === "init") {
    initPack(options);
    return;
  }

  if (options.command === "diff") {
    if (!options.ref || !options.otherRef) fail("diff requires two pack ids or paths.");
    const { pack: left } = readPack(options.ref, options.packsDir);
    const { pack: right } = readPack(options.otherRef, options.packsDir);
    diffPacks(left, right);
    return;
  }

  if (!["preview", "validate", "doctor", "export", "install", "uninstall"].includes(options.command)) {
    fail(`Unknown command: ${options.command}`);
  }

  const { pack, packPath } = readPack(options.ref, options.packsDir);
  if (options.command === "preview") previewPack(pack);
  else if (options.command === "validate") process.stdout.write(`Pack valid: ${pack.id} (${packPath})\n`);
  else if (options.command === "doctor") diagnosePack(pack, packPath);
  else if (options.command === "export") exportPack(pack, options);
  else if (options.command === "install") installPack(pack, options, false);
  else if (options.command === "uninstall") installPack(pack, options, true);
};

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage}`);
    process.exit(1);
  }
}

export { findPackPath, readPack, renderedFiles, starterPack, validatePack };
