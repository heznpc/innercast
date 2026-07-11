#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderAgentFiles } from "../lib/host-adapters.mjs";
import { isMainModule } from "../lib/node-io.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rosterPath = path.join(root, "roster", "innercast.roles.json");
const hostDirectories = Object.freeze({
  codex: path.join(root, "adapters", "codex", "agents"),
  claude: path.join(root, "adapters", "claude", "agents"),
  gemini: path.join(root, "adapters", "gemini", "agents"),
});

const readRoster = () => JSON.parse(fs.readFileSync(rosterPath, "utf8"));

const buildExpectedAdapterFiles = (roster = readRoster()) => {
  return renderAgentFiles(roster, { hosts: Object.keys(hostDirectories) }).map((file) => ({
    ...file,
    path: path.join(hostDirectories[file.surface], file.name),
  }));
};

const findMismatches = (files) => files.filter((file) => {
  return !fs.existsSync(file.path) || fs.readFileSync(file.path, "utf8") !== file.content;
});

const staleGeneratedFiles = (files) => {
  const expectedBySurface = Object.fromEntries(Object.keys(hostDirectories).map((surface) => [
    surface,
    new Set(files.filter((file) => file.surface === surface).map((file) => file.name)),
  ]));
  const stale = [];
  for (const [surface, directory] of Object.entries(hostDirectories)) {
    if (!fs.existsSync(directory)) continue;
    const generatedExtension = surface === "codex" ? ".toml" : ".md";
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(generatedExtension) && !expectedBySurface[surface].has(entry.name)) {
        stale.push(path.join(directory, entry.name));
      }
    }
  }
  return stale;
};

const synchronizeAdapters = (files) => {
  for (const directory of Object.values(hostDirectories)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  for (const stale of staleGeneratedFiles(files)) fs.rmSync(stale);
  for (const file of files) {
    if (!fs.existsSync(file.path) || fs.readFileSync(file.path, "utf8") !== file.content) {
      fs.writeFileSync(file.path, file.content);
    }
  }
};

const main = () => {
  const checkOnly = process.argv.includes("--check");
  const roster = readRoster();
  const files = buildExpectedAdapterFiles(roster);
  const mismatches = [...findMismatches(files), ...staleGeneratedFiles(files).map((file) => ({ path: file }))];

  if (checkOnly) {
    if (mismatches.length) {
      process.stderr.write(
        `Adapter output is stale or missing:\n${mismatches.map((file) => `- ${path.relative(root, file.path)}`).join("\n")}\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write("Adapter output is current.\n");
    return;
  }

  synchronizeAdapters(files);
  process.stdout.write(
    `Generated ${roster.characters.length} Codex agents, ${roster.characters.length} Claude agents, and ${roster.characters.length} Gemini agents.\n`,
  );
};

if (isMainModule(import.meta.url)) main();

export { buildExpectedAdapterFiles, findMismatches, synchronizeAdapters };
