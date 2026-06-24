import type { ActionItem, Confidence, CouncilRole, CourtCase, EvidenceGap, Verdict } from "./types";

const STORAGE_KEY = "innercast:cases:v3";

const nowIso = () => new Date().toISOString();

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const roleOrder: CouncilRole[] = ["skeptic", "advocate", "builder", "judge"];

export const verdictTone: Record<Verdict, { label: string; description: string }> = {
  Kill: {
    label: "Kill",
    description: "Do not build until the core risk changes.",
  },
  Narrow: {
    label: "Narrow",
    description: "Build only a smaller proof.",
  },
  Build: {
    label: "Build",
    description: "Proceed with the scoped MVP.",
  },
};

export const confidenceLevels: Confidence[] = ["Low", "Medium", "High"];

export const blankCase = (): CourtCase => {
  const createdAt = nowIso();
  return {
    id: id("case"),
    title: "Untitled Innercast",
    idea: "",
    targetUser: "",
    constraints: "",
    temptedBuild: "",
    tags: "",
    template: "Default Cast (Doubt, Spark, Forge, Verdict)",
    verdict: "Narrow",
    confidence: "Medium",
    rationale: "",
    evidenceGaps: [
      { id: id("gap"), text: "Who repeats this workflow without prompting?", resolved: false },
      { id: id("gap"), text: "What single decision should change after the run?", resolved: false },
    ],
    nextActions: [
      { id: id("action"), text: "Run Innercast on one real idea.", done: false },
      { id: id("action"), text: "Compare against a one-prompt review.", done: false },
      { id: id("action"), text: "Cut the MVP to a 7-day proof.", done: false },
    ],
    councilNotes: {
      skeptic: [],
      advocate: [],
      builder: [],
      judge: [],
    },
    handoffPrompt: "",
    createdAt,
    updatedAt: createdAt,
  };
};

export const seedCases = (): CourtCase[] => {
  const base = blankCase();
  const seed: CourtCase = {
    ...base,
    title: "Innercast For AI Agent Work",
    idea: "Create Innercast: a character-driven pre-build review layer where named persona agents such as Doubt, Spark, Forge, and Verdict react to an idea before it is handed to an AI agent.",
    targetUser: "Solo founders and indie builders who use Codex, Claude, Gemini, or similar AI agents to move quickly but want a structured decision check before building.",
    constraints: "Start with a local app, reusable prompts, and adapter packs. Keep each AI app integration optional.",
    temptedBuild: "A polished agent-character platform or broad custom subagent marketplace.",
    tags: "innercast, ai-agents, product",
    verdict: "Narrow",
    confidence: "High",
    rationale: "The wedge is useful only if the cast changes the handoff: kill the idea, trim the build, or produce a clearer implementation prompt.",
    evidenceGaps: [
      { id: id("gap"), text: "Does role separation change actual build decisions?", resolved: false },
      { id: id("gap"), text: "Will the same builder run it three times after novelty fades?", resolved: false },
      { id: id("gap"), text: "Does the output become a smaller agent handoff prompt?", resolved: true },
    ],
    nextActions: [
      { id: id("action"), text: "Ship a local Innercast workflow first.", done: true },
      { id: id("action"), text: "Run it on five real build ideas.", done: false },
      { id: id("action"), text: "Keep only signals that change scope.", done: false },
    ],
    councilNotes: generateCouncilNotes({
      ...base,
      idea: "Create Innercast as a character-driven pre-build review layer.",
      targetUser: "Solo founders and indie builders using AI coding agents.",
      constraints: "Start with a local app, prompts, and adapter packs.",
      temptedBuild: "A polished agent-character platform or broad subagent marketplace.",
    }),
    createdAt: "2026-06-23T08:30:00.000Z",
    updatedAt: nowIso(),
  };
  return [{ ...seed, handoffPrompt: generateHandoffPrompt(seed) }];
};

const normalizeCase = (item: CourtCase & { codexPrompt?: string; handoffPrompt?: string }): CourtCase => {
  const isLegacySeed =
    item.createdAt === "2026-06-23T08:30:00.000Z" &&
    item.tags === "codex, agents, product";
  if (isLegacySeed) {
    return seedCases()[0];
  }
  return {
    ...item,
    handoffPrompt: item.handoffPrompt || generateHandoffPrompt(item),
  };
};

export const loadCases = (): CourtCase[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedCases();
    const parsed = JSON.parse(raw) as Array<CourtCase & { codexPrompt?: string }>;
    return parsed.length ? parsed.map(normalizeCase) : seedCases();
  } catch {
    return seedCases();
  }
};

export const saveCases = (cases: CourtCase[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cases));
};

export const titleFromIdea = (idea: string) => {
  const firstLine = idea.trim().split(/\n+/)[0]?.trim();
  if (!firstLine) return "Untitled Innercast";
  return firstLine.length > 42 ? `${firstLine.slice(0, 39)}...` : firstLine;
};

export const generateCouncilNotes = (courtCase: Pick<CourtCase, "idea" | "targetUser" | "constraints" | "temptedBuild">): Record<CouncilRole, string[]> => {
  const idea = courtCase.idea.trim() || "this idea";
  const user = courtCase.targetUser.trim() || "the target user";
  const tempted = courtCase.temptedBuild.trim() || "the broad version";
  const constraints = courtCase.constraints.trim() || "the current constraints";

  return {
    skeptic: [
      `If ${user} can solve the job with an ordinary prompt, the product collapses into packaging.`,
      `The broad version may create surface area before proving repeated use.`,
      `The fastest kill test is whether the signal changes a real build plan.`,
    ],
    advocate: [
      `The strongest version focuses on the moment before an AI agent starts building.`,
      `The narrow promise is: give ${idea.toLowerCase()} an inner cast before scope expands.`,
      `Preserve the character loop, hard signal, and handoff into implementation.`,
    ],
    builder: [
      `Ship a 7-day proof that keeps ${tempted.toLowerCase()} out of scope.`,
      `Use files, prompts, and a local handoff playground before adding infrastructure.`,
      `Validate with five real cases under ${constraints.toLowerCase()}.`,
    ],
    judge: [
      "Default signal is Narrow unless the repeated-use moment is missing.",
      "Build only the smallest loop that creates an agent-ready handoff prompt.",
      "Continue only if the user changes, kills, or narrows a planned build.",
    ],
  };
};

export const deriveVerdict = (courtCase: CourtCase): Verdict => {
  const text = `${courtCase.idea} ${courtCase.targetUser} ${courtCase.constraints} ${courtCase.temptedBuild}`.toLowerCase();
  const hasUser = courtCase.targetUser.trim().length > 20;
  const hasConstraint = courtCase.constraints.trim().length > 12;
  const tooBroad = /platform|marketplace|dashboard|all-in-one|everything|broad|automate everything|full/.test(text);
  const weakEvidence = /maybe|not sure|unclear|everyone|anyone/.test(text);

  if (!hasUser || weakEvidence) return "Kill";
  if (tooBroad || !hasConstraint) return "Narrow";
  return "Build";
};

export const generateHandoffPrompt = (courtCase: CourtCase) => {
  return `Run Innercast on the idea below.

Use four cast characters:
- Doubt: challenge assumptions and find reasons not to build
- Spark: find the strongest viable version and repeated-use moment
- Forge: reduce the idea to a 7-day MVP
- Verdict: resolve tension and return a hard Kill / Narrow / Build signal

If custom agents named Doubt, Spark, Forge, and Verdict are available, spawn one subagent per character and wait for all of them. If they are not available, simulate the four characters in separate sections without blending their responsibilities.

Output exactly this structure:

Signal: Kill / Narrow / Build

1. Doubt Objections
2. Spark Survival Case
3. Forge 7-Day MVP
4. Evidence Gaps
5. Verdict Decision
6. Next 3 Actions

Idea:
${courtCase.idea || "<paste idea>"}

Target user:
${courtCase.targetUser || "<who would repeatedly use this>"}

Current context:
${courtCase.tags || "<repo/product/workflow/resources>"}

Constraints:
${courtCase.constraints || "<time, budget, technical, distribution, trust, or personal constraints>"}

What I am tempted to build:
${courtCase.temptedBuild || "<the current over-scoped version>"}`;
};

export const generateRationale = (verdict: Verdict, courtCase: CourtCase) => {
  if (verdict === "Kill") {
    return "The repeated-use moment or target user is not concrete enough to justify building now. Run a faster evidence test first.";
  }
  if (verdict === "Build") {
    return "The target user, constraints, and MVP path are concrete enough to proceed with a small validated build.";
  }
  const title = titleFromIdea(courtCase.idea).toLowerCase();
  return `The idea has a plausible wedge, but ${title} must be reduced to a focused proof before any product surface expands.`;
};

export const generateMarkdown = (courtCase: CourtCase) => {
  const gaps = courtCase.evidenceGaps
    .map((gap) => `- [${gap.resolved ? "x" : " "}] ${gap.text}`)
    .join("\n");
  const actions = courtCase.nextActions
    .map((action, index) => `${index + 1}. [${action.done ? "x" : " "}] ${action.text}`)
    .join("\n");

  return `# ${courtCase.title}

Signal: ${courtCase.verdict}
Confidence: ${courtCase.confidence}
Updated: ${new Date(courtCase.updatedAt).toLocaleString()}

## Idea

${courtCase.idea || "_No idea entered._"}

## Target User

${courtCase.targetUser || "_No target user entered._"}

## Constraints

${courtCase.constraints || "_No constraints entered._"}

## Tempted Build

${courtCase.temptedBuild || "_No tempted build entered._"}

## Rationale

${courtCase.rationale || "_No rationale entered._"}

## Cast Notes

### Doubt
${courtCase.councilNotes.skeptic.map((item) => `- ${item}`).join("\n")}

### Spark
${courtCase.councilNotes.advocate.map((item) => `- ${item}`).join("\n")}

### Forge
${courtCase.councilNotes.builder.map((item) => `- ${item}`).join("\n")}

### Verdict
${courtCase.councilNotes.judge.map((item) => `- ${item}`).join("\n")}

## Evidence Gaps

${gaps}

## Next 3 Actions

${actions}

## Agent Handoff

\`\`\`text
${courtCase.handoffPrompt || generateHandoffPrompt(courtCase)}
\`\`\`
`;
};

export const createGap = (text = ""): EvidenceGap => ({
  id: id("gap"),
  text,
  resolved: false,
});

export const createAction = (text = ""): ActionItem => ({
  id: id("action"),
  text,
  done: false,
});
