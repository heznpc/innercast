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

This repository is the GitHub Pages landing site and local playground for
Innercast. The installable agent skill and generated adapters live in
`../innercast/` in the current workspace export.

## Repository Status

This folder is repo-ready, but it is not connected to a GitHub remote yet.

Expected public repository shape:

```text
README.md                 English-only project README
src/                      Multilingual landing page and local playground
public/                   Static downloadable artifacts
.github/workflows/        GitHub Pages deployment workflow
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

## Build

```bash
npm run build
```

Preview the production build:

```bash
npm run preview -- --port 4176
```

## GitHub Pages

The Pages workflow is already included at:

```text
.github/workflows/deploy-pages.yml
```

After pushing this folder as a GitHub repository:

1. Set the default branch to `main`.
2. Enable GitHub Pages with "GitHub Actions" as the source.
3. Push to `main` or run the workflow manually.

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

Innercast should not require users to visit a separate service for the default
workflow. The primary surface is still the native agent layer:

- Codex custom subagents
- Claude Code custom agents
- Prompt handoff for other AI apps
- Shareable character packs

The Pages site is for discovery, documentation, and a lightweight playground.

## Related Workspace Artifacts

```text
../innercast/                    Current skill, roster, pack tools, adapters
../innercast-user-guide.md        User guide for installing and running Innercast
../innercast-surface-map.md       Surface and product boundary notes
../innercast-kit.zip              Full export bundle
../innercast-skill.zip            Skill-only export bundle
```
