import { PLATFORM_IDS } from "./schema.mjs";

const renderDecisionData = (decisionBrief) => {
  return JSON.stringify({
    decision: decisionBrief.decision,
    context: decisionBrief.context,
    constraints: decisionBrief.constraints,
    stakes: decisionBrief.stakes,
  }, null, 2);
};

const longestBacktickRun = (value) => {
  let longest = 0;
  for (const match of value.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  return longest;
};

const fenced = (value, language = "text") => {
  const fence = "`".repeat(Math.max(3, longestBacktickRun(value) + 1));
  return `${fence}${language}\n${value}\n${fence}`;
};

const markdownInlineValue = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/\|/g, "\\|")
  .replace(/\r?\n/g, " ");

export const renderExecutionPlanMarkdown = (output) => {
  const lines = [
    "# Innercast Execution Plan",
    "",
    `- Schema: \`${output.schema}\``,
    `- Engine: \`${output.engineVersion}\``,
    `- Cast: ${output.cast.name} \`${output.cast.id}@${output.cast.version}\``,
    `- Source: \`${output.cast.source}\``,
    `- Definition SHA-256: \`${output.cast.definitionSha256}\``,
    `- Selected platform: \`${output.executionPlan.selectedPlatform}\``,
    `- Scope: \`${output.executionPlan.scope}\``,
    `- Context mode: \`${output.executionPlan.contextMode}\``,
    `- Final decision owner: \`${output.executionPlan.finalDecisionOwner}\``,
    "",
    "## Decision Brief",
    "",
    fenced(renderDecisionData(output.decisionBrief), "json"),
    "",
    "## Execution",
    "",
  ];

  for (const wave of output.executionPlan.waves) {
    lines.push(`### ${wave.waveId}`, "");
    lines.push(`Parallel: \`${wave.parallel}\``);
    if (wave.dependsOn.length) {
      lines.push(`Depends on: ${wave.dependsOn.map((id) => `\`${id}\``).join(", ")}`);
    }
    lines.push("");
    for (const step of wave.steps) {
      lines.push(`- \`${step.stepId}\`${step.displayName ? ` — ${step.displayName}` : ""}`);
    }
    lines.push("");
  }

  lines.push("## Adapter Targets", "");
  for (const platform of PLATFORM_IDS) {
    lines.push(
      `### ${platform}`,
      "",
      "| Character | Native target | Config / invocation |",
      "|---|---|---|",
    );
    for (const target of output.adapterTargets[platform]) {
      const native = target.agentType || target.agentName || target.roleId;
      const location = target.configFile || target.invocation;
      lines.push(`| ${markdownInlineValue(target.nickname)} | \`${markdownInlineValue(native)}\` | ${markdownInlineValue(location)} |`);
    }
    lines.push("");
  }

  lines.push("## Character Prompts", "");
  for (const id of output.cast.characterOrder) {
    const character = output.characterPrompts[id];
    lines.push(
      `### ${markdownInlineValue(character.displayName)} (\`${id}\`)`,
      "",
      fenced(character.prompt),
      "",
    );
  }
  lines.push("## Root Synthesis Prompt", "", fenced(output.rootSynthesisPrompt), "");
  return lines.join("\n");
};

export const renderExecutionPlanJson = (output) => JSON.stringify(output, null, 2);

const renderTarget = (target) => {
  if (!target) return "host-defined isolated voice";
  if (target.agentType) return `Codex agent type ${target.agentType}`;
  if (target.agentName) return `${target.agentName}${target.invocation ? ` (${target.invocation})` : ""}`;
  if (target.roleId) return `${target.roleId} (${target.invocation})`;
  const values = Object.entries(target)
    .map(([platform, value]) => `${platform}: ${renderTarget(value)}`)
    .join("; ");
  return values || "host-defined isolated voice";
};

export const renderExecutionPrompt = (output) => {
  const selectedPlatform = output.executionPlan.selectedPlatform;
  const lines = [
    "Run Innercast inside this current task. This task is the person; the named workers are advisory inner characters.",
    "",
    `Target surface: ${selectedPlatform}.`,
  ];

  if (selectedPlatform === "generic") {
    lines.push(
      "Compatibility fallback: native subagent names, parallelism, and context isolation are not guaranteed on this host. If separate model contexts are available, run one per character in parallel. Otherwise run the character prompts in separate sections without blending their roles or exposing earlier character outputs to later characters.",
      "",
    );
  } else if (selectedPlatform === "all") {
    lines.push(
      "Choose the best native target available on the current host. Dispatch every character independently and in parallel with the exact prompt assigned below. Wait for all results. Do not let one character see another character's private output during the cast wave.",
      "",
    );
  } else {
    lines.push(
      "Dispatch every character in the cast wave independently and in parallel with the exact prompt assigned below. Wait for all results. Do not let one character see another character's private output during the cast wave.",
      "",
    );
  }

  for (const step of output.executionPlan.waves[0].steps) {
    const character = output.characterPrompts[step.characterId];
    lines.push(`## ${character.displayName}`);
    lines.push(`Target: ${renderTarget(step.target)}`);
    lines.push("");
    lines.push(fenced(character.prompt));
    lines.push("");
  }

  lines.push("## Root synthesis");
  lines.push("");
  lines.push("After every character returns, replace each INNERCAST_OUTPUT placeholder with that character's exact output. Then the current host/root agent—not another worker—must answer using this prompt:");
  lines.push("");
  lines.push(fenced(output.rootSynthesisPrompt));
  return lines.join("\n");
};
