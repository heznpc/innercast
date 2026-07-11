#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isMainModule } from "../lib/node-io.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = os.homedir();
const INSTALL_MANIFEST_SCHEMA = "innercast.install-manifest.v1";

const usage = `Innercast installer

Usage:
  node scripts/install-adapters.mjs --codex
  node scripts/install-adapters.mjs --claude
  node scripts/install-adapters.mjs --gemini
  node scripts/install-adapters.mjs --skill
  node scripts/install-adapters.mjs --all

Options:
  --codex              Install Codex agent TOML files
  --claude             Install Claude Code agent Markdown files
  --gemini             Install Gemini CLI agent Markdown files
  --skill              Install the Codex skill folder
  --all                Install Codex, Claude, Gemini agents, and the Codex skill
  --dry-run            Print actions without writing files
  --force              Overwrite changed files
  --uninstall          Remove matching installed files instead of installing
  --codex-dir DIR      Default: ~/.codex/agents
  --claude-dir DIR     Default: ~/.claude/agents
  --gemini-dir DIR     Default: ~/.gemini/agents
  --skill-dir DIR      Default: ~/.codex/skills/innercast
  --help
`;

const expandHome = (value) => value.replace(/^~(?=$|\/)/, home);

const parseArgs = (argv) => {
  const parsed = {
    codex: false,
    claude: false,
    gemini: false,
    skill: false,
    dryRun: false,
    force: false,
    uninstall: false,
    codexDir: path.join(home, ".codex", "agents"),
    claudeDir: path.join(home, ".claude", "agents"),
    geminiDir: path.join(home, ".gemini", "agents"),
    skillDir: path.join(home, ".codex", "skills", "innercast"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--codex") parsed.codex = true;
    else if (arg === "--claude") parsed.claude = true;
    else if (arg === "--gemini") parsed.gemini = true;
    else if (arg === "--skill") parsed.skill = true;
    else if (arg === "--all") {
      parsed.codex = true;
      parsed.claude = true;
      parsed.gemini = true;
      parsed.skill = true;
    } else if (arg === "--dry-run") parsed.dryRun = true;
    else if (arg === "--force") parsed.force = true;
    else if (arg === "--uninstall") parsed.uninstall = true;
    else if (arg === "--codex-dir" || arg === "--claude-dir" || arg === "--gemini-dir" || arg === "--skill-dir") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      if (arg === "--codex-dir") parsed.codexDir = path.resolve(expandHome(value));
      if (arg === "--claude-dir") parsed.claudeDir = path.resolve(expandHome(value));
      if (arg === "--gemini-dir") parsed.geminiDir = path.resolve(expandHome(value));
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

const permissionMode = (file) => fs.statSync(file).mode & 0o777;

const sha256File = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");

const copyFileSafe = (source, target, options, actions, previousSource = null, previousHash = null) => {
  if (sameFile(source, target)) {
    const sourceMode = permissionMode(source);
    const targetMode = permissionMode(target);
    if (sourceMode !== targetMode) {
      actions.push(`sync mode ${target} (${targetMode.toString(8)} -> ${sourceMode.toString(8)})`);
      if (!options.dryRun) fs.chmodSync(target, sourceMode);
    } else {
      actions.push(`skip unchanged ${target}`);
    }
    return;
  }
  const managedBySource = previousSource && fs.existsSync(previousSource) && sameFile(previousSource, target);
  const managedByManifest = previousHash && fs.existsSync(target) && sha256File(target) === previousHash;
  const managedUpgrade = managedBySource || managedByManifest;
  if (fs.existsSync(target) && !options.force && !managedUpgrade) {
    if (options.dryRun) {
      actions.push(`would refuse changed ${target} (use --force to overwrite)`);
      return;
    }
    throw new Error(`Refusing to overwrite changed file: ${target}\nRe-run with --force if this is intentional.`);
  }
  actions.push(`${fs.existsSync(target) ? managedUpgrade ? "upgrade managed" : "overwrite" : "write"} ${target}`);
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    fs.chmodSync(target, permissionMode(source));
  }
};

const manifestPathFor = (skillDir) => {
  const name = path.basename(path.resolve(skillDir));
  return path.join(path.dirname(path.resolve(skillDir)), `.${name}-innercast-install.json`);
};

const safeRelativePath = (relative) => {
  return typeof relative === "string" &&
    relative.length > 0 &&
    !path.isAbsolute(relative) &&
    !relative.split("/").includes("..") &&
    path.normalize(relative) === relative.split("/").join(path.sep);
};

const loadInstallManifest = (manifestPath) => {
  if (!fs.existsSync(manifestPath)) return null;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid Innercast install manifest: ${manifestPath}\n${error.message}`);
  }
  if (manifest?.schema !== INSTALL_MANIFEST_SCHEMA || !manifest.files || typeof manifest.files !== "object" || Array.isArray(manifest.files)) {
    throw new Error(`Invalid Innercast install manifest: ${manifestPath}`);
  }
  for (const [relative, hash] of Object.entries(manifest.files)) {
    if (!safeRelativePath(relative) || !/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error(`Invalid Innercast install manifest entry: ${relative}`);
    }
  }
  return manifest;
};

const collectFiles = (sourceDir, baseDir = sourceDir) => {
  const files = [];
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.name === ".DS_Store") continue;
    const source = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(source, baseDir));
    else if (entry.isFile()) {
      const relative = path.relative(baseDir, source).split(path.sep).join("/");
      files.push({ relative, source });
    }
  }
  return files;
};

const removeManagedFile = (target, previousHash, options, actions) => {
  if (!fs.existsSync(target)) {
    actions.push(`skip missing ${target}`);
    return;
  }
  const managed = sha256File(target) === previousHash;
  if (!managed && !options.force) {
    if (options.dryRun) {
      actions.push(`would refuse changed ${target} (use --force to remove)`);
      return;
    }
    throw new Error(`Refusing to remove changed file: ${target}\nRe-run with --force if this is intentional.`);
  }
  actions.push(`remove ${target}`);
  if (!options.dryRun) fs.rmSync(target);
};

const writeInstallManifest = (manifestPath, files, options, actions) => {
  const manifest = {
    schema: INSTALL_MANIFEST_SCHEMA,
    files: Object.fromEntries(files.map(({ relative, source }) => [relative, sha256File(source)])),
  };
  const content = `${JSON.stringify(manifest, null, 2)}\n`;
  if (fs.existsSync(manifestPath) && fs.readFileSync(manifestPath, "utf8") === content) {
    actions.push(`skip unchanged install manifest ${manifestPath}`);
    return;
  }
  actions.push(`${fs.existsSync(manifestPath) ? "update" : "write"} install manifest ${manifestPath}`);
  if (!options.dryRun) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    const temporary = `${manifestPath}.tmp-${process.pid}`;
    fs.writeFileSync(temporary, content);
    fs.renameSync(temporary, manifestPath);
  }
};

const removeFileSafe = (source, target, options, actions) => {
  if (!fs.existsSync(target)) {
    actions.push(`skip missing ${target}`);
    return true;
  }
  if (!sameFile(source, target) && !options.force) {
    if (options.dryRun) {
      actions.push(`would refuse changed ${target} (use --force to remove)`);
      return false;
    }
    throw new Error(`Refusing to remove changed file: ${target}\nRe-run with --force if this is intentional.`);
  }
  actions.push(`remove ${target}`);
  if (!options.dryRun) fs.rmSync(target);
  return true;
};

const copySkillSafe = (sourceDir, targetDir, options, actions) => {
  const sourceRoot = fs.realpathSync(sourceDir);
  const targetRoot = fs.existsSync(targetDir) ? fs.realpathSync(targetDir) : targetDir;
  if (sourceRoot === targetRoot) {
    actions.push(`skip self-install ${targetDir}`);
    return;
  }

  const files = collectFiles(sourceDir);
  const currentNames = new Set(files.map(({ relative }) => relative));
  const manifestPath = manifestPathFor(targetDir);
  const previousManifest = loadInstallManifest(manifestPath);

  if (options.uninstall) {
    for (const { relative, source } of files) {
      const target = path.join(targetDir, relative);
      const previousHash = previousManifest?.files[relative];
      if (previousHash) removeManagedFile(target, previousHash, options, actions);
      else removeFileSafe(source, target, options, actions);
    }
    if (fs.existsSync(manifestPath)) {
      actions.push(`remove install manifest ${manifestPath}`);
      if (!options.dryRun) fs.rmSync(manifestPath);
    }
    return;
  }

  if (previousManifest) {
    for (const [relative, previousHash] of Object.entries(previousManifest.files)) {
      if (currentNames.has(relative)) continue;
      removeManagedFile(path.join(targetDir, relative), previousHash, options, actions);
    }
  }

  for (const { relative, source } of files) {
    const target = path.join(targetDir, relative);
    copyFileSafe(source, target, options, actions, null, previousManifest?.files[relative]);
  }
  writeInstallManifest(manifestPath, files, options, actions);
};

const copyAdapterFiles = (sourceDir, targetDir, options, actions, previousSourceDir = null) => {
  const currentNames = new Set(
    fs.readdirSync(sourceDir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name),
  );

  // Reconcile files from the previously installed skill before copying the
  // new skill over it. A stale adapter is removed only when the installed
  // target still byte-matches the previously generated source; user-modified
  // files remain protected unless --force is explicit.
  if (previousSourceDir && fs.existsSync(previousSourceDir)) {
    for (const entry of fs.readdirSync(previousSourceDir, { withFileTypes: true })) {
      if (!entry.isFile() || currentNames.has(entry.name)) continue;
      const previousSource = path.join(previousSourceDir, entry.name);
      const target = path.join(targetDir, entry.name);
      const safeToPrune = removeFileSafe(previousSource, target, options, actions);
      if (safeToPrune && options.skill && previousSource.startsWith(`${path.resolve(options.skillDir)}${path.sep}`)) {
        actions.push(`remove stale skill adapter ${previousSource}`);
        if (!options.dryRun) fs.rmSync(previousSource);
      }
    }
  }

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = path.join(sourceDir, entry.name);
    const target = path.join(targetDir, entry.name);
    if (options.uninstall) removeFileSafe(source, target, options, actions);
    else {
      const previousSource = previousSourceDir ? path.join(previousSourceDir, entry.name) : null;
      copyFileSafe(source, target, options, actions, previousSource);
    }
  }
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }
  if (!options.codex && !options.claude && !options.gemini && !options.skill) {
    throw new Error("Choose --codex, --claude, --gemini, --skill, or --all.");
  }

  const actions = [];
  const previousAdaptersRoot = path.join(options.skillDir, "adapters");
  if (options.codex) {
    copyAdapterFiles(
      path.join(root, "adapters", "codex", "agents"),
      options.codexDir,
      options,
      actions,
      path.join(previousAdaptersRoot, "codex", "agents"),
    );
  }
  if (options.claude) {
    copyAdapterFiles(
      path.join(root, "adapters", "claude", "agents"),
      options.claudeDir,
      options,
      actions,
      path.join(previousAdaptersRoot, "claude", "agents"),
    );
  }
  if (options.gemini) {
    copyAdapterFiles(
      path.join(root, "adapters", "gemini", "agents"),
      options.geminiDir,
      options,
      actions,
      path.join(previousAdaptersRoot, "gemini", "agents"),
    );
  }
  if (options.skill) {
    copySkillSafe(root, options.skillDir, options, actions);
  }

  const verb = options.uninstall ? "Uninstalled" : "Installed";
  process.stdout.write(`${options.dryRun ? "Dry run" : verb} Innercast:\n${actions.map((action) => `- ${action}`).join("\n")}\n`);
};

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage}`);
    process.exit(1);
  }
}

export { collectFiles, copyAdapterFiles, copySkillSafe, manifestPathFor, parseArgs };
