import { verdictTone } from "../court";
import type { Verdict } from "../types";

export function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  minRows,
  compact,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  minRows: number;
  compact?: boolean;
}) {
  return (
    <label className={`field-block ${compact ? "compact" : ""}`}>
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={minRows}
      />
    </label>
  );
}

export function PanelTitle({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="panel-title">
      <h2>
        <span>{number}</span>
        {title}
      </h2>
      <p>{subtitle}</p>
    </div>
  );
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={`verdict-badge ${verdict.toLowerCase()}`}>{verdictTone[verdict].label}</span>;
}
