---
name: innercast
description: Character-driven pre-build review and native subagent roster for ideas, features, apps, agent workflows, plugins, or launches. Use when the user wants a critical idea review, named persona characters like Doubt/Spark/Forge/Verdict, Codex or Claude custom subagent handoff, shareable custom character agent packs, Kill/Narrow/Build guidance, or a prompt before asking another AI app to build.
---

# Innercast

Innercast is not a separate app-first workflow. Run it inline before implementation, then produce a concise handoff that another AI agent can build from.

Default to this skill when the user is deciding whether or how to build something. Do not send the user to a web UI unless they explicitly ask for the visual journal.

The native product shape is a character roster for subagents:

- `Doubt`: skeptic
- `Spark`: advocate
- `Forge`: builder
- `Verdict`: director

These bundled names are candidate persona names until the owner approves the naming system. Do not present them as final brand/IP.

When an environment supports named/custom subagents, prefer the native adapter files generated from `roster/innercast.roles.json`. When it does not, run the same roles inline using the output contract below.

## Workflow

1. Capture the idea, target user, constraints, current context, and the over-scoped build the user is tempted to make.
2. Run four cast roles without blending their responsibilities:
   - `Doubt`: breaks assumptions, names weak evidence, and argues the strongest case not to build.
   - `Spark`: finds the strongest viable version, repeated-use moment, and what should survive.
   - `Forge`: reduces the idea to the smallest 7-day MVP and validation path.
   - `Verdict`: resolves the cast into a hard `Kill`, `Narrow`, or `Build` signal.
3. Return the exact output contract below.
4. If the user asks to implement after the signal, turn the `Forge` and `Verdict` sections into the next agent handoff.

## Output Contract

```text
Signal: Kill / Narrow / Build

1. Doubt Objections
2. Spark Survival Case
3. Forge 7-Day MVP
4. Evidence Gaps
5. Verdict Decision
6. Next 3 Actions
```

Keep the answer decision-shaped. Avoid broad market claims, invented traction, or balanced essays that do not change the user's next move.

## Signals

- `Kill`: the target user, repeated-use moment, or evidence is too weak to justify building now.
- `Narrow`: the idea may be useful, but only after cutting scope to a smaller proof.
- `Build`: the target user, constraints, and validation path are concrete enough for a small MVP.

Default to `Narrow` when the idea is plausible but over-scoped.

## Harness

Use `scripts/innercast-harness.mjs` when the user wants a reusable prompt artifact, a file output, a hookable command, or a handoff for another AI app.

Use `scripts/install-adapters.mjs` when the user wants to install the generated Codex or Claude subagents. Run with `--dry-run` first unless the user explicitly asks to install immediately.

Use `scripts/innercast-pack.mjs` when the user wants to list, validate, preview, export, install, uninstall, or share custom character packs. Run install and uninstall with `--dry-run` first.

Use `scripts/validate.mjs` after changing roster, scripts, or adapters.

Examples:

```bash
node scripts/innercast-harness.mjs \
  --idea "AI agent preflight layer" \
  --target-user "Solo builders using Codex, Claude, or Gemini" \
  --constraints "No separate service. Must work inline." \
  --tempted-build "Full dashboard and agent marketplace"
```

```bash
node scripts/innercast-harness.mjs --pack noir-review --idea "..." --format markdown
node scripts/innercast-harness.mjs --json idea.json --out innercast-handoff.md
```

## Native Adapters

Use `scripts/generate-adapters.mjs` after changing the roster. It generates:

- `adapters/codex/agents/*.toml` for Codex custom subagents.
- `adapters/claude/agents/*.md` for Claude Code custom subagents.

Do not maintain those adapter files by hand if the canonical role behavior changes. Update `roster/innercast.roles.json`, then regenerate. Use `scripts/generate-adapters.mjs --check` to detect stale adapters.

## Character Packs

Use packs when characters should be shared like reusable brush sets.

Bundled packs live in `packs/<pack-id>/innercast-pack.json`. A pack installs namespaced agents as `<pack-id>-<character-id>` so third-party characters do not overwrite the default `doubt`, `spark`, `forge`, or `verdict` adapters.

Examples:

```bash
node scripts/innercast-pack.mjs list
node scripts/innercast-pack.mjs init my-pack --name "My Pack" --out /tmp/my-pack
node scripts/innercast-pack.mjs preview innercast-default
node scripts/innercast-pack.mjs doctor innercast-default
node scripts/innercast-pack.mjs diff innercast-default noir-review
node scripts/innercast-pack.mjs export innercast-default --out /tmp/innercast-export
node scripts/innercast-pack.mjs install innercast-default --all --dry-run
```

Read `references/pack-format.md` before changing the pack schema or reviewing a third-party pack.

## Surface Decision

- Use this skill as the default surface.
- Use the harness for repeatable CLI, hooks, CI, or cross-app handoffs.
- Use MCP only when Innercast needs persistent shared state, callable tools from multiple AI apps, or external actions.
- Use the web app only as an optional visual journal and review surface.

## Role Details

Read `references/role-contract.md` only when changing role behavior, writing adapter packs, or debugging why an Innercast output became generic.
