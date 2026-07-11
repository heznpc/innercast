# Innercast Pack Format

Use packs when people want to share custom character agents like reusable brush sets.

## File Shape

A pack is a folder containing one file:

```text
my-pack/
└── innercast-pack.json
```

The JSON schema identifier is `innercast.pack.v1`.

Required top-level fields:

- `schema`: must be `innercast.pack.v1`.
- `id`: lowercase letters, numbers, and hyphens. This namespaces installed agents.
- `name`: human-facing pack name.
- `version`: pack version string.
- `description`: short one-line description.
- `characters`: one or more character definitions.

Optional top-level field:

- `author`: public author or handle.
- `namingStatus`: `prototype`, `candidate`, or `approved`.
- `namingNote`: one-line rationale or review note for the current names.
- `protocol`: recommended runtime contract. Legacy v1 packs without it use the
  safe default below and receive a `doctor` warning.

Treat names as not final unless `namingStatus` is `approved`.

## Runtime Protocol

The portable protocol is deliberately narrow:

```json
{
  "protocol": {
    "scope": "current-task",
    "dispatch": "parallel",
    "decisionOwner": "host",
    "contextMode": "shared-decision",
    "synthesisLeadLines": [
      "Decision: <one clear choice>",
      "Confidence: Low / Medium / High"
    ],
    "synthesisSections": [
      "Character Positions",
      "Main Tension",
      "Decision Rationale",
      "Risks Accepted",
      "Next Action"
    ]
  }
}
```

- `scope` must be `current-task`: the cast runs inside the person's current AI
  task rather than creating a separate handoff service.
- `dispatch` must be `parallel`: characters independently examine the same
  brief.
- `decisionOwner` must be `host`: character order never grants final authority.
- `contextMode` must be `shared-decision`: the host passes the same decision
  packet to every character.
- `synthesisLeadLines` defines the host's unnumbered decision and confidence
  fields. Older packs may omit it and receive the engine defaults.
- `synthesisSections` defines the host's final answer structure.

Native hosts may display named workers. Hosts without custom subagents must use
separated inline voices and the same host synthesis contract.

## Character Fields

Each character requires:

- `id`: lowercase character id inside the pack.
- `displayName`: the UI-facing persona name.
- `archetype`: role label.
- `color`: host UI color hint.
- `description`: when to use this character.
- `oneLine`: the character's behavioral thesis.
- `focus`: non-empty string array.
- `rules`: non-empty string array.
- `returnSections`: non-empty string array.

Optional character field:

- `leadLines`: unnumbered lines that appear before numbered return sections.

Allowed colors are `red`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, and `cyan`.

Every character should state that it is one inner voice and not the final
decision maker. A pack that appoints its last character as judge is not a valid
default Innercast execution model, even when that character recommends a
direction.

## Installed IDs

Shared packs install with namespaced agent ids:

```text
<pack-id>-<character-id>
```

For example, `innercast-default` plus `verdict` becomes `innercast-default-verdict`. The visible nickname can still be `Verdict`.

## Commands

```bash
node scripts/innercast-pack.mjs list
node scripts/innercast-pack.mjs init my-pack --name "My Pack" --out /tmp/my-pack
node scripts/innercast-pack.mjs preview innercast-default
node scripts/innercast-pack.mjs validate innercast-default
node scripts/innercast-pack.mjs doctor innercast-default
node scripts/innercast-pack.mjs diff innercast-default noir-review
node scripts/innercast-pack.mjs export innercast-default --out /tmp/innercast-export
node scripts/innercast-pack.mjs install innercast-default --all --dry-run
node scripts/innercast-pack.mjs uninstall innercast-default --all --dry-run
```

Exported packs can include Codex TOML files, Claude Code Markdown files, and Gemini CLI Markdown files. `--all` includes all three native surfaces.

Run install without `--dry-run` only after checking the target file list.
