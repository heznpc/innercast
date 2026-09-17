# Innercast

Innercast's intended product is custom characters added to the AI host's
built-in **Pets** surface, where they react to the user and session.

**Implementation status:** this repository currently contains an advisory-agent
compiler, installable agent configurations, and a browser preview. Native-pet
installation and session-driven pet reactions are **unverified** here. An agent
configuration or a browser character is not a completed native-pet integration.

For development, run `npm run harness:context` first. The
[development harness](docs/development-harness.md) records product intent,
capability evidence, and the handoff for the next task. The
[surface map](docs/surface-map.md) separates that intent from existing code.

## Existing Advisory-Agent Capability

One user-owned task is the decision space. Stable named character agents enter
that task as an inner cast, examine the same decision from different
perspectives, and report back. The root or main agent weighs the disagreement
and makes the final call.

The existing advisory cast includes:

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

The repository contains the existing agent adapter kit, a multilingual discovery
page and browser-only preview, and a repository development harness. The web
copy and advisory skill still describe the agent kit; they are not a pet release.

## Repository Layout

```text
innercast/lib/              Pure schema, compiler, renderers, budgets, and host registry
innercast/index.mjs         Host-independent public core entry point
innercast/scripts/          Node CLI, generator, installer, pack tools, and validators
innercast/adapters/         Generated host-native agent definitions
docs/user-guide.md          Installation and runtime usage
docs/surface-map.md         Product boundary and support tiers
src/landing/                Landing page and multilingual copy
src/workspace/              Case state, sidebar, cast preview, and decision journal
src/session-prompt.mjs      Browser input mapping into the shared compiler and renderer
src/utils/                  Browser clipboard and download helpers
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

The session prompt uses the canonical roster, compiler, budget checks, and
execution-prompt renderer used by the CLI. It includes all host targets; the
receiving host chooses its available native adapter or discloses fallback mode.
The short voice cards remain illustrative local preview notes, not model output.
Saved prompts stay snapshots until **Refresh prompt** is selected. If prompt
generation fails validation or exceeds the budget, the draft remains editable
with prompt copying and export disabled until a valid prompt can be generated.

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

The intended user experience is to create a character, add it to the host's
built-in pet list, and observe its behavior there. Host support for installation,
session signals, and reaction control must be verified independently.

The existing adapter engine compiles advisory-agent definitions. The Pages site
provides discovery, download, and a lightweight prompt preview. Neither surface
establishes native-pet integration. No MCP server or standalone pet application
is implemented by this repository.

See the [development harness](docs/development-harness.md) before choosing an
implementation target. Keep an unavailable host integration explicit instead
of silently substituting a web demo or separate overlay.

## Language Policy

The README remains English-only. The landing page currently supports English,
Korean, and Japanese.

## License

No open-source license has been selected yet. Until a license is added, this
repository is public source, but reuse and redistribution are not granted by
default.
