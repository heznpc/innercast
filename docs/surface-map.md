# Innercast Surface Map

Innercast is an internal character engine for an existing AI task, not a
separate review destination.

## Core Experience

The product model is:

1. One user-owned AI task is the decision space.
2. Stable named character agents enter as distinct advisory voices.
3. The characters inspect the same decision independently.
4. The root or main agent identifies disagreements and makes the final call.
5. Work continues in the same user task.

“Same task” does not mean every host shares one literal model-context window.
Codex, Claude Code, Gemini CLI, and future hosts may isolate subagents in child
threads or worker contexts. The invariant is that the user does not have to
move the decision into a separate Innercast session, and decision ownership
returns to the root or main agent.

## Internal Engine

The adapter engine separates the portable character contract from host-specific
files:

```text
Canonical character contract
  -> explicit host selection + capability metadata
  -> adapter rendering
  -> execution plan and prompts
```

The current core stops at compilation. It does not detect a running AI app,
invoke a provider, collect character reports, or execute root synthesis. A host
or future executor owns those runtime steps.

The portable contract should preserve:

- stable character id and display-name candidates
- perspective and behavioral instructions
- tool and permission boundaries where the host exposes them
- input context and output shape
- advisory status
- root/main decision ownership

The host adapter owns syntax and invocation details. It must not silently claim
capabilities that the host does not provide.

## Default Surface: Native Character Agents

Use `innercast/` as the primary surface.

Current generated adapter targets:

- Codex: `innercast/adapters/codex/agents/*.toml`
- Claude Code: `innercast/adapters/claude/agents/*.md`
- Gemini CLI: `innercast/adapters/gemini/agents/*.md`

The canonical roster remains at
`innercast/roster/innercast.roles.json`. Candidate display names must remain
marked as candidates until approved.

Where a host supports named custom agents, Innercast should use that native
surface. This is the highest-fidelity experience because characters can be
separate workers and may be visible by name in the host UI.

## Compatibility Surface: Explicit Fallback

For an AI host without comparable custom agents, the engine may generate one
prompt that asks the model to render separated character sections.

Fallback mode must disclose that:

- no native named subagents were invoked
- the host may be using one model sequentially
- character identity may not appear in the UI
- parallelism and context isolation are not guaranteed

The fallback preserves the decision ritual, not native-agent equivalence.

## Shareable Surface: Character Packs

Use `innercast/scripts/innercast-pack.mjs` for local, repository, or archive
based character packs.

A pack provides a portable cast definition. Generated adapters remain derived
artifacts. Namespaced ids such as `<pack-id>-<character-id>` prevent downloaded
packs from overwriting default agents.

Useful commands include:

- `init` and `validate` for authoring
- `doctor` for name and contract risks
- `diff` for reviewing pack changes
- `export` and `install` for host-specific output

A pack marketplace is not required for the core workflow.

## Optional Surface: Landing Page and Playground

The Pages site and `src/` app are discovery and preview surfaces.

They may:

- explain the character model
- show the supported runtime tiers
- preview the default cast
- generate a prompt for the current AI task
- link to the local engine kit

They must not imply that browser-generated notes came from live native
subagents. The real character experience belongs inside the user's AI runtime.

## Optional Future Surface: MCP or Hosted Coordination

Add MCP or hosted coordination only if a repeated workflow needs shared state
or remote invocation across tools.

Potentially valid reasons:

- list and validate installed casts from multiple hosts
- maintain an opt-in shared decision journal
- invoke a cast through a host that exposes agent orchestration only by API
- inspect adapter compatibility

Invalid reasons:

- moving every decision into a separate Innercast chat
- treating prompt wrapping as a service
- claiming native character identity on a host that does not expose it
- assigning final authority to a character instead of the root or main agent

## Non-Goals

- a generic custom-agent marketplace
- a pre-build handoff gate
- a security or content-taint wrapper
- a requirement to leave the current AI task
- identical UI behavior across every AI product
