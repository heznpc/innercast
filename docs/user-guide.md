# Innercast User Guide

Innercast installs a stable character roster into supported AI runtimes. The
characters deliberate inside the current user task; the root or main agent
retains the final decision.

The bundled names are candidates until explicitly approved. Run `doctor` before
treating any pack's names as final brand or IP.

| Character | Perspective | Advisory job |
| --- | --- | --- |
| Doubt | Skeptic | Challenges assumptions, risks, and reasons to stop. |
| Spark | Advocate | Protects the strongest possibility worth pursuing. |
| Forge | Builder | Produces the smallest executable next move. |

## Mental Model

Think of the current AI task as the decision owner and the characters as its
recognizable internal voices:

```text
current user task
  -> Doubt report
  -> Spark report
  -> Forge report
  -> root/main synthesis and final decision
```

Hosts may use child threads or isolated worker contexts behind the scenes. The
user-facing workflow still remains in the current task rather than moving into
a separate Innercast session.

## Quick Start

From the `innercast` folder:

```bash
node scripts/validate.mjs
node scripts/package-kit.mjs
node scripts/innercast-engine.mjs \
  --input examples/sample-decision.json \
  --platform codex \
  --format markdown
```

Inspect the generated prompt. It should keep each character's work separate and
reserve the final decision for the root or main agent.

Preview installation before writing host configuration:

```bash
node scripts/install-adapters.mjs --all --dry-run
node scripts/install-adapters.mjs --all
```

If a target file already exists with different content, the installer stops.
Use `--force` only when replacing that file is intentional.

## Embed the Core

`innercast/index.mjs` is a pure JavaScript entry point for an app or future
executor. The caller supplies the roster object; the core does not read files,
call a provider, or require Node APIs.

```js
import {
  compileCastPlan,
  createDefaultHostRegistry,
  evaluateExecutionBudget,
} from "./index.mjs";

const plan = compileCastPlan({
  decision: "Should we continue?",
  context: "Known evidence",
  castDefinition: roster,
  platform: "claude",
  hostRegistry: createDefaultHostRegistry(),
});

const budget = evaluateExecutionBudget(plan);
```

This is compilation, not execution. A runtime adapter must still dispatch the
character prompts, collect their outputs, apply timeouts or partial-failure
policy, and run root synthesis.

Undo a matching install:

```bash
node scripts/install-adapters.mjs --all --uninstall --dry-run
node scripts/install-adapters.mjs --all --uninstall
```

## Run in Codex

Install the Codex adapters:

```bash
node scripts/install-adapters.mjs --codex
```

Then ask inside the task that owns the decision:

```text
Run Innercast on this decision. Invoke Doubt, Spark, and Forge as
separate advisory subagents in this task. Keep their reports independent.
After they return, the main agent must compare the disagreements and make the
final decision; do not delegate final authority to any character.
```

Codex adapters are generated in `adapters/codex/agents/*.toml`. Their
`nickname_candidates` values request stable visible names, but host UI behavior
remains controlled by Codex.

## Run in Claude Code

Install the Claude Code adapters:

```bash
node scripts/install-adapters.mjs --claude
```

Use this inside the current Claude Code task:

```text
Use the installed Doubt, Spark, and Forge agents as independent
advisers on this decision. Gather all reports, surface their disagreements, and
then make the final call in the main conversation.
```

Claude Code adapters are generated in `adapters/claude/agents/*.md`.

## Run in Gemini CLI

Install the Gemini CLI adapters:

```bash
node scripts/install-adapters.mjs --gemini
```

Use this inside the current Gemini CLI task:

```text
Run the installed Innercast characters on this decision. Keep each character's
report distinct, then have the main agent synthesize and decide.
```

Gemini CLI adapters are generated in `adapters/gemini/agents/*.md`. The current
adapter target invokes each one through `invoke_agent` with its `agent_name`
and character prompt. Visible-name behavior may still depend on the installed
Gemini CLI version.

## Generic Prompt Fallback

For a host without native custom agents:

```bash
node scripts/innercast-engine.mjs \
  --platform generic \
  --decision "..." \
  --context "..." \
  --constraints "..." \
  --stakes "..." \
  --format prompt
```

Generic mode preserves separated character contracts in one prompt. It cannot
guarantee native subagents, parallel execution, isolated contexts, or visible
character names. The generated output should identify itself as prompt fallback
rather than implying native-agent execution.

## Expected Decision Shape

```text
Decision: <one clear choice>
Confidence: Low / Medium / High

1. Character Positions
2. Main Tension
3. Decision Rationale
4. Risks Accepted
5. Next Action
```

Other packs may define a different decision protocol while preserving character
separation and root/main ownership.

## Share Character Packs

Packs can live in a repository, zip archive, or local folder:

```text
packs/my-pack/innercast-pack.json
```

Create and validate a starter pack:

```bash
node scripts/innercast-pack.mjs init my-pack --name "My Pack" --out /tmp/my-pack
node scripts/innercast-pack.mjs validate /tmp/my-pack
node scripts/innercast-pack.mjs doctor /tmp/my-pack
```

List, preview, and compare bundled packs:

```bash
node scripts/innercast-pack.mjs list
node scripts/innercast-pack.mjs preview innercast-default
node scripts/innercast-pack.mjs diff innercast-default noir-review
```

Export or install only after reviewing the pack:

```bash
node scripts/innercast-pack.mjs export innercast-default --out /tmp/innercast-default
node scripts/innercast-pack.mjs install innercast-default --all --dry-run
node scripts/innercast-pack.mjs install innercast-default --all
```

Shared packs use namespaced agent ids such as
`innercast-default-doubt`, while the requested visible nickname can remain
`Doubt`. Namespacing prevents a downloaded pack from silently overwriting the
default adapter.

## Fidelity Levels

Before claiming support for a new AI host, classify the adapter honestly:

1. **Native:** separate character agents are supported by the host.
2. **Orchestrated:** independent agent calls are possible, but character names
   may not appear in the host UI.
3. **Fallback:** one prompt renders separated voices without native agents.

“Works with every AI” should mean that a disclosed fallback can preserve the
ritual. It must not mean identical agent behavior on every host.
