#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isMainModule } from "../lib/node-io.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.dirname(root);

const usage = `Innercast kit packager

Usage:
  node scripts/package-kit.mjs [--out FILE]

Options:
  --out FILE       Default: ../public/innercast-kit.zip
  --help
`;

const parseArgs = (argv) => {
  const parsed = {
    out: path.join(repoRoot, "public", "innercast-kit.zip"),
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("Missing value for --out");
      index += 1;
      parsed.out = path.resolve(value);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  return parsed;
};

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
  return result.stdout;
};

const main = () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage);
    return;
  }

  run(process.execPath, [path.join(root, "scripts", "generate-adapters.mjs"), "--check"]);

  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.rmSync(options.out, { force: true });

  run("zip", [
    "-X",
    "-q",
    "-r",
    options.out,
    ".",
    "-x",
    "*.DS_Store",
  ]);

  const size = fs.statSync(options.out).size;
  process.stdout.write(`Packaged Innercast kit: ${options.out} (${size} bytes)\n`);
};

if (isMainModule(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${usage}`);
    process.exit(1);
  }
}

export { parseArgs, run };
