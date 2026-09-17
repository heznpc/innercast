import {
  assertExecutionBudget,
  compileCastPlan,
  evaluateProjectedExecutionBudget,
  renderExecutionPrompt,
} from "../innercast/index.mjs";
import roster from "../innercast/roster/innercast.roles.json" with { type: "json" };

const valueOr = (value, placeholder) => value.trim() || placeholder;

export const generateSessionPrompt = (courtCase) => {
  const input = {
    decision: valueOr(courtCase.idea, "<what needs to be decided>"),
    context: [
      "Current context:",
      valueOr(courtCase.tags, "<repo/product/workflow/resources>"),
      "",
      "Current impulse:",
      valueOr(courtCase.temptedBuild, "<what the main agent currently wants to do>"),
    ].join("\n"),
    constraints: valueOr(courtCase.constraints, "<time, budget, technical, distribution, trust, or personal constraints>"),
    stakes: valueOr(courtCase.targetUser, "<who or what is affected>"),
    platform: "all",
    castDefinition: roster,
    sourceLabel: "canonical-roster",
  };
  const projected = evaluateProjectedExecutionBudget(input);
  if (!projected.ok) {
    throw new RangeError(`Innercast prompt budget exceeded: ${projected.violations.join(" ")}`);
  }
  const plan = compileCastPlan(input);
  assertExecutionBudget(plan);
  return renderExecutionPrompt(plan);
};

// Saved prompts remain snapshots until the user explicitly refreshes them.
export const resolveSessionPrompt = (courtCase) => {
  if (courtCase.sessionPrompt) return { prompt: courtCase.sessionPrompt, error: null };
  try {
    return { prompt: generateSessionPrompt(courtCase), error: null };
  } catch (error) {
    return {
      prompt: "",
      error: error instanceof Error ? error.message : "Unable to generate the session prompt.",
    };
  }
};
