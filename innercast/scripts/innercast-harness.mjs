#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = os.homedir();
const defaultPacksDir = path.join(root, "packs");
const allowedColors = new Set(["red", "orange", "yellow", "green", "blue", "purple", "pink", "cyan"]);
const allowedNamingStatuses = new Set(["prototype", "candidate", "approved"]);

const usage = `Innercast harness

Usage:
  node scripts/innercast-harness.mjs --idea "..." [options]
  node scripts/innercast-harness.mjs --pack noir-review --idea "..." [options]
  node scripts/innercast-harness.mjs --json idea.json [--out handoff.md]

Options:
  --idea TEXT
  --pack PACK_ID_OR_PATH
  --packs-dir DIR
  --target-user TEXT
  --constraints TEXT
  --tempted-build TEXT
  --context TEXT
  --adapter generic|codex|claude|gemini
  --format prompt|markdown
  --json FILE
  --out FILE
  --help
`;

const expandHome = (value) => value.replace(/^~(?=$|\/)/, home);

const readValue = (value) => {
  if (!value) return "";
  if (value.startsWith("@")) {
    return fs.readFileSync(value.slice(1), "utf8").trim();
  }
  return value;
};

const parseArgs = (argv) => {
  const parsed = {
    adapter: "generic",
    format: "prompt",
    idea: "",
    targetUser: "",
    constraints: "",
    temptedBuild: "",
    context: "",
    pack: "",
    packsDir: defaultPacksDir,
    out: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    index += 1;

    if (key === "target-user") parsed.targetUser = readValue(value);
    else if (key === "tempted-build") parsed.temptedBuild = readValue(value);
    else if (key === "json") {
      const data = JSON.parse(fs.readFileSync(value, "utf8"));
      Object.assign(parsed, {
        idea: data.idea || parsed.idea,
        targetUser: data.targetUser || data.target_user || parsed.targetUser,
        constraints: data.constraints || parsed.constraints,
        temptedBuild: data.temptedBuild || data.tempted_build || parsed.temptedBuild,
        context: data.context || parsed.context,
        adapter: data.adapter || parsed.adapter,
        format: data.format || parsed.format,
        pack: data.pack || data.pack_id || parsed.pack,
        packsDir: data.packsDir || data.packs_dir || parsed.packsDir,
      });
    } else if (key === "pack") {
      parsed.pack = readValue(value);
    } else if (key === "packs-dir") {
      parsed.packsDir = path.resolve(expandHome(readValue(value)));
    } else if (key in parsed) {
      parsed[key] = readValue(value);
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }

  return parsed;
};

const isString = (value) => typeof value === "string" && value.trim().length > 0;

const requireString = (object, field, label) => {
  if (!isString(object[field])) throw new Error(`${label} missing string field: ${field}`);
};

const requireStringArray = (object, field, label) => {
  if (!Array.isArray(object[field]) || object[field].length === 0) {
    throw new Error(`${label} missing non-empty array field: ${field}`);
  }
  for (const item of object[field]) {
    if (!isString(item)) throw new Error(`${label} has empty value in ${field}`);
  }
};

const validatePack = (pack, label) => {
  if (pack.schema !== "innercast.pack.v1") {
    throw new Error(`${label} must use schema innercast.pack.v1.`);
  }
  for (const field of ["id", "name", "version", "description"]) {
    requireString(pack, field, label);
  }
  if (pack.namingStatus !== undefined) {
    requireString(pack, "namingStatus", label);
    if (!allowedNamingStatuses.has(pack.namingStatus)) {
      throw new Error(`${label} has invalid namingStatus: ${pack.namingStatus}`);
    }
  }
  if (pack.namingNote !== undefined) requireString(pack, "namingNote", label);
  if (!Array.isArray(pack.characters) || pack.characters.length === 0) {
    throw new Error(`${label} must include at least one character.`);
  }

  const ids = new Set();
  for (const character of pack.characters) {
    const charLabel = `${pack.id}/${character.id || "<unknown>"}`;
    for (const field of ["id", "displayName", "archetype", "description", "oneLine"]) {
      requireString(character, field, charLabel);
    }
    if (ids.has(character.id)) throw new Error(`${pack.id} duplicate character id: ${character.id}`);
    ids.add(character.id);
    if (!allowedColors.has(character.color)) {
      throw new Error(`${charLabel} has unsupported color: ${character.color}`);
    }
    if (character.displayName.length > 32) {
      throw new Error(`${charLabel} displayName must be 32 characters or shorter.`);
    }
    for (const field of ["focus", "rules", "returnSections"]) {
      requireStringArray(character, field, charLabel);
    }
    if (character.leadLines !== undefined) requireStringArray(character, "leadLines", charLabel);
  }
};

const findPackPath = (ref, packsDir) => {
  const candidates = [];
  const rawPath = path.resolve(expandHome(ref));
  if (fs.existsSync(rawPath)) {
    const stat = fs.statSync(rawPath);
    candidates.push(stat.isDirectory() ? path.join(rawPath, "innercast-pack.json") : rawPath);
  }
  candidates.push(path.join(packsDir, ref, "innercast-pack.json"));
  candidates.push(path.join(packsDir, `${ref}.json`));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Pack not found: ${ref}`);
};

const readPack = (ref, packsDir) => {
  const packPath = findPackPath(ref, packsDir);
  const pack = JSON.parse(fs.readFileSync(packPath, "utf8"));
  validatePack(pack, packPath);
  return { pack, packPath };
};

const agentId = (pack, character) => `${pack.id}-${character.id}`;

const adapterLine = (adapter, pack = null) => {
  if (pack) {
    const ids = pack.characters.map((character) => agentId(pack, character));
    const joined = ids.map((id) => `\`${id}\``).join(", ");
    if (adapter === "codex") {
      return `If Codex custom agents ${joined} are available, spawn one subagent per character and wait for all of them. If they are not installed, simulate the same character contracts in separate sections.`;
    }
    if (adapter === "claude") {
      return `If Claude Code subagents ${joined} are available, dispatch one role per agent and require the final character to resolve the signal. If they are not installed, simulate the same character contracts in separate sections.`;
    }
    if (adapter === "gemini") {
      return `If Gemini skills, gems, or extensions can represent the pack, run each character separately. Otherwise simulate each character contract in a separate section.`;
    }
    return "If role-specific agents are available, run one role per character. If not, simulate the pack characters in separate sections without blending responsibilities.";
  }

  if (adapter === "codex") {
    return "If Codex custom agents named Doubt, Spark, Forge, and Verdict are available, spawn one subagent per character and wait for all of them. Their role definitions are generated from roster/innercast.roles.json.";
  }
  if (adapter === "claude") {
    return "If Claude Code subagents named doubt, spark, forge, and verdict are available, dispatch one role per agent and require Verdict to resolve the final signal.";
  }
  if (adapter === "gemini") {
    return "If Gemini skills or extensions are available, run each role as a separate section and keep the Director as the final resolver.";
  }
  return "If role-specific agents are available, run one role per agent. If not, simulate the roles in separate sections without blending responsibilities.";
};

const renderList = (items) => items.map((item) => `- ${item}`).join("\n");

const renderCharacterContract = (pack, character) => {
  const leadLines = (character.leadLines || []).join("\n");
  const sections = character.returnSections.map((item, index) => `${index + 1}. ${item}`).join("\n");
  const returnBlock = [leadLines, sections].filter(Boolean).join("\n\n");
  const namingNotice = pack.namingStatus && pack.namingStatus !== "approved"
    ? `\nNaming status: ${pack.namingStatus}. ${pack.namingNote || "Do not treat this character name as final brand/IP."}\n`
    : "";
  return `${character.displayName} (${agentId(pack, character)}) - ${character.archetype}
${namingNotice}
${character.oneLine}

Focus:
${renderList(character.focus)}

Rules:
${renderList(character.rules)}

Return:
${returnBlock}`;
};

const buildPackOutputStructure = (pack) => {
  const finalCharacter = pack.characters[pack.characters.length - 1];
  const leadLine = (finalCharacter.leadLines || [])[0] || "Signal: Kill / Narrow / Build";
  const earlierLines = pack.characters
    .slice(0, -1)
    .map((character, index) => `${index + 1}. ${character.displayName} Findings`)
    .join("\n");
  const finalIndex = pack.characters.length;
  const body = [
    earlierLines,
    `${finalIndex}. ${finalCharacter.displayName} Decision`,
    `${finalIndex + 1}. Next 3 Actions`,
  ].filter(Boolean).join("\n");

  return `${leadLine}

${body}`;
};

const buildPackPrompt = (input, pack, packPath) => `Run Innercast on the idea below.

Use this character pack:
${pack.name} (${pack.id}@${pack.version})
Source: ${packPath}
Naming: ${pack.namingStatus || "unspecified"}${pack.namingNote ? ` - ${pack.namingNote}` : ""}
${pack.description}

Character contracts:

${pack.characters.map((character) => renderCharacterContract(pack, character)).join("\n\n---\n\n")}

${adapterLine(input.adapter, pack)}

Output exactly this structure:

${buildPackOutputStructure(pack)}

Keep each character's responsibilities separate. The final character in the pack resolves the decision; earlier characters should not collapse into a generic summary.

Idea:
${input.idea || "<paste idea>"}

Target user:
${input.targetUser || "<who would repeatedly use this>"}

Current context:
${input.context || "<repo/product/workflow/resources>"}

Constraints:
${input.constraints || "<time, budget, technical, distribution, trust, or personal constraints>"}

What I am tempted to build:
${input.temptedBuild || "<the current over-scoped version>"}`;

const buildPrompt = (input) => `Run Innercast on the idea below.

Use four cast characters:
- Doubt: challenge assumptions and find reasons not to build
- Spark: find the strongest viable version and repeated-use moment
- Forge: reduce the idea to a 7-day MVP
- Verdict: resolve tension and return a hard Kill / Narrow / Build signal

${adapterLine(input.adapter)}

Output exactly this structure:

Signal: Kill / Narrow / Build

1. Doubt Objections
2. Spark Survival Case
3. Forge 7-Day MVP
4. Evidence Gaps
5. Verdict Decision
6. Next 3 Actions

Idea:
${input.idea || "<paste idea>"}

Target user:
${input.targetUser || "<who would repeatedly use this>"}

Current context:
${input.context || "<repo/product/workflow/resources>"}

Constraints:
${input.constraints || "<time, budget, technical, distribution, trust, or personal constraints>"}

What I am tempted to build:
${input.temptedBuild || "<the current over-scoped version>"}`;

const buildMarkdown = (input, prompt) => `# Innercast Handoff

${["Adapter: " + input.adapter, input.pack ? `Pack: ${input.pack}` : ""].filter(Boolean).join("\n")}

\`\`\`text
${prompt}
\`\`\`
`;

const main = () => {
  const parsed = parseArgs(process.argv.slice(2));
  if (parsed.help) {
    process.stdout.write(usage);
    return;
  }
  if (!parsed.idea) {
    throw new Error("Missing --idea or --json with an idea field.");
  }
  if (!["generic", "codex", "claude", "gemini"].includes(parsed.adapter)) {
    throw new Error("--adapter must be generic, codex, claude, or gemini.");
  }
  if (!["prompt", "markdown"].includes(parsed.format)) {
    throw new Error("--format must be prompt or markdown.");
  }

  let prompt = "";
  if (parsed.pack) {
    const { pack, packPath } = readPack(parsed.pack, parsed.packsDir);
    prompt = buildPackPrompt(parsed, pack, packPath);
  } else {
    prompt = buildPrompt(parsed);
  }

  const output = parsed.format === "markdown" ? buildMarkdown(parsed, prompt) : prompt;
  if (parsed.out) {
    fs.mkdirSync(path.dirname(path.resolve(parsed.out)), { recursive: true });
    fs.writeFileSync(parsed.out, `${output}\n`);
  } else {
    process.stdout.write(`${output}\n`);
  }
};

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n\n${usage}`);
  process.exit(1);
}
