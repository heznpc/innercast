import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { MAX_FILE_BYTES } from "./core.mjs";

const expandHome = (value) => value.replace(/^~(?=$|\/)/, os.homedir());

const readLimitedFile = (filePath, label, { maxBytes = MAX_FILE_BYTES } = {}) => {
  const resolved = path.resolve(expandHome(filePath));
  const stat = fs.statSync(resolved);
  if (!stat.isFile()) throw new Error(`${label} must point to a file: ${filePath}`);
  if (stat.size > maxBytes) {
    throw new Error(`${label} exceeds the ${maxBytes.toLocaleString("en-US")} byte limit.`);
  }
  return fs.readFileSync(resolved, "utf8");
};

const parseJsonFile = (filePath, label, options) => {
  const raw = readLimitedFile(filePath, label, options);
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
};

const resolvePackPath = (reference, packsDir) => {
  if (!reference) throw new Error("Missing pack id or path.");
  const direct = path.resolve(expandHome(reference));
  const candidates = [];
  if (fs.existsSync(direct)) {
    const stat = fs.statSync(direct);
    candidates.push(stat.isDirectory() ? path.join(direct, "innercast-pack.json") : direct);
  }
  candidates.push(path.join(packsDir, reference, "innercast-pack.json"));
  candidates.push(path.join(packsDir, `${reference}.json`));
  const match = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  if (!match) throw new Error(`Pack not found: ${reference}`);
  return match;
};

const writePrivateText = (targetPath, content) => {
  const resolved = path.resolve(expandHome(targetPath));
  if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
    throw new Error(`Output path must point to a file: ${targetPath}`);
  }
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, content, { encoding: "utf8", mode: 0o600 });
  return resolved;
};

const isMainModule = (moduleUrl, argvEntry = process.argv[1]) => {
  if (!argvEntry) return false;
  return fs.realpathSync(argvEntry) === fs.realpathSync(new URL(moduleUrl));
};

export { expandHome, isMainModule, parseJsonFile, readLimitedFile, resolvePackPath, writePrivateText };
