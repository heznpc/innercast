# Innercast repository harness

## Start every task

Run `npm run harness:context` from the repository root (the parent of
`innercast/`). Read its product contract, capability status, and handoff before
planning, coding, or explaining what Innercast is. This is a development
harness; `innercast/scripts/innercast-harness.mjs` is an older prompt CLI.

## Product contract

- **Character means a pet installed in the host's built-in Pets surface.**
  Creating a character, adding it to the host's pet list, and reacting there
  are the intended product experience.
- Agent roles, prompts, the compiler, and the website are existing supporting
  code. They do not redefine the product. In particular, `innercast/SKILL.md`
  describes the existing advisory-cast capability, not the entire product.
- A browser character, separate overlay, or named subagent is not evidence of
  native-pet integration. Never substitute one silently when pet work is asked
  for. Report the missing integration and preserve the requested target.
- Detecting frustration and reacting automatically is distinct from a user
  clicking a button. Pinching is a separate interaction, not its prerequisite.
- Product intent is not a claim that the host supports it. Verify pet format,
  installation, available events, and animation control independently.
- The current user request takes precedence. `harness/product.json` records
  user intent separately from implementation evidence and harness defaults.
  Treat historical reports as leads, not proof. Do not ask the user to repeat
  the premise already recorded here.

## Work and handoff

1. Keep the requested surface explicit. For pet work use `native-pet`.
2. Update `harness/handoff.json` with this task's scope, observed results,
   remaining work, and the next concrete action. Keep pet integration gaps
   separate from completion of supporting work.
3. Run `npm run check`. Its harness check rejects mismatched target surfaces
   and completion without a run record. A test or web preview alone cannot
   establish native-pet completion.
4. For a completed task, record the actual command or host interaction, observed
   result, and a repository-relative evidence file. Native-pet completion also
   requires host/version, installation, host-list visibility, and the requested
   behavior observed in that host. The validator checks the record's structure;
   the agent must actually inspect the evidence and perform the interaction.
5. Commit and push the handoff with the code. A fork or existing worktree does
   not acquire new commits automatically. At the next task, inspect remote
   changes and integrate relevant harness updates without overwriting local
   work. Do not claim another task has received context without checking it.

See `docs/development-harness.md` for commands and limitations. Keep internal
conversation links, machine paths, personal data, and credentials out of
committed evidence. Do not alter global agent configuration for this harness.
