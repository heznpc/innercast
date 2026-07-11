export const ENGINE_SCHEMA = "innercast.execution-plan.v1";
export const ENGINE_VERSION = "0.2.0";
export const PACK_SCHEMA = "innercast.pack.v1";
export const MAX_FILE_BYTES = 1024 * 1024;
export const MAX_DECISION_CHARS = 50_000;
export const MAX_CONTEXT_CHARS = 250_000;
export const MAX_CHARACTERS = 32;
export const MAX_LIST_ITEMS = 64;
export const MAX_METADATA_CHARS = 4_000;
export const PLATFORM_IDS = Object.freeze(["codex", "claude", "gemini", "generic"]);
export const LIMITS = Object.freeze({
  fileBytes: MAX_FILE_BYTES,
  decisionChars: MAX_DECISION_CHARS,
  contextChars: MAX_CONTEXT_CHARS,
  characters: MAX_CHARACTERS,
  listItems: MAX_LIST_ITEMS,
  metadataChars: MAX_METADATA_CHARS,
});

export const DEFAULT_PROTOCOL = Object.freeze({
  scope: "current-task",
  dispatch: "parallel",
  decisionOwner: "host",
  contextMode: "shared-decision",
  synthesisLeadLines: Object.freeze([
    "Decision: <one clear choice>",
    "Confidence: Low / Medium / High",
  ]),
  synthesisSections: Object.freeze([
    "Character Positions",
    "Main Tension",
    "Decision Rationale",
    "Risks Accepted",
    "Next Action",
  ]),
});

const ALLOWED_COLORS = new Set([
  "red",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "cyan",
]);
const ALLOWED_NAMING_STATUSES = new Set(["prototype", "candidate", "approved"]);
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export const fail = (message) => {
  throw new Error(message);
};

export const isPlainObject = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

export const validateText = (value, label, maxChars, { required = true } = {}) => {
  if (typeof value !== "string") fail(`${label} must be a string.`);
  if (value.includes("\0")) fail(`${label} must not contain NUL characters.`);
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (required && normalized.length === 0) fail(`${label} must not be empty.`);
  if (normalized.length > maxChars) {
    fail(`${label} exceeds the ${maxChars.toLocaleString("en-US")} character limit.`);
  }
  return normalized;
};

const validateMetadata = (value, label, { required = true } = {}) => {
  return validateText(value, label, MAX_METADATA_CHARS, { required });
};

export const validateInlineMetadata = (value, label, { required = true } = {}) => {
  const normalized = validateMetadata(value, label, { required });
  if (/\r|\n/.test(normalized)) fail(`${label} must stay on one line.`);
  return normalized;
};

const validateId = (value, label) => {
  const id = validateInlineMetadata(value, label);
  if (!ID_PATTERN.test(id)) {
    fail(`${label} must use lowercase letters, numbers, and internal hyphens (maximum 64 characters).`);
  }
  return id;
};

const validateStringList = (value, label) => {
  if (!Array.isArray(value) || value.length === 0) fail(`${label} must be a non-empty array.`);
  if (value.length > MAX_LIST_ITEMS) fail(`${label} exceeds ${MAX_LIST_ITEMS} items.`);
  return value.map((item, index) => validateInlineMetadata(item, `${label}[${index}]`));
};

const validateNamingStatus = (value, label) => {
  const status = validateInlineMetadata(value, label);
  if (!ALLOWED_NAMING_STATUSES.has(status)) {
    fail(`${label} must be prototype, candidate, or approved.`);
  }
  return status;
};

const validateCharacters = (characters, label) => {
  if (!Array.isArray(characters) || characters.length === 0) {
    fail(`${label} must contain at least one character.`);
  }
  if (characters.length > MAX_CHARACTERS) {
    fail(`${label} exceeds the ${MAX_CHARACTERS}-character limit.`);
  }

  const ids = new Set();
  return characters.map((rawCharacter, index) => {
    const prefix = `${label}.characters[${index}]`;
    if (!isPlainObject(rawCharacter)) fail(`${prefix} must be an object.`);
    const id = validateId(rawCharacter.id, `${prefix}.id`);
    if (ids.has(id)) fail(`${label} contains duplicate character id: ${id}`);
    ids.add(id);
    const displayName = validateInlineMetadata(rawCharacter.displayName, `${prefix}.displayName`);
    if (displayName.length > 32) fail(`${prefix}.displayName must be 32 characters or shorter.`);
    const color = validateInlineMetadata(rawCharacter.color, `${prefix}.color`);
    if (!ALLOWED_COLORS.has(color)) fail(`${prefix}.color is unsupported: ${color}`);
    return {
      id,
      displayName,
      archetype: validateInlineMetadata(rawCharacter.archetype, `${prefix}.archetype`),
      color,
      description: validateInlineMetadata(rawCharacter.description, `${prefix}.description`),
      oneLine: validateInlineMetadata(rawCharacter.oneLine, `${prefix}.oneLine`),
      focus: validateStringList(rawCharacter.focus, `${prefix}.focus`),
      rules: validateStringList(rawCharacter.rules, `${prefix}.rules`),
      leadLines: rawCharacter.leadLines === undefined
        ? []
        : validateStringList(rawCharacter.leadLines, `${prefix}.leadLines`),
      returnSections: validateStringList(rawCharacter.returnSections, `${prefix}.returnSections`),
    };
  });
};

const cloneDefaultProtocol = () => ({
  ...DEFAULT_PROTOCOL,
  synthesisLeadLines: [...DEFAULT_PROTOCOL.synthesisLeadLines],
  synthesisSections: [...DEFAULT_PROTOCOL.synthesisSections],
});

const validateProtocol = (rawProtocol, label) => {
  if (rawProtocol === undefined) return cloneDefaultProtocol();
  if (!isPlainObject(rawProtocol)) fail(`${label}.protocol must be an object.`);
  const protocol = {
    scope: validateInlineMetadata(rawProtocol.scope, `${label}.protocol.scope`),
    dispatch: validateInlineMetadata(rawProtocol.dispatch, `${label}.protocol.dispatch`),
    decisionOwner: validateInlineMetadata(
      rawProtocol.decisionOwner,
      `${label}.protocol.decisionOwner`,
    ),
    contextMode: validateInlineMetadata(rawProtocol.contextMode, `${label}.protocol.contextMode`),
    synthesisLeadLines: rawProtocol.synthesisLeadLines === undefined
      ? [...DEFAULT_PROTOCOL.synthesisLeadLines]
      : validateStringList(
        rawProtocol.synthesisLeadLines,
        `${label}.protocol.synthesisLeadLines`,
      ),
    synthesisSections: validateStringList(
      rawProtocol.synthesisSections,
      `${label}.protocol.synthesisSections`,
    ),
  };
  if (protocol.scope !== "current-task") {
    fail(`${label}.protocol.scope must be current-task for this engine.`);
  }
  if (protocol.dispatch !== "parallel") {
    fail(`${label}.protocol.dispatch must be parallel for isolated inner-character perspectives.`);
  }
  if (!new Set(["host", "root", "root-agent-person"]).has(protocol.decisionOwner)) {
    fail(`${label}.protocol.decisionOwner must keep final authority with host/root.`);
  }
  if (protocol.contextMode !== "shared-decision") {
    fail(`${label}.protocol.contextMode must be shared-decision.`);
  }
  return { ...protocol, decisionOwner: "host" };
};

export const normalizeRoster = (rawRoster, sourceLabel = "roster-definition") => {
  const label = validateInlineMetadata(sourceLabel, "sourceLabel");
  if (!isPlainObject(rawRoster)) fail(`${label} must contain a JSON object.`);
  const name = validateInlineMetadata(rawRoster.name, `${label}.name`);
  return {
    sourceKind: "roster",
    sourceLabel: label,
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "innercast",
    name,
    version: validateInlineMetadata(rawRoster.version, `${label}.version`),
    description: "A canonical Innercast character roster.",
    concept: rawRoster.concept === undefined
      ? "One host task is the person; recurring inner characters advise and the host decides."
      : validateInlineMetadata(rawRoster.concept, `${label}.concept`),
    namingStatus: rawRoster.namingStatus === undefined
      ? "unspecified"
      : validateNamingStatus(rawRoster.namingStatus, `${label}.namingStatus`),
    namingNote: rawRoster.namingNote === undefined
      ? ""
      : validateInlineMetadata(rawRoster.namingNote, `${label}.namingNote`),
    protocol: validateProtocol(rawRoster.protocol, label),
    characters: validateCharacters(rawRoster.characters, label),
  };
};

export const normalizePack = (rawPack, sourceLabel = "pack-definition") => {
  const label = validateInlineMetadata(sourceLabel, "sourceLabel");
  if (!isPlainObject(rawPack)) fail(`${label} must contain a JSON object.`);
  if (rawPack.schema !== PACK_SCHEMA) fail(`${label}.schema must be ${PACK_SCHEMA}.`);
  return {
    sourceKind: "pack",
    sourceLabel: label,
    id: validateId(rawPack.id, `${label}.id`),
    name: validateInlineMetadata(rawPack.name, `${label}.name`),
    version: validateInlineMetadata(rawPack.version, `${label}.version`),
    description: validateInlineMetadata(rawPack.description, `${label}.description`),
    concept: rawPack.concept === undefined
      ? "One host task is the person; recurring inner characters advise and the host decides."
      : validateInlineMetadata(rawPack.concept, `${label}.concept`),
    namingStatus: rawPack.namingStatus === undefined
      ? "unspecified"
      : validateNamingStatus(rawPack.namingStatus, `${label}.namingStatus`),
    namingNote: rawPack.namingNote === undefined
      ? ""
      : validateInlineMetadata(rawPack.namingNote, `${label}.namingNote`),
    protocol: validateProtocol(rawPack.protocol, label),
    characters: validateCharacters(rawPack.characters, label),
  };
};

const stableSort = (value) => {
  if (Array.isArray(value)) return value.map(stableSort);
  if (!isPlainObject(value)) return value;
  const sorted = {};
  for (const key of Object.keys(value).sort()) sorted[key] = stableSort(value[key]);
  return sorted;
};

export const stableSerialize = (value) => JSON.stringify(stableSort(value));

const SHA256_CONSTANTS = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotateRight = (value, places) => {
  return (value >>> places) | (value << (32 - places));
};

const sha256 = (value) => {
  const bytes = new TextEncoder().encode(value);
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  const bitLength = bytes.length * 8;
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  const hash = new Uint32Array([
    0x6a09e667,
    0xbb67ae85,
    0x3c6ef372,
    0xa54ff53a,
    0x510e527f,
    0x9b05688c,
    0x1f83d9ab,
    0x5be0cd19,
  ]);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const word15 = words[index - 15];
      const word2 = words[index - 2];
      const sigma0 = rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const sigma1 = rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sum1 + choice + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }

  return [...hash].map((part) => part.toString(16).padStart(8, "0")).join("");
};

const castDefinitionForHash = (cast) => ({
  id: cast.id,
  name: cast.name,
  version: cast.version,
  description: cast.description,
  concept: cast.concept,
  namingStatus: cast.namingStatus,
  namingNote: cast.namingNote,
  protocol: cast.protocol,
  characters: cast.characters,
});

export const normalizeDefinitionSha256 = (definitionSha256, cast) => {
  if (definitionSha256 === undefined) return sha256(stableSerialize(castDefinitionForHash(cast)));
  const normalized = validateInlineMetadata(definitionSha256, "definitionSha256");
  if (!/^[a-f0-9]{64}$/.test(normalized)) {
    fail("definitionSha256 must be a lowercase 64-character SHA-256 digest.");
  }
  return normalized;
};
