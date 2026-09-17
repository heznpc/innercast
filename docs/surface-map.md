# Innercast Surface Map

## Intended Product: Native Pets

An Innercast character means a custom pet added to the AI host's built-in
Pets surface. The intended flow is:

```text
Create or customize a character
  -> add it to the host's built-in pet list
  -> observe its reactions in that host
```

This records user intent, not a claim that all host capabilities exist. Pet
format, installation, session signals, and reaction control need independent
verification. Automatic reactions to frustration and direct interactions such
as pinching are separate behaviors. A manually triggered pose does not prove
an automatic session reaction.

The [development harness](development-harness.md) provides startup context and
checks that completion records retain the requested target. Its machine-readable
sources are `harness/product.json` and `harness/handoff.json`.

## Existing Code and Gaps

| Surface | Existing role | What it does not establish |
| --- | --- | --- |
| `innercast/lib/` | Pure schema, compiler, renderers, and budget checks | Pet graphics, installation, or reaction execution |
| `innercast/adapters/` | Generated Codex, Claude Code, and Gemini CLI advisory-agent definitions | A pet appearing in the host's pet list |
| `innercast/SKILL.md` | Existing same-task advisory cast workflow | The complete pet product contract |
| `innercast/packs/` | Existing portable advisory cast definitions | A host-compatible pet asset package |
| `src/` and GitHub Pages | Discovery, download, browser notes, and prompt preview | Native-pet runtime or actual model-generated preview notes |
| Repository harness | Product premise, handoff, and evidence checks | A pet runtime or automatic cross-session memory |
| Native-pet installation | Unverified in this checkout | Do not report shipped without host evidence |
| Session-to-pet reaction bridge | Unverified in this checkout | Do not infer event access or animation control from a sprite alone |

## Advisory-Agent Compatibility

The existing compiler and kit remain usable. One task is the decision space;
advisory agents inspect the decision, and the host retains the final call.
Native named agents and disclosed single-prompt fallback are different
execution modes. The compiler does not call models or collect agent results.

The roster is `innercast/roster/innercast.roles.json`. Generated host adapters
are derived artifacts. Current candidate character names remain candidates.
See `docs/user-guide.md` for existing kit installation and use.

These features are supporting capabilities. Their existence does not redefine
the product as only a deliberation engine.

## Delivery and Acceptance

Current delivery consists of a source repository, an agent-kit ZIP, and a Pages
preview. There is no implemented MCP server or standalone pet application here.
The pet distribution path is not complete merely because the agent installer
or website builds.

For native-pet work, acceptance requires the actual host/version, an installed
character visible in its pet list, and the requested behavior observed there.
Keep source intent, code existence, and runtime evidence separate. If host
support is missing, record the limitation and next verification step. A web
demo or external overlay may be an explicitly scoped experiment, but cannot
silently replace the requested native pet.
