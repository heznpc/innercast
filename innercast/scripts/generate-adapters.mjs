#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rosterPath = path.join(root, "roster", "innercast.roles.json");
const codexDir = path.join(root, "adapters", "codex", "agents");
const claudeDir = path.join(root, "adapters", "claude", "agents");
const geminiDir = path.join(root, "adapters", "gemini", "agents");

const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
const checkOnly = process.argv.includes("--check");

const quoteToml = (value) => JSON.stringify(value);

const renderInstructions = (character) => {
  const focus = character.focus.map((item) => `- ${item}`).join("\n");
  const rules = character.rules.map((item) => `- ${item}`).join("\n");
  const leadLines = (character.leadLines || []).join("\n");
  const sections = character.returnSections
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
  const returnBlock = [leadLines, sections].filter(Boolean).join("\n\n");
  const namingNotice = roster.namingStatus && roster.namingStatus !== "approved"
    ? `\nNaming status: ${roster.namingStatus}. ${roster.namingNote || "Do not treat this character name as final brand/IP."}\n`
    : "";

  return `You are ${character.displayName}, the ${character.archetype} in an Innercast run.
${namingNotice}

${character.oneLine}

Focus on:
${focus}

Rules:
${rules}

Return:
${returnBlock}`;
};

const renderCodex = (character) => `name = ${quoteToml(character.id)}
description = ${quoteToml(character.description)}
sandbox_mode = "read-only"
model_reasoning_effort = "high"
nickname_candidates = [${quoteToml(character.displayName)}]

developer_instructions = """
${renderInstructions(character)}
"""
`;

const renderClaude = (character) => `---
name: ${character.id}
description: ${character.description}
tools: Read, Glob, Grep
model: inherit
color: ${character.color}
---

${renderInstructions(character)}
`;

const renderGemini = (character) => `---
name: ${character.id}
description: ${character.description}
kind: local
tools:
  - read_file
  - grep_search
model: inherit
temperature: 0.2
max_turns: 8
---

${renderInstructions(character)}
`;

const expectedFiles = () => {
  const files = [];
  for (const character of roster.characters) {
    files.push({
      path: path.join(codexDir, `${character.id}.toml`),
      content: renderCodex(character),
    });
    files.push({
      path: path.join(claudeDir, `${character.id}.md`),
      content: renderClaude(character),
    });
    files.push({
      path: path.join(geminiDir, `${character.id}.md`),
      content: renderGemini(character),
    });
  }
  return files;
};

if (checkOnly) {
  const mismatches = expectedFiles().filter((file) => {
    return !fs.existsSync(file.path) || fs.readFileSync(file.path, "utf8") !== file.content;
  });

  if (mismatches.length) {
    process.stderr.write(
      `Adapter output is stale or missing:\n${mismatches.map((file) => `- ${path.relative(root, file.path)}`).join("\n")}\n`,
    );
    process.exit(1);
  }
  process.stdout.write("Adapter output is current.\n");
  process.exit(0);
}

fs.rmSync(codexDir, { recursive: true, force: true });
fs.rmSync(claudeDir, { recursive: true, force: true });
fs.rmSync(geminiDir, { recursive: true, force: true });
fs.mkdirSync(codexDir, { recursive: true });
fs.mkdirSync(claudeDir, { recursive: true });
fs.mkdirSync(geminiDir, { recursive: true });

for (const file of expectedFiles()) {
  fs.writeFileSync(file.path, file.content);
}

process.stdout.write(
  `Generated ${roster.characters.length} Codex agents, ${roster.characters.length} Claude agents, and ${roster.characters.length} Gemini agents.\n`,
);
