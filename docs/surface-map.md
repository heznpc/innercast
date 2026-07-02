# Innercast Surface Map

Innercast should not start as a separate service users have to visit.

## Default Surface: Native Subagents + Skill

Use `innercast/` as the primary surface.

Why:
- It lives inside the current AI-agent session.
- It can run before implementation without context switching.
- It now includes a canonical character roster plus generated Codex and Claude adapters.
- It makes Doubt, Spark, Forge, and Verdict appear as named persona workers where the host app supports custom subagents.
- It includes shareable character packs, so custom casts can be exchanged without a hosted marketplace.

Files:
- Canonical roster: `innercast/roster/innercast.roles.json`
- Codex adapter: `innercast/adapters/codex/agents/*.toml`
- Claude adapter: `innercast/adapters/claude/agents/*.md`
- User guide: `docs/user-guide.md`
- Installer: `innercast/scripts/install-adapters.mjs`
- Pack manager: `innercast/scripts/innercast-pack.mjs`
- Pack examples: `innercast/packs/*/innercast-pack.json`
- Validator: `innercast/scripts/validate.mjs`

Support:
- Codex: yes, via custom subagent TOML and `nickname_candidates`.
- Claude Code: yes, via `.claude/agents/*.md` frontmatter and agent teams/subagents.
- Gemini or other AI apps: only if they expose a comparable native agent definition surface; otherwise use the harness prompt.

## Shareable Surface: Character Packs

Use `innercast/scripts/innercast-pack.mjs` for Clip Studio-style pack sharing.

Why:
- A pack is just `innercast-pack.json` plus generated adapters.
- Users can publish packs in a repo, zip, or local folder.
- Pack-installed agents are namespaced as `<pack-id>-<character-id>`, preventing accidental overwrites.
- The same pack can export Codex TOML and Claude Markdown adapters.
- `doctor` flags pack-shape risks before install, and `diff` shows character changes between pack versions.

## Repeatable Surface: Harness

Use `innercast/scripts/innercast-harness.mjs` for terminal, hooks, CI, or cross-app handoff generation.

Why:
- It creates the same prompt contract deterministically.
- It can be called from Codex, Claude, Gemini, shell aliases, or repo hooks.
- It does not require a browser or account system.
- It preserves the cast contract when the host app cannot show named subagents.
- It can run `--pack <pack-id-or-path>` so shared character packs affect the actual handoff prompt, not just installation files.

## Optional Surface: Landing + Playground

Use the Pages site and `src/` app only as an optional discovery and review surface.

Why:
- It is useful for saving and comparing prior signals.
- It is not the default workflow.
- It should not be required before asking an AI agent to build.
- It should stay generated from the current roster before any public release.

## Later Surface: MCP

Build an MCP server only after Innercast needs shared state, callable tools, or adapter installation commands.

Good MCP reasons:
- list saved innercasts
- run a cast from multiple AI apps
- install or validate adapter files for Codex and Claude
- export handoffs to local files
- connect the same journal to Codex, Claude, and Gemini

Bad MCP reason:
- wrapping a prompt before the workflow has repeated use
- trying to force character names into a host app UI that does not expose native subagent identity
