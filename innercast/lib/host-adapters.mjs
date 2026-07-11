const DEFAULT_PROTOCOL = Object.freeze({
  scope: "current-task",
  dispatch: "parallel",
  decisionOwner: "host",
  contextMode: "shared-decision",
});

export const HOST_IDS = Object.freeze(["codex", "claude", "gemini", "generic"]);

const quoteToml = (value) => JSON.stringify(value);
const quoteYaml = (value) => JSON.stringify(value);

const assertTemplateSafe = (cast, character) => {
  const values = [
    cast.name,
    cast.namingNote,
    character.displayName,
    character.archetype,
    character.description,
    character.oneLine,
    ...(character.focus || []),
    ...(character.rules || []),
    ...(character.leadLines || []),
    ...(character.returnSections || []),
  ];
  if (values.some((value) => typeof value === "string" && value.includes('"""'))) {
    throw new Error(`Character ${character.id} contains an unsupported TOML triple-quote delimiter.`);
  }
};

const isPack = (cast) => {
  return cast.sourceKind === "pack" || cast.schema === "innercast.pack.v1";
};

const agentDescription = (cast, character) => {
  return isPack(cast)
    ? `[${cast.name}] ${character.description}`
    : character.description;
};

export const nativeAgentId = (cast, character) => {
  return isPack(cast) ? `${cast.id}-${character.id}` : character.id;
};

export const renderCharacterInstructions = (cast, character) => {
  assertTemplateSafe(cast, character);
  const focus = character.focus.map((item) => `- ${item}`).join("\n");
  const rules = character.rules.map((item) => `- ${item}`).join("\n");
  const leadLines = (character.leadLines || []).join("\n");
  const sections = character.returnSections
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");
  const returnBlock = [leadLines, sections].filter(Boolean).join("\n\n");
  const namingNotice = cast.namingStatus && cast.namingStatus !== "approved"
    ? `\nNaming status: ${cast.namingStatus}. ${cast.namingNote || "Do not treat this character name as final brand/IP."}\n`
    : "";
  const protocol = cast.protocol || DEFAULT_PROTOCOL;

  if (isPack(cast)) {
    return `You are ${character.displayName}, the ${character.archetype} in the ${cast.name} Innercast pack.

Installed agent id: ${nativeAgentId(cast, character)}
${namingNotice}

${character.oneLine}

Innercast runtime contract:
- One host task is the person; you are one recurring inner voice inside that same task.
- Examine the shared decision packet independently from your own perspective.
- Do not claim to have seen another character's output unless the host includes it.
- Return your position to the host. The host owns the final decision and user-facing answer.
- Scope: ${protocol.scope}; dispatch: ${protocol.dispatch}; context: ${protocol.contextMode}; decision owner: ${protocol.decisionOwner}.

Focus on:
${focus}

Rules:
${rules}

Return:
${returnBlock}`;
  }

  return `You are ${character.displayName}, the ${character.archetype} inner character in an Innercast run.
${namingNotice}

${character.oneLine}

Innercast runtime contract:
- One host task is the person; you are one recurring inner voice inside that same task.
- Examine the shared decision packet from your own perspective.
- Work independently and do not claim to have seen another character's output unless the host includes it.
- Return your position to the host. The host owns the final decision and user-facing answer.
- Scope: ${protocol.scope}; dispatch: ${protocol.dispatch}; context: ${protocol.contextMode}; decision owner: ${protocol.decisionOwner}.

Focus on:
${focus}

Rules:
${rules}

Return:
${returnBlock}`;
};

const renderCodexAgentFile = (cast, character) => {
  const id = nativeAgentId(cast, character);
  return {
    surface: "codex",
    name: `${id}.toml`,
    content: `name = ${quoteToml(id)}
description = ${quoteToml(agentDescription(cast, character))}
sandbox_mode = "read-only"
model_reasoning_effort = "high"
nickname_candidates = [${quoteToml(character.displayName)}]

developer_instructions = """
${renderCharacterInstructions(cast, character)}
"""
`,
  };
};

const renderClaudeAgentFile = (cast, character) => {
  const id = nativeAgentId(cast, character);
  const description = isPack(cast)
    ? quoteYaml(agentDescription(cast, character))
    : agentDescription(cast, character);
  return {
    surface: "claude",
    name: `${id}.md`,
    content: `---
name: ${id}
description: ${description}
tools: Read, Glob, Grep
model: inherit
color: ${character.color}
---

${renderCharacterInstructions(cast, character)}
`,
  };
};

const renderGeminiAgentFile = (cast, character) => {
  const id = nativeAgentId(cast, character);
  const description = isPack(cast)
    ? quoteYaml(agentDescription(cast, character))
    : agentDescription(cast, character);
  return {
    surface: "gemini",
    name: `${id}.md`,
    content: `---
name: ${id}
description: ${description}
kind: local
tools:
  - read_file
  - grep_search
model: inherit
temperature: 0.2
max_turns: 8
---

${renderCharacterInstructions(cast, character)}
`,
  };
};

const codexAdapter = Object.freeze({
  id: "codex",
  native: true,
  capabilities: Object.freeze({
    namedAgents: true,
    agentDefinitions: true,
    isolatedContext: true,
    parallelDispatch: "host-managed",
    publicInvocation: false,
    internalToolInvocation: false,
  }),
  target(cast, character) {
    const id = nativeAgentId(cast, character);
    return {
      characterId: character.id,
      agentType: id,
      nickname: character.displayName,
      colorHint: character.color,
      configFile: `agents/${id}.toml`,
    };
  },
  renderAgentFile: renderCodexAgentFile,
});

const claudeAdapter = Object.freeze({
  id: "claude",
  native: true,
  capabilities: Object.freeze({
    namedAgents: true,
    agentDefinitions: true,
    isolatedContext: true,
    parallelDispatch: "host-managed",
    publicInvocation: false,
    internalToolInvocation: false,
  }),
  target(cast, character) {
    const id = nativeAgentId(cast, character);
    return {
      characterId: character.id,
      agentName: id,
      nickname: character.displayName,
      colorHint: character.color,
      configFile: `agents/${id}.md`,
    };
  },
  renderAgentFile: renderClaudeAgentFile,
});

const geminiAdapter = Object.freeze({
  id: "gemini",
  native: true,
  capabilities: Object.freeze({
    namedAgents: true,
    agentDefinitions: true,
    isolatedContext: true,
    parallelDispatch: "host-managed",
    publicInvocation: true,
    internalToolInvocation: true,
  }),
  invocation(cast, character) {
    const id = nativeAgentId(cast, character);
    return {
      publicSyntax: `@${id}`,
      internalTool: {
        name: "invoke_agent",
        arguments: {
          agent_name: id,
          prompt: "<character prompt>",
        },
      },
    };
  },
  target(cast, character) {
    const id = nativeAgentId(cast, character);
    return {
      characterId: character.id,
      agentName: id,
      nickname: character.displayName,
      colorHint: character.color,
      tool: "invoke_agent",
      invocation: `invoke_agent(agent_name: "${id}", prompt: <character prompt>)`,
      configFile: `agents/${id}.md`,
    };
  },
  renderAgentFile: renderGeminiAgentFile,
});

const genericAdapter = Object.freeze({
  id: "generic",
  native: false,
  capabilities: Object.freeze({
    namedAgents: false,
    agentDefinitions: false,
    isolatedContext: "executor-dependent",
    parallelDispatch: "executor-dependent",
    publicInvocation: false,
    internalToolInvocation: false,
  }),
  target(cast, character) {
    return {
      characterId: character.id,
      roleId: nativeAgentId(cast, character),
      nickname: character.displayName,
      colorHint: character.color,
      invocation: `Run the prompt for ${character.displayName} in an isolated model call or context.`,
    };
  },
  renderAgentFile: null,
});

export const createDefaultHostRegistry = () => {
  return Object.freeze({
    codex: codexAdapter,
    claude: claudeAdapter,
    gemini: geminiAdapter,
    generic: genericAdapter,
  });
};

export const renderAgentFiles = (cast, { hosts = HOST_IDS } = {}) => {
  if (!Array.isArray(hosts)) {
    throw new TypeError("hosts must be an array of host ids.");
  }

  const registry = createDefaultHostRegistry();
  const selected = hosts.map((hostId) => {
    const adapter = registry[hostId];
    if (!adapter) throw new Error(`Unknown Innercast host: ${hostId}`);
    return adapter;
  });

  const files = [];
  for (const character of cast.characters) {
    for (const adapter of selected) {
      if (adapter.renderAgentFile) {
        files.push(adapter.renderAgentFile(cast, character));
      }
    }
  }
  return files;
};
