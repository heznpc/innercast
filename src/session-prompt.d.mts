import type { CourtCase } from "./types";

type DecisionFields = Pick<CourtCase, "idea" | "tags" | "temptedBuild" | "constraints" | "targetUser">;

export type SessionPromptResult =
  | { prompt: string; error: null }
  | { prompt: ""; error: string };

export function generateSessionPrompt(courtCase: DecisionFields): string;
export function resolveSessionPrompt(courtCase: DecisionFields & { sessionPrompt?: string }): SessionPromptResult;
