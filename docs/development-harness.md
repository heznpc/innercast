# Innercast Development Harness

This harness keeps product intent and implementation evidence available to the
next coding task. It does not execute pets or replace the host's runtime.

## Start

From the repository root, run:

```sh
npm run harness:context
```

The command prints the pet-first product contract, existing capabilities,
unverified integrations, current task handoff, branch, and commit. It reads
files relative to the script, so the direct command also works from `innercast/`:

```sh
node ../scripts/project-harness.mjs context
```

`AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` direct coding agents here. They do not
install a plugin or change any global configuration. A host must actually load
its project instructions; this harness cannot force an arbitrary AI to do so.

## Durable context

- `harness/product.json`: user intent, separately identified harness defaults,
  and capability status with repository evidence references.
- `harness/handoff.json`: current scope, requested and delivered surfaces,
  runtime observations, remaining work, product gaps, and the next action.
- `docs/surface-map.md`: intended product versus existing supporting code.

Keep each update in the same commit as the relevant code or verification.
When marking a native-pet capability `implemented`, add its `verification`
field pointing to a completed native-pet handoff JSON record as well as its
`evidence` files. A source file alone does not establish that integration.
Use repository paths for evidence; do not publish private task URLs, home
directories, personal data, or credentials. Files and previous AI conclusions
are records to check, not higher authority than the current user request.

Existing forks and worktrees retain their own files. Fetch and inspect changes
at task start, then merge or cherry-pick the relevant harness commit after
checking local edits. Reading another conversation does not synchronize its
checkout; this harness does not provide cross-session memory synchronization.

## Completion check

```sh
npm run harness:check
node scripts/project-harness.mjs verify path/to/handoff.json
```

`check` validates the product contract, startup entry points, and current
handoff. It runs in `npm run check`, including CI. `verify` validates another
handoff record without replacing the current one.

Handoff fields are illustrated by `harness/handoff.json`. Status is one of
`in-progress`, `partial`, `blocked`, or `complete`. A completed task requires
matching requested/delivered surfaces, no task-specific remaining work, and at
least one runtime observation on the requested surface. Supporting work can be
complete while `productGaps` still lists missing pet integration.

Each runtime observation uses:

```json
{
  "surface": "native-pet",
  "kind": "runtime",
  "action": "Describe the exact host interaction performed.",
  "observed": "Describe what actually happened.",
  "evidence": "harness/evidence/actual-observation.txt",
  "host": "Actual host and version",
  "checks": {
    "installed": true,
    "visibleInHost": true,
    "requestedBehaviorObserved": true
  }
}
```

For other surfaces, `host` and `checks` are unnecessary. `kind: "test"` may
record test evidence but cannot establish runtime completion. Evidence files
must exist inside the repository and contain data. Placeholders in this example
are not proof. A web preview cannot satisfy a `native-pet` request, even if it
looks correct. If integration is unavailable, retain `native-pet` as the
requested surface and report partial or blocked work with the missing step.

This is a structural gate, not a semantic judge. It cannot tell whether a
screenshot truly shows the pet or an observation is honest. The agent must
perform and inspect the interaction. Passing `harness:check` means the records
are consistent, not that the native-pet product is complete.

## Existing prompt harness

`innercast/scripts/innercast-harness.mjs` is a compatibility CLI for the advisory
agent compiler. It remains operational. It is not this repository workflow and
does not install or execute pets.
