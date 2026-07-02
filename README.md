# Innercast

Innercast is a character-driven pre-build review layer for AI agent workflows.

It gives an idea four named persona agents before the idea is handed to Codex,
Claude, Gemini, or another AI builder:

| Persona | Role | Job |
| --- | --- | --- |
| Doubt | Skeptic | Challenges assumptions and names reasons not to build. |
| Spark | Advocate | Finds the strongest viable version and repeated-use moment. |
| Forge | Builder | Cuts the surviving idea down to a 7-day proof. |
| Verdict | Director | Resolves the run into Kill, Narrow, or Build. |

The bundled persona names are still candidate names until the naming system is
approved. The current product contract keeps that status visible inside the
installable kit.

## Repository Status

This is the public source repository for Innercast:

- Repository: <https://github.com/heznpc/innercast>
- GitHub Pages: <https://heznpc.github.io/innercast/>
- Default branch: `main`

The repository contains both the multilingual landing page and the installable
Innercast kit source.

## Repository Layout

```text
innercast/                  Skill, roster, adapters, pack tools, and validator
docs/user-guide.md          User guide for installing and running Innercast
docs/surface-map.md         Surface and product-boundary notes
src/                        Multilingual landing page and local playground
public/innercast-kit.zip    Downloadable kit artifact for the Pages site
.github/workflows/          GitHub Pages deployment and validation workflow
```

## Run Locally

```bash
npm install
npm run dev -- --port 5176
```

Open:

```text
http://127.0.0.1:5176/
```

## Validate

Run the Innercast kit validator:

```bash
npm run validate:innercast
```

Run the site build and kit validator:

```bash
npm run check
```

Run the production build only:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview -- --port 4176
```

## Installable Kit

The source of the installable kit lives in `innercast/`.

The current Pages download is `public/innercast-kit.zip`. It contains:

- `SKILL.md`
- `roster/innercast.roles.json`
- Codex adapters in `adapters/codex/agents/*.toml`
- Claude Code adapters in `adapters/claude/agents/*.md`
- pack examples in `packs/*/innercast-pack.json`
- management scripts in `scripts/*.mjs`

Validate the source kit before publishing a new archive:

```bash
npm run validate:innercast
```

## GitHub Pages

The Pages workflow is included at:

```text
.github/workflows/deploy-pages.yml
```

The workflow runs:

1. `npm ci`
2. `npm run validate:innercast`
3. `npm audit --audit-level=moderate`
4. `npm run build`
5. GitHub Pages artifact upload and deploy

The Vite build uses a relative base path, so it works for both user/org pages
and project pages.

## Language Policy

The README stays English-only.

The landing page supports multiple languages inside the app. Current landing
locales:

- English
- Korean
- Japanese

## Product Boundary

Innercast should not require users to visit a separate hosted service for the
default workflow. The primary surface is the native agent layer:

- Codex custom subagents
- Claude Code custom agents
- prompt handoff for other AI apps
- shareable character packs

The Pages site is for discovery, documentation, and a lightweight playground.

## License

No open-source license has been selected yet. Until a license is added, this
repository is public source, but reuse and redistribution are not granted by
default.
