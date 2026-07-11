const DEFAULT_BUDGET_LIMITS = Object.freeze({
  recommendedMaxAggregateInputChars: 200_000,
  recommendedMaxEstimatedAggregateTokens: 50_000,
  recommendedMaxSingleCallChars: 200_000,
  recommendedMaxEstimatedSingleCallTokens: 50_000,
  hardMaxAggregateInputChars: 1_000_000,
  hardMaxEstimatedAggregateTokens: 250_000,
  hardMaxSingleCallChars: 1_000_000,
  hardMaxEstimatedSingleCallTokens: 250_000,
});

const encoder = new TextEncoder();
const utf8Bytes = (value) => encoder.encode(value).byteLength;
const estimateTokensFromBytes = (bytes) => Math.ceil(bytes / 4);
const estimateTokens = (value) => estimateTokensFromBytes(utf8Bytes(value));

const requireExecutionOutput = (output) => {
  if (!output || typeof output !== "object" || !output.characterPrompts || typeof output.rootSynthesisPrompt !== "string") {
    throw new TypeError("Expected a compiled Innercast execution plan.");
  }
};

const projectExecutionBudget = ({ decision = "", context = "", constraints = "", stakes = "", castDefinition } = {}) => {
  const characters = Array.isArray(castDefinition?.characters) ? castDefinition.characters : [];
  if (characters.length === 0) throw new TypeError("castDefinition must contain characters for budget projection.");
  const decisionPacket = JSON.stringify({ decision, context, constraints, stakes }, null, 2);
  const decisionPacketUtf8Bytes = utf8Bytes(decisionPacket);
  const characterContractsUtf8Bytes = utf8Bytes(JSON.stringify(characters));
  const characterCount = characters.length;

  // The compiler embeds the shared decision packet once per character and once
  // in the root prompt. Contract and wrapper allowance intentionally
  // overestimates so a hard rejection happens before prompt materialization.
  const wrapperAllowanceUtf8Bytes = 20_000 * (characterCount + 1);
  const projectedAggregateInputUtf8Bytes =
    decisionPacketUtf8Bytes * (characterCount + 1) +
    characterContractsUtf8Bytes * 2 +
    wrapperAllowanceUtf8Bytes;
  const projectedMaxSingleCallUtf8Bytes =
    decisionPacketUtf8Bytes + characterContractsUtf8Bytes + 20_000;

  return {
    characterCount,
    decisionPacketUtf8Bytes,
    characterContractsUtf8Bytes,
    projectedAggregateInputUtf8Bytes,
    projectedEstimatedAggregateTokens: estimateTokensFromBytes(projectedAggregateInputUtf8Bytes),
    projectedMaxSingleCallUtf8Bytes,
    projectedEstimatedMaxSingleCallTokens: estimateTokensFromBytes(projectedMaxSingleCallUtf8Bytes),
    estimator: "ceil(utf8-bytes/4)",
  };
};

const evaluateProjectedExecutionBudget = (input, limits = {}) => {
  const resolved = { ...DEFAULT_BUDGET_LIMITS, ...limits };
  const projection = projectExecutionBudget(input);
  const warnings = [];
  const violations = [];

  if (projection.projectedEstimatedAggregateTokens >= resolved.recommendedMaxEstimatedAggregateTokens) {
    warnings.push(`Projected aggregate character and root prompts are approximately ${projection.projectedEstimatedAggregateTokens.toLocaleString("en-US")} tokens.`);
  }
  if (projection.projectedEstimatedMaxSingleCallTokens >= resolved.recommendedMaxEstimatedSingleCallTokens) {
    warnings.push(`The projected largest single prompt is approximately ${projection.projectedEstimatedMaxSingleCallTokens.toLocaleString("en-US")} tokens.`);
  }
  if (projection.projectedEstimatedAggregateTokens > resolved.hardMaxEstimatedAggregateTokens) {
    violations.push("Projected aggregate prompt input exceeds the configured hard limit.");
  }
  if (projection.projectedEstimatedMaxSingleCallTokens > resolved.hardMaxEstimatedSingleCallTokens) {
    violations.push("A projected single prompt exceeds the configured hard limit.");
  }

  return { projection, limits: resolved, warnings, violations, ok: violations.length === 0 };
};

const measureExecutionBudget = (output) => {
  requireExecutionOutput(output);
  const characterInputs = Object.entries(output.characterPrompts).map(([characterId, value]) => {
    if (!value || typeof value.prompt !== "string") {
      throw new TypeError(`Missing prompt for Innercast character: ${characterId}`);
    }
    return {
      characterId,
      characters: value.prompt.length,
      utf8Bytes: utf8Bytes(value.prompt),
      estimatedTokens: estimateTokens(value.prompt),
    };
  });
  const rootInput = {
    characters: output.rootSynthesisPrompt.length,
    utf8Bytes: utf8Bytes(output.rootSynthesisPrompt),
    estimatedTokens: estimateTokens(output.rootSynthesisPrompt),
  };
  const aggregateInputChars = characterInputs.reduce((total, item) => total + item.characters, 0) + rootInput.characters;
  const aggregateInputUtf8Bytes = characterInputs.reduce((total, item) => total + item.utf8Bytes, 0) + rootInput.utf8Bytes;
  const maxSingleCallChars = Math.max(rootInput.characters, ...characterInputs.map((item) => item.characters), 0);
  const maxSingleCallUtf8Bytes = Math.max(rootInput.utf8Bytes, ...characterInputs.map((item) => item.utf8Bytes), 0);
  const decisionBriefChars = Object.values(output.decisionBrief || {})
    .filter((value) => typeof value === "string")
    .reduce((total, value) => total + value.length, 0);

  return {
    characterCount: characterInputs.length,
    characterInputs,
    rootInput,
    decisionBriefChars,
    aggregateInputChars,
    aggregateInputUtf8Bytes,
    estimatedAggregateTokens: estimateTokensFromBytes(aggregateInputUtf8Bytes),
    maxSingleCallChars,
    maxSingleCallUtf8Bytes,
    estimatedMaxSingleCallTokens: estimateTokensFromBytes(maxSingleCallUtf8Bytes),
    estimator: "ceil(utf8-bytes/4)",
    promptAmplification: decisionBriefChars === 0
      ? null
      : Number((aggregateInputChars / decisionBriefChars).toFixed(2)),
  };
};

const evaluateExecutionBudget = (output, limits = {}) => {
  const resolved = { ...DEFAULT_BUDGET_LIMITS, ...limits };
  const measurement = measureExecutionBudget(output);
  const warnings = [];
  const violations = [];

  if (measurement.aggregateInputChars >= resolved.recommendedMaxAggregateInputChars ||
      measurement.estimatedAggregateTokens >= resolved.recommendedMaxEstimatedAggregateTokens) {
    warnings.push(`Aggregate character and root prompts are approximately ${measurement.estimatedAggregateTokens.toLocaleString("en-US")} tokens.`);
  }
  if (measurement.maxSingleCallChars >= resolved.recommendedMaxSingleCallChars ||
      measurement.estimatedMaxSingleCallTokens >= resolved.recommendedMaxEstimatedSingleCallTokens) {
    warnings.push(`The largest single prompt is approximately ${measurement.estimatedMaxSingleCallTokens.toLocaleString("en-US")} tokens.`);
  }
  if (measurement.aggregateInputChars > resolved.hardMaxAggregateInputChars ||
      measurement.estimatedAggregateTokens > resolved.hardMaxEstimatedAggregateTokens) {
    violations.push("Aggregate prompt input exceeds the configured hard limit.");
  }
  if (measurement.maxSingleCallChars > resolved.hardMaxSingleCallChars ||
      measurement.estimatedMaxSingleCallTokens > resolved.hardMaxEstimatedSingleCallTokens) {
    violations.push("A single prompt exceeds the configured hard limit.");
  }

  return { measurement, limits: resolved, warnings, violations, ok: violations.length === 0 };
};

const assertExecutionBudget = (output, limits = {}) => {
  const result = evaluateExecutionBudget(output, limits);
  if (!result.ok) {
    throw new RangeError(`Innercast prompt budget exceeded: ${result.violations.join(" ")}`);
  }
  return result;
};

export {
  DEFAULT_BUDGET_LIMITS,
  assertExecutionBudget,
  estimateTokens,
  estimateTokensFromBytes,
  evaluateExecutionBudget,
  evaluateProjectedExecutionBudget,
  measureExecutionBudget,
  projectExecutionBudget,
  utf8Bytes,
};
