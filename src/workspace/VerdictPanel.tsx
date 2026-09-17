import { Archive, Check, ChevronRight, CircleHelp, ListPlus, Trash2 } from "lucide-react";
import { confidenceLevels, verdictTone } from "../court";
import type { ActionItem, Confidence, CourtCase, EvidenceGap, Verdict } from "../types";
import { PanelTitle, TextAreaField, VerdictBadge } from "./panel-ui";

export function VerdictPanel({
  activeCase,
  decisionStats,
  setField,
  updateGap,
  updateAction,
  addGap,
  addAction,
  removeGap,
  removeAction,
}: {
  activeCase: CourtCase;
  decisionStats: Record<Verdict, number>;
  setField: <Key extends keyof CourtCase>(key: Key, value: CourtCase[Key]) => void;
  updateGap: (gapId: string, patch: Partial<EvidenceGap>) => void;
  updateAction: (actionId: string, patch: Partial<ActionItem>) => void;
  addGap: () => void;
  addAction: () => void;
  removeGap: (gapId: string) => void;
  removeAction: (actionId: string) => void;
}) {
  return (
    <section className="panel signal-panel">
      <PanelTitle number="3." title="Main decision & journal" subtitle="The root or main agent decides after hearing the cast." />

      <div className="section-label">
        <span>Decision direction</span>
        <CircleHelp size={15} />
      </div>
      <div className="segmented" role="radiogroup" aria-label="Decision direction">
        {(Object.keys(verdictTone) as Verdict[]).map((verdict) => (
          <button
            key={verdict}
            className={`segment ${activeCase.verdict === verdict ? "active" : ""} ${verdict.toLowerCase()}`}
            onClick={() => setField("verdict", verdict)}
            role="radio"
            aria-checked={activeCase.verdict === verdict}
          >
            <span>{verdict === "Build" ? <Check size={20} /> : verdict === "Narrow" ? "−" : "×"}</span>
            {verdictTone[verdict].label}
          </button>
        ))}
      </div>

      <TextAreaField
        label="Root/main rationale"
        value={activeCase.rationale}
        onChange={(value) => setField("rationale", value)}
        placeholder="State which character tensions mattered and why the main agent chose this direction."
        minRows={3}
        compact
      />

      <label className="field-block confidence-row">
        <span>
          Confidence
          <CircleHelp size={14} />
        </span>
        <select value={activeCase.confidence} onChange={(event) => setField("confidence", event.target.value as Confidence)}>
          {confidenceLevels.map((level) => (
            <option key={level}>{level}</option>
          ))}
        </select>
      </label>

      <EditableList
        title="Evidence gaps"
        items={activeCase.evidenceGaps.map((gap) => ({ id: gap.id, text: gap.text, checked: gap.resolved }))}
        addLabel="Add gap"
        onAdd={addGap}
        onRemove={removeGap}
        onToggle={(gapId, checked) => updateGap(gapId, { resolved: checked })}
        onTextChange={(gapId, text) => updateGap(gapId, { text })}
      />

      <EditableList
        title="Next 3 actions"
        items={activeCase.nextActions.map((action) => ({ id: action.id, text: action.text, checked: action.done }))}
        addLabel="Add action"
        onAdd={addAction}
        onRemove={removeAction}
        onToggle={(actionId, checked) => updateAction(actionId, { done: checked })}
        onTextChange={(actionId, text) => updateAction(actionId, { text })}
        numbered
      />

      <div className="decision-log">
        <h3>Decision log</h3>
        {(Object.keys(decisionStats) as Verdict[]).map((verdict) => (
          <div className={`log-row ${verdict.toLowerCase()}`} key={verdict}>
            <span className="log-dot" />
            <div>
              <strong>{decisionStats[verdict]} {verdictTone[verdict].label}</strong>
              <small>{verdictTone[verdict].description}</small>
            </div>
            <VerdictBadge verdict={verdict} />
          </div>
        ))}
        <button className="journal-button">
          <Archive size={17} />
          View full journal
          <ChevronRight size={17} />
        </button>
      </div>
    </section>
  );
}

function EditableList({
  title,
  items,
  addLabel,
  onAdd,
  onRemove,
  onToggle,
  onTextChange,
  numbered,
}: {
  title: string;
  items: { id: string; text: string; checked: boolean }[];
  addLabel: string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onToggle: (id: string, checked: boolean) => void;
  onTextChange: (id: string, text: string) => void;
  numbered?: boolean;
}) {
  return (
    <div className="editable-list">
      <div className="list-head">
        <span>{title}</span>
        <button onClick={onAdd}>
          <ListPlus size={15} />
          {addLabel}
        </button>
      </div>
      <div className="list-items">
        {items.map((item, index) => (
          <div className="list-item" key={item.id}>
            {numbered ? (
              <span className="number-badge">{index + 1}</span>
            ) : (
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(event) => onToggle(item.id, event.target.checked)}
                aria-label={`Toggle ${item.text}`}
              />
            )}
            <input value={item.text} onChange={(event) => onTextChange(item.id, event.target.value)} />
            <button className="trash-button" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.text}`}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
