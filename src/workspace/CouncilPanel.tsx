import { ChevronRight, CircleHelp, Copy, Download, Play, Shield, Sparkles, Wrench } from "lucide-react";
import { roleOrder } from "../court";
import type { SessionPromptResult } from "../session-prompt.mjs";
import type { CouncilRole, CourtCase } from "../types";
import { PanelTitle } from "./panel-ui";

const roleMeta: Record<CouncilRole, {
  title: string;
  tag: string;
  icon: typeof Sparkles;
  tone: string;
  prompts: string[];
}> = {
  skeptic: {
    title: "Doubt",
    tag: "Skeptic",
    icon: CircleHelp,
    tone: "danger",
    prompts: ["What could go wrong?", "What assumptions are shaky?", "What will users not adopt?"],
  },
  advocate: {
    title: "Spark",
    tag: "Advocate",
    icon: Shield,
    tone: "neutral",
    prompts: ["Why is this worth building?", "What problem does it solve well?", "Why now?"],
  },
  builder: {
    title: "Forge",
    tag: "Builder",
    icon: Wrench,
    tone: "success",
    prompts: ["What's the simplest path?", "What are the key milestones?", "What would v1 look like?"],
  },
};

export function CouncilPanel({
  activeCase,
  sessionPrompt,
  previewCast,
  copyPrompt,
  copied,
}: {
  activeCase: CourtCase;
  sessionPrompt: SessionPromptResult;
  previewCast: () => void;
  copyPrompt: () => void;
  copied: "prompt" | "markdown" | null;
}) {
  return (
    <section className="panel cast-panel">
      <div className="panel-head with-action">
        <PanelTitle number="2." title="Inner cast" subtitle="Three advisory voices. The main agent owns the call." />
        <button className="run-button" onClick={previewCast}>
          <Play size={15} />
          Preview voices
        </button>
      </div>

      <div className="role-stack">
        {roleOrder.map((role) => (
          <RoleCard key={role} role={role} notes={activeCase.councilNotes[role]} />
        ))}
      </div>

      <div className="prompt-box">
        <div className="prompt-head">
          <div>
            <h3>Current-task session prompt</h3>
            <p>This browser is a preview. Native adapters run the live cast inside your AI task.</p>
          </div>
          <button className="dark-button" onClick={previewCast}>
            <Sparkles size={15} />
            Refresh prompt
          </button>
        </div>
        {sessionPrompt.error !== null && (
          <p role="alert">Unable to generate prompt: {sessionPrompt.error} Edit the decision context and refresh the prompt.</p>
        )}
        <textarea value={sessionPrompt.prompt} readOnly aria-label="Generated current-task session prompt" />
        <div className="prompt-actions">
          <button className="ghost-button" onClick={copyPrompt} disabled={sessionPrompt.error !== null}>
            <Copy size={16} />
            {copied === "prompt" ? "Copied" : "Copy session prompt"}
          </button>
          <a className="ghost-button link-button" href="./innercast-kit.zip" download>
            <Download size={16} />
            Download kit
          </a>
        </div>
      </div>
    </section>
  );
}

function RoleCard({ role, notes }: { role: CouncilRole; notes: string[] }) {
  const meta = roleMeta[role];
  const Icon = meta.icon;
  const body = notes.length ? notes : meta.prompts;

  return (
    <article className={`role-card ${meta.tone}`}>
      <div className="role-icon">
        <Icon size={24} />
      </div>
      <div className="role-content">
        <div className="role-title">
          <h3>{meta.title}</h3>
          <span>{meta.tag}</span>
        </div>
        <ul>
          {body.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="role-status">
        <span>{notes.length ? "Ready" : "Pending"}</span>
        <ChevronRight size={17} />
      </div>
    </article>
  );
}
