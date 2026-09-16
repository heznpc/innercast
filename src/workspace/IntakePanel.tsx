import type { CourtCase } from "../types";
import { PanelTitle, TextAreaField } from "./panel-ui";

export function IntakePanel({
  activeCase,
  setField,
}: {
  activeCase: CourtCase;
  setField: <Key extends keyof CourtCase>(key: Key, value: CourtCase[Key]) => void;
}) {
  return (
    <section className="panel intake-panel">
      <PanelTitle number="1." title="Decision context" subtitle="Give the inner cast one concrete decision to examine." />
      <TextAreaField
        label="Decision or goal"
        value={activeCase.idea}
        onChange={(value) => setField("idea", value)}
        placeholder="Should we replace the current review workflow, narrow it, or keep it for another cycle?"
        minRows={5}
      />
      <TextAreaField
        label="People or system affected"
        value={activeCase.targetUser}
        onChange={(value) => setField("targetUser", value)}
        placeholder="The team using the workflow, the repository it affects, and anyone who must maintain the result."
        minRows={4}
      />
      <TextAreaField
        label="Constraints"
        value={activeCase.constraints}
        onChange={(value) => setField("constraints", value)}
        placeholder="- Initial build in 4 weeks&#10;- <$100/month infra&#10;- Must integrate with GitHub"
        minRows={4}
      />
      <TextAreaField
        label="Current impulse"
        value={activeCase.temptedBuild}
        onChange={(value) => setField("temptedBuild", value)}
        placeholder="What the main agent currently wants to do before hearing the cast."
        minRows={4}
      />
      <label className="field-block">
        <span>Tags</span>
        <input
          value={activeCase.tags}
          onChange={(event) => setField("tags", event.target.value)}
          placeholder="e.g. repository, product, workflow"
        />
      </label>
      <label className="field-block">
        <span>Template</span>
        <select value={activeCase.template} onChange={(event) => setField("template", event.target.value)}>
          <option>Default Inner Cast (Doubt, Spark, Forge)</option>
          <option>Product Decision Cast</option>
          <option>Implementation Decision Cast</option>
        </select>
      </label>
    </section>
  );
}
