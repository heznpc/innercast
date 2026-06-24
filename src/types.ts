export type Verdict = "Kill" | "Narrow" | "Build";
export type Confidence = "Low" | "Medium" | "High";

export type CouncilRole = "skeptic" | "advocate" | "builder" | "judge";

export interface EvidenceGap {
  id: string;
  text: string;
  resolved: boolean;
}

export interface ActionItem {
  id: string;
  text: string;
  done: boolean;
}

export interface CourtCase {
  id: string;
  title: string;
  idea: string;
  targetUser: string;
  constraints: string;
  temptedBuild: string;
  tags: string;
  template: string;
  verdict: Verdict;
  confidence: Confidence;
  rationale: string;
  evidenceGaps: EvidenceGap[];
  nextActions: ActionItem[];
  councilNotes: Record<CouncilRole, string[]>;
  handoffPrompt: string;
  createdAt: string;
  updatedAt: string;
}
