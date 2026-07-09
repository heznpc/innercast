# Innercast User Guide

Innercast is a character roster for multi-agent coding sessions. It makes the subagents in Codex, Claude Code, or Gemini CLI show up as a reusable cast:

The bundled character names are candidate persona names until explicitly approved. Use `doctor` before treating any pack's names as brand/IP.

| Character | Role | Job |
| --- | --- | --- |
| Doubt | Skeptic | Breaks assumptions and names reasons not to build. |
| Spark | Advocate | Finds the strongest viable version. |
| Forge | Builder | Cuts the idea to a 7-day MVP. |
| Verdict | Director | Returns Kill, Narrow, or Build. |

## Quick Start

From the `innercast` folder:

```bash
node scripts/validate.mjs
node scripts/package-kit.mjs
node scripts/innercast-harness.mjs --json examples/sample-idea.json --format markdown
```

If the sample prints `Signal: Kill / Narrow / Build` followed by Doubt, Spark, Forge, and Verdict sections, the local contract is intact.

Install only after the local smoke run:

```bash
node scripts/install-adapters.mjs --all --dry-run
node scripts/install-adapters.mjs --all
```

If any target file already exists with different content, the installer stops. Re-run with `--force` only when overwriting is intentional.

Undo a matching install:

```bash
node scripts/install-adapters.mjs --all --uninstall --dry-run
node scripts/install-adapters.mjs --all --uninstall
```

## Share Character Packs

Innercast packs are folders that can be shared through GitHub, zip files, or a private folder:

```text
packs/my-pack/innercast-pack.json
```

Create a starter pack:

```bash
node scripts/innercast-pack.mjs init my-pack --name "My Pack" --out /tmp/my-pack
node scripts/innercast-pack.mjs validate /tmp/my-pack
```

List and inspect bundled packs:

```bash
node scripts/innercast-pack.mjs list
node scripts/innercast-pack.mjs preview innercast-default
node scripts/innercast-pack.mjs preview noir-review
```

Validate and export a pack:

```bash
node scripts/innercast-pack.mjs validate innercast-default
node scripts/innercast-pack.mjs doctor innercast-default
node scripts/innercast-pack.mjs export innercast-default --out /tmp/innercast-default
```

Compare two packs before updating:

```bash
node scripts/innercast-pack.mjs diff innercast-default noir-review
```

Install a pack only after checking the dry-run output:

```bash
node scripts/innercast-pack.mjs install innercast-default --all --dry-run
node scripts/innercast-pack.mjs install innercast-default --all
```

Shared packs install namespaced agent ids such as `innercast-default-doubt`, while the visible nickname remains `Doubt`. That prevents a downloaded character pack from overwriting the default adapters.
If `doctor` reports `namingStatus: candidate`, the names are not final.

## Install Only One Surface

Codex agents:

```bash
node scripts/install-adapters.mjs --codex
```

Claude Code agents:

```bash
node scripts/install-adapters.mjs --claude
```

Gemini CLI agents:

```bash
node scripts/install-adapters.mjs --gemini
```

Codex skill:

```bash
node scripts/install-adapters.mjs --skill
```

## Use In Codex

```text
Run Innercast. Spawn Doubt, Spark, Forge, and Verdict as separate subagents if available, then have Verdict return the final Kill/Narrow/Build signal.
```

Codex uses the generated files in `adapters/codex/agents/*.toml`. Each file sets `nickname_candidates` to the character's display name.

## Use In Claude Code

```text
Use the doubt, spark, forge, and verdict agents to run Innercast on this idea. Keep their findings separate, then have Verdict return Kill/Narrow/Build.
```

Claude Code uses the generated files in `adapters/claude/agents/*.md`.

## Use In Gemini CLI

```text
Run Innercast. If the agents are installed, invoke @doubt, @spark, @forge, and @verdict separately. Keep the first three findings separate, then ask @verdict for Kill/Narrow/Build.
```

Gemini CLI uses the generated files in `adapters/gemini/agents/*.md`.

## Generic Prompt Handoff

For an AI app without native custom subagents:

```bash
node scripts/innercast-harness.mjs \
  --adapter generic \
  --idea "..." \
  --target-user "..." \
  --constraints "..."
```

Generic mode preserves the cast behavior, but cannot force the host app's UI to show the character names.

Run a handoff with a shared character pack:

```bash
node scripts/innercast-harness.mjs \
  --pack noir-review \
  --adapter codex \
  --idea "..." \
  --format markdown
```

When `--pack` is used, the handoff includes the pack's character contracts and namespaced agent ids such as `noir-review-suspicion`.

## Output Shape

```text
Signal: Kill / Narrow / Build

1. Doubt Objections
2. Spark Survival Case
3. Forge 7-Day MVP
4. Evidence Gaps
5. Verdict Decision
6. Next 3 Actions
```
