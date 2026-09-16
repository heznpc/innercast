import type { ActionItem, Confidence, CouncilRole, CourtCase, EvidenceGap, Verdict } from "./types";

import { generateSessionPrompt, resolveSessionPrompt } from "./session-prompt.mjs";
export { generateSessionPrompt, resolveSessionPrompt } from "./session-prompt.mjs";

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
  return [{ ...seed, sessionPrompt: generateSessionPrompt(seed), sessionPromptSource: "core-v1" }];
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
  const canReusePrompt = storedPrompt && (item.sessionPromptSource === "core-v1" || !/\bVerdict\b|handoff/i.test(storedPrompt));
  return {
    ...normalized,
    sessionPrompt: canReusePrompt ? storedPrompt : resolveSessionPrompt(normalized).prompt,
    sessionPromptSource: canReusePrompt ? item.sessionPromptSource : "core-v1",
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

export const generateMarkdown = (courtCase: CourtCase) => {
  const prompt = courtCase.sessionPrompt || generateSessionPrompt(courtCase);
  let fenceLength = 3;
  for (const match of prompt.matchAll(/`+/g)) fenceLength = Math.max(fenceLength, match[0].length + 1);
  const promptFence = "`".repeat(fenceLength);
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

${promptFence}text
${prompt}
${promptFence}
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
