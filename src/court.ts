import type { ActionItem, Confidence, CouncilRole, CourtCase, EvidenceGap, Verdict } from "./types";

const STORAGE_KEY = "innercast:cases:v3";

const nowIso = () => new Date().toISOString();

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export const roleOrder: CouncilRole[] = ["skeptic", "advocate", "builder"];

export const verdictTone: Record<Verdict, { label: string; description: string }> = {
  Kill: {
    label: "Stop",
    description: "The main agent decided not to proceed.",
  },
  Narrow: {
    label: "Adjust",
    description: "The main agent chose a smaller next move.",
  },
  Build: {
    label: "Proceed",
    description: "The main agent chose to proceed.",
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
    template: "Default Inner Cast (Doubt, Spark, Forge)",
    verdict: "Narrow",
    confidence: "Medium",
    rationale: "",
    evidenceGaps: [
      { id: id("gap"), text: "Which assumption does the cast still disagree on?", resolved: false },
      { id: id("gap"), text: "What evidence would change the main agent's decision?", resolved: false },
    ],
    nextActions: [
      { id: id("action"), text: "Run the cast inside one real AI task.", done: false },
      { id: id("action"), text: "Record the disagreement that changed the decision.", done: false },
      { id: id("action"), text: "Let the main agent choose the next move.", done: false },
    ],
    councilNotes: {
      skeptic: [],
      advocate: [],
      builder: [],
    },
    sessionPrompt: "",
    createdAt,
    updatedAt: createdAt,
  };
};

export const seedCases = (): CourtCase[] => {
  const base = blankCase();
  const seed: CourtCase = {
    ...base,
    title: "Innercast Across AI Runtimes",
    idea: "Define stable named character agents once, run them as an inner cast inside one AI task, and leave the final decision with the root or main agent.",
    targetUser: "People who work across Codex, Claude Code, Gemini CLI, or other AI tools and want recognizable decision voices without rebuilding the cast for each host.",
    constraints: "Stay local-first. Use native named agents where the host supports them, disclose fallback mode elsewhere, and never delegate the final decision to a character.",
    temptedBuild: "A hosted chat service that moves the deliberation outside the user's current AI task.",
    tags: "innercast, character-agents, adapters",
    verdict: "Narrow",
    confidence: "High",
    rationale: "The engine is valuable when the same recognizable cast can deliberate inside the current task while the main agent retains decision ownership.",
    evidenceGaps: [
      { id: id("gap"), text: "Which hosts expose stable character names in their native UI?", resolved: false },
      { id: id("gap"), text: "Does each adapter preserve the same behavioral contract?", resolved: false },
      { id: id("gap"), text: "Is the generic prompt fallback clearly distinguished from native subagents?", resolved: true },
    ],
    nextActions: [
      { id: id("action"), text: "Install and run the native cast in one Codex task.", done: true },
      { id: id("action"), text: "Run the same decision through a second native adapter.", done: false },
      { id: id("action"), text: "Compare native and generic fallback behavior.", done: false },
    ],
    councilNotes: generateCouncilNotes({
      ...base,
      idea: "Create Innercast as a cross-runtime character engine inside the current AI task.",
      targetUser: "People using more than one agent-capable AI runtime.",
      constraints: "Native adapters first, honest fallback, and main-agent decision ownership.",
      temptedBuild: "A separate hosted deliberation service.",
    }),
    createdAt: "2026-06-23T08:30:00.000Z",
    updatedAt: nowIso(),
  };
  return [{ ...seed, sessionPrompt: generateSessionPrompt(seed) }];
};

type StoredCouncilNotes = Partial<Record<CouncilRole | "judge" | "integrator", string[]>>;
type StoredCase = Omit<CourtCase, "councilNotes" | "sessionPrompt"> & {
  councilNotes?: StoredCouncilNotes;
  sessionPrompt?: string;
  handoffPrompt?: string;
  codexPrompt?: string;
};

const normalizeCase = (item: StoredCase): CourtCase => {
  const isLegacySeed = item.createdAt === "2026-06-23T08:30:00.000Z";
  if (isLegacySeed) {
    return seedCases()[0];
  }
  const notes = item.councilNotes ?? {};
  const usesDefaultCast =
    item.template.startsWith("Default Cast") || item.template.startsWith("Default Inner Cast");
  const normalizedTemplate = usesDefaultCast
    ? "Default Inner Cast (Doubt, Spark, Forge)"
    : item.template;
  const normalized: CourtCase = {
    ...item,
    template: normalizedTemplate,
    councilNotes: {
      skeptic: notes.skeptic ?? [],
      advocate: notes.advocate ?? [],
      builder: notes.builder ?? [],
    },
    sessionPrompt: "",
  };
  const storedPrompt = item.sessionPrompt || item.handoffPrompt || item.codexPrompt || "";
  const canReusePrompt = storedPrompt && !/\bVerdict\b|handoff/i.test(storedPrompt);
  return {
    ...normalized,
    sessionPrompt: canReusePrompt ? storedPrompt : generateSessionPrompt(normalized),
  };
};

export const loadCases = (): CourtCase[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedCases();
    const parsed = JSON.parse(raw) as StoredCase[];
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
  const decision = courtCase.idea.trim() || "this decision";
  const affected = courtCase.targetUser.trim() || "the people or system affected";
  const impulse = courtCase.temptedBuild.trim() || "the current impulse";
  const constraints = courtCase.constraints.trim() || "the stated constraints";

  return {
    skeptic: [
      `Challenge whether ${decision.toLowerCase()} solves the real problem for ${affected.toLowerCase()}.`,
      "Name the assumption most likely to make the current plan fail.",
      "Ask what evidence would justify stopping before more work is committed.",
    ],
    advocate: [
      "Protect the part of the proposal that still creates meaningful value.",
      `Find the strongest achievable version under ${constraints.toLowerCase()}.`,
      "Explain what becomes possible if the main agent proceeds deliberately.",
    ],
    builder: [
      `Turn ${impulse.toLowerCase()} into the smallest reversible next move.`,
      "Separate what can happen now from what depends on missing evidence.",
      "Return a concrete sequence the main agent could actually execute.",
    ],
  };
};

export const generateSessionPrompt = (courtCase: CourtCase) => {
  return `Run Innercast inside this current AI task.

Treat the root or main agent for this task as the decision owner. Use three advisory characters:
- Doubt: challenge assumptions, risks, and reasons to stop
- Spark: protect the strongest possibility and value
- Forge: convert the surviving direction into an executable next move

If native custom agents named Doubt, Spark, and Forge are available, spawn one subagent per character within this task and wait for all of them. Keep their findings independent until every character has reported. Do not create a separate user-facing decision session.

If native character agents are unavailable, run in prompt fallback mode: simulate the three voices in clearly separated sections and disclose that no native subagents were used. Do not claim the fallback is equivalent to native parallel agents.

After the cast reports, the root or main agent must compare their disagreements and make the final decision. No character may decide on behalf of the root or main agent.

The root or main agent must return exactly this structure:

Decision: <one clear choice>
Confidence: Low / Medium / High

1. Character Positions
2. Main Tension
3. Decision Rationale
4. Risks Accepted
5. Next Action

Decision or goal:
${courtCase.idea || "<what needs to be decided>"}

People or system affected:
${courtCase.targetUser || "<who or what is affected>"}

Current context:
${courtCase.tags || "<repo/product/workflow/resources>"}

Constraints:
${courtCase.constraints || "<time, budget, technical, distribution, trust, or personal constraints>"}

Current impulse:
${courtCase.temptedBuild || "<what the main agent currently wants to do>"}`;
};

export const generateMarkdown = (courtCase: CourtCase) => {
  const gaps = courtCase.evidenceGaps
    .map((gap) => `- [${gap.resolved ? "x" : " "}] ${gap.text}`)
    .join("\n");
  const actions = courtCase.nextActions
    .map((action, index) => `${index + 1}. [${action.done ? "x" : " "}] ${action.text}`)
    .join("\n");

  return `# ${courtCase.title}

Direction: ${verdictTone[courtCase.verdict].label}
Confidence: ${courtCase.confidence}
Updated: ${new Date(courtCase.updatedAt).toLocaleString()}

## Decision or Goal

${courtCase.idea || "_No decision entered._"}

## People or System Affected

${courtCase.targetUser || "_No affected context entered._"}

## Constraints

${courtCase.constraints || "_No constraints entered._"}

## Current Impulse

${courtCase.temptedBuild || "_No current impulse entered._"}

## Root/Main Decision Rationale

${courtCase.rationale || "_No rationale entered._"}

## Cast Notes

### Doubt
${courtCase.councilNotes.skeptic.map((item) => `- ${item}`).join("\n")}

### Spark
${courtCase.councilNotes.advocate.map((item) => `- ${item}`).join("\n")}

### Forge
${courtCase.councilNotes.builder.map((item) => `- ${item}`).join("\n")}

## Evidence Gaps

${gaps}

## Next 3 Actions

${actions}

## Current-Task Session Prompt

\`\`\`text
${courtCase.sessionPrompt || generateSessionPrompt(courtCase)}
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
