---
name: innercast
description: Run a same-task decision cast where stable named subagents act as recurring inner characters, examine one decision in parallel, and return their positions to the host agent for final synthesis. Use for personal, product, technical, creative, or operational decisions; character packs; native Codex, Claude, or Gemini adapters; and portable inline fallback.
---

# Innercast

Innercast turns disposable subagents into a recurring inner cast.

The host task is the person. Named subagents are inner characters with stable
perspectives. They examine the same decision packet in parallel, then return
their positions to the host. The host owns the final decision and user-facing
answer.

Innercast is not a separate service, cross-session handoff, or hidden model
gateway. Keep the full decision loop inside the current host task. Use native
subagents where the host supports them and separated inline voices elsewhere.

## Default Cast

- `Doubt`: caution — exposes weak evidence, downside, and veto conditions.
- `Spark`: possibility — protects meaningful upside and the smallest choice
  worth making.
- `Forge`: agency — maps feasible paths, tradeoffs, and a reversible first move.

These names remain candidates until the owner approves the naming system. Do
not present them as final brand or IP.

## Runtime Contract

1. Capture one decision packet:
   - the decision or question;
   - current context and known evidence;
   - constraints;
   - stakes and reversibility.
2. In a host with named subagents, spawn `Doubt`, `Spark`, and `Forge` in
   parallel with the same decision packet. Do not blend their prompts.
3. Wait for every character. Each character returns only its own position and
   recommendation. No character may claim final authority.
4. The host compares the positions, names the real tension, decides, and states
   what risk it accepts.
5. If native subagents are unavailable, simulate the same characters as clearly
   separated voices, then perform the same host synthesis.

Do not spawn a separate `Verdict` worker. The final decision belongs to the
current host task—the person represented by the session.

## Host Output Contract

```text
Decision: <one clear choice>
Confidence: Low / Medium / High

1. Character Positions
2. Main Tension
3. Decision Rationale
4. Risks Accepted
5. Next Action
```

Do not return a balanced essay or silently average the characters. A strong
answer explains which voice was decisive, which warning was accepted, and what
the person will do next.

## Engine

Use `scripts/innercast-engine.mjs` when the user wants a deterministic execution
plan, host-specific orchestration prompt, JSON artifact, hookable command, or
portable fallback.

The reusable, host-independent API is exported from `index.mjs`. Its pure
modules are split into `lib/schema.mjs`, `lib/compiler.mjs`, and
`lib/renderers.mjs`; host syntax lives in `lib/host-adapters.mjs`. The core does
not call models. `lib/budget.mjs` measures aggregate prompt cost, and the Node
CLI rejects an oversized projected plan before materializing repeated prompts.

```bash
node scripts/innercast-engine.mjs \
  --decision "Should we ship this change today?" \
  --context "Tests pass; one migration remains unproven" \
  --constraints "No irreversible production changes" \
  --stakes "A bad release affects existing users" \
  --platform codex \
  --format markdown
```

`scripts/innercast-harness.mjs` remains the compatibility entry point for older
`--idea`, `--target-user`, and `--tempted-build` calls, but it must compile to
the same current-task runtime contract.

## Native Adapters

The canonical roster lives in `roster/innercast.roles.json`. Generate, never
hand-edit, the host files:

- `adapters/codex/agents/*.toml`
- `adapters/claude/agents/*.md`
- `adapters/gemini/agents/*.md`

Run:

```bash
node scripts/generate-adapters.mjs --check
node scripts/install-adapters.mjs --all --dry-run
node scripts/install-adapters.mjs --all
```

The adapter engine preserves character identity, perspective, output contract,
and host decision ownership. It does not promise identical UI on every AI
surface: native where available, inline fallback elsewhere.

## Character Packs

Use packs to share alternative inner casts. A pack must preserve the same-task
protocol and keep `decisionOwner` set to `host`. Character array order never
grants final authority.

```bash
node scripts/innercast-pack.mjs list
node scripts/innercast-pack.mjs doctor innercast-default
node scripts/innercast-pack.mjs export innercast-default --out /tmp/innercast-export
node scripts/innercast-pack.mjs install innercast-default --all --dry-run
```

Read `references/pack-format.md` before changing the schema or reviewing a
third-party pack. Read `references/role-contract.md` before changing the
default character behavior.

## Verification

After changing the engine, roster, adapters, packs, or skill:

```bash
node scripts/generate-adapters.mjs --check
node scripts/validate.mjs
```

Use MCP only if a future Innercast feature truly requires persistent shared
state or external actions. A hosted dashboard is optional discovery material,
not the runtime.
