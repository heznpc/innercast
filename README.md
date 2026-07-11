# Innercast

Innercast is a character engine for AI work.

One user-owned task is the decision space. Stable named character agents enter
that task as an inner cast, examine the same decision from different
perspectives, and report back. The root or main agent weighs the disagreement
and makes the final call.

The bundled cast currently includes:

| Character | Perspective | Advisory job |
| --- | --- | --- |
| Doubt | Skeptic | Challenges assumptions, risks, and the urge to rush. |
| Spark | Advocate | Protects the strongest possibility worth pursuing. |
| Forge | Builder | Turns the surviving direction into an executable next move. |

The character outputs are advisory. No character replaces the root or main
agent as decision owner.

The bundled character names remain candidates until the naming system is
explicitly approved. The kit preserves that status in its roster and pack
metadata.

## What the Adapter Engine Does

Innercast defines a character once and renders that contract for each host:

```text
Character contract
  -> Codex custom-agent adapter
  -> Claude Code agent adapter
  -> Gemini CLI agent adapter
  -> explicit generic prompt fallback
```

The engine preserves the character's identity, perspective, instructions, and
output contract. It does not pretend that every host has the same agent model.
It compiles plans and configuration; it does not call a model or collect agent
results by itself.

| Host capability | Innercast experience |
| --- | --- |
| Native named subagents | Characters run as host-native agents and may appear by name in the host UI. |
| Agent orchestration without named UI | Characters can run independently, but the host may not display their identities. |
| Single-agent prompting | One model renders separated character voices in disclosed fallback mode. |

“One task” describes the user experience and decision ownership. A host may
implement subagents as child threads or isolated contexts internally; Innercast
does not claim that their model context is literally shared.

## Repository Status

This is the public source repository for Innercast:

- Repository: <https://github.com/heznpc/innercast>
- GitHub Pages: <https://heznpc.github.io/innercast/>
- Default branch: `main`

The repository contains the adapter kit source plus a multilingual discovery
page and browser-only preview.

## Repository Layout

```text
innercast/lib/              Pure schema, compiler, renderers, budgets, and host registry
innercast/index.mjs         Host-independent public core entry point
innercast/scripts/          Node CLI, generator, installer, pack tools, and validators
innercast/adapters/         Generated host-native agent definitions
docs/user-guide.md          Installation and runtime usage
docs/surface-map.md         Product boundary and support tiers
src/                        Multilingual landing page and browser preview
public/innercast-kit.zip    Downloadable kit artifact for the Pages site
.github/workflows/          GitHub Pages deployment and validation workflow
```

Use the host-independent core from JavaScript without Node filesystem imports:

```js
import { compileCastPlan, evaluateExecutionBudget } from "./innercast/index.mjs";

const plan = compileCastPlan({
  decision: "Should we ship?",
  castDefinition: roster,
  platform: "generic",
});

const budget = evaluateExecutionBudget(plan);
```

The Node CLI performs a projected prompt-budget check before it materializes
large repeated character prompts. Normal CLI output remains byte-compatible
with the pre-refactor engine.

## Run Locally

```bash
npm install
npm run dev -- --port 5176
```

Open `http://127.0.0.1:5176/`.

The browser app previews the cast contract and creates a current-task session
prompt. It does not claim to run live native subagents in the browser.

Compile a host-specific execution plan without calling a model:

```bash
cd innercast
node scripts/innercast-engine.mjs \
  --input examples/sample-decision.json \
  --platform codex \
  --format markdown
```

## Validate

Run the adapter-kit validator:

```bash
npm run validate:innercast
```

Run validation, packaging, and the production site build:

```bash
npm run check
```

Rebuild the downloadable kit archive:

```bash
npm run package:innercast
```

## Installable Kit

The installable source lives in `innercast/`. The packaged archive contains the
canonical roster, generated host adapters, character-pack examples, and local
management scripts.

Current adapter surfaces:

- Codex: `adapters/codex/agents/*.toml`
- Claude Code: `adapters/claude/agents/*.md`
- Gemini CLI: `adapters/gemini/agents/*.md`
- Other hosts: disclosed generic prompt fallback

See [the user guide](docs/user-guide.md) for dry-run installation and runtime
examples.

## Product Boundary

Innercast is not a separate deliberation service and does not require moving a
decision into another chat. Its primary experience stays inside the AI task
where the work already exists.

The adapter engine is the reusable core. The Pages site is only for discovery,
documentation, download, and a lightweight preview. A hosted service or MCP
server is optional future infrastructure, not the product premise.

## Language Policy

The README remains English-only. The landing page currently supports English,
Korean, and Japanese.

## License

No open-source license has been selected yet. Until a license is added, this
repository is public source, but reuse and redistribution are not granted by
default.
