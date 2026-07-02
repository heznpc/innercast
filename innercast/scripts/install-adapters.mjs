#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = os.homedir();

const usage = `Innercast installer

Usage:
  node scripts/install-adapters.mjs --codex
  node scripts/install-adapters.mjs --claude
  node scripts/install-adapters.mjs --skill
  node scripts/install-adapters.mjs --all

Options:
  --codex              Install Codex agent TOML files
  --claude             Install Claude Code agent Markdown files
  --skill              Install the Codex skill folder
  --all                Install Codex agents, Claude agents, and the Codex skill
  --dry-run            Print actions without writing files
  --force              Overwrite changed files
  --uninstall          Remove matching installed files instead of installing
  --codex-dir DIR      Default: ~/.codex/agents
  --claude-dir DIR     Default: ~/.claude/agents
  --skill-dir DIR      Default: ~/.codex/skills/innercast
  --help
`;

const expandHome = (value) => value.replace(/^~(?=$|\/)/, home);

const parseArgs = (argv) => {
  const parsed = {
    codex: false,
    claude: false,
    skill: false,
    dryRun: false,
    force: false,
    uninstall: false,
    codexDir: path.join(home, ".codex", "agents"),
    claudeDir: path.join(home, ".claude", "agents"),
    skillDir: path.join(home, ".codex", "skills", "innercast"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--codex") parsed.codex = true;
    else if (arg === "--claude") parsed.claude = true;
    else if (arg === "--skill") parsed.skill = true;
    else if (arg === "--all") {
      parsed.codex = true;
      parsed.claude = true;
      parsed.skill = true;
    } else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--uninstall") parsed.uninstall = true;
    else if (arg === "--codex-dir" || arg === "--claude-dir" || arg === "--skill-dir") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      if (arg === "--codex-dir") parsed.codexDir = path.resolve(expandHome(value));
      if (arg === "--claude-dir") parsed.claudeDir = path.resolve(expandHome(value));
      if (arg === "--skill-dir") parsed.skillDir = path.resolve(expandHome(value));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return parsed;
};

const sameFile = (source, target) => {
  if (!fs.existsSync(target)) return false;
  return fs.readFileSync(source).equals(fs.readFileSync(target));
};

const copyFileSafe = (source, target, options, actions) => {
  if (sameFile(source, target)) {
    actions.push(`skip unchanged ${target}`);
    return;
  }
  if (fs.existsSync(target) && !options.force) {
    throw new Error(`Refusing to overwrite changed file: ${target}\nRe-run with --force if this is intentional.`);
  }
  actions.push(`${fs.existsSync(target) ? "overwrite" : "write"} ${target}`);
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
};

const removeFileSafe = (source, target, options, actions) => {
  if (!fs.existsSync(target)) {
    actions.push(`skip missing ${target}`);
    return;
  }
  if (!sameFile(source, target) && !options.force) {
    throw new Error(`Refusing to remove changed file: ${target}\nRe-run with --force if this is intentional.`);
  }
  actions.push(`remove ${target}`);
  if (!options.dryRun) fs.rmSync(target);
};

const copyDirSafe = (sourceDir, targetDir, options, actions) => {
  const sourceRoot = fs.realpathSync(sourceDir);
  const targetRoot = fs.existsSync(targetDir) ? fs.realpathSync(targetDir) : targetDir;
  if (sourceRoot === targetRoot) {
    actions.push(`skip self-install ${targetDir}`);
    return;
  }

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (entry.isDirectory()) copyDirSafe(source, target, options, actions);
    else if (entry.isFile()) {
      if (options.uninstall) removeFileSafe(source, target, options, actions);
      else copyFileSafe(source, target, options, actions);
    }
  }
};

const copyAdapterFiles = (sourceDir, targetDir, options, actions) => {
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (options.uninstall) removeFileSafe(source, target, options, actions);
    else copyFileSafe(source, target, options, actions);
  }
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  if (!options.codex && !options.claude && !options.skill) {
    throw new Error("Choose --codex, --claude, --skill, or --all.");
  }

  const actions = [];
  if (options.codex) {
    copyAdapterFiles(path.join(root, "adapters", "codex", "agents"), options.codexDir, options, actions);
  }
  if (options.claude) {
    copyAdapterFiles(path.join(root, "adapters", "claude", "agents"), options.claudeDir, options, actions);
  }
  if (options.skill) {
    copyDirSafe(root, options.skillDir, options, actions);
  }

  const verb = options.uninstall ? "Uninstalled" : "Installed";
  process.stdout.write(`${options.dryRun ? "Dry run" : verb} Innercast:\n${actions.map((action) => `- ${action}`).join("\n")}\n`);
};

try {
  main();
} catch (error) {
  process.stderr.write(`${error.message}\n\n${usage}`);
  process.exit(1);
}
