# AGENTS.md

## Models

- Prefer `gpt-5-codex`. If unavailable, state the active model and limitations.

## Agent conduct

- Verify assumptions before executing commands; call out uncertainties first.
- Ask for clarification when the request is ambiguous, destructive, or risky.
- Summarize intent before performing multi-step fixes so the user can redirect early.
- Cite the source when using documentation; quote exact lines instead of paraphrasing from memory.
- Break work into incremental steps and confirm each step with the smallest relevant check before moving on.

## Documentation and MCP

- Fetch minimal targeted docs. Summarize inline; do not paste dumps.
- When API uncertainty remains, produce a runnable repro snippet and verify locally.
- If the needed documentation cannot be found, say so explicitly and explain the fallback approach.

## Global Codex Guidance

Applies to every Codex session in this workspace; defer to deeper repo or subdirectory `AGENTS.md` files when they provide more specific instructions.

## How to use this file

- Skim once at the start of a session to align on local policies.
- Follow project or folder `AGENTS.md` files for task-specific commands and nuances.
- Ask the user when instructions conflict or feel unsafe.

## Operating mode

- Host: untouched unless the user explicitly requests host changes.
- Execution: run deterministically, show diffs, prefer the smallest verifiable unit (`lint`, `typecheck`, `test`). Stop on failure.
- Sensitive files: never touch `.env`, secrets, infra config, or production data without explicit instruction.

## UI implementation defaults

- For mobile UI work, treat `/Users/ChandraShekar.Nallamilli/tokens/HLD/ux-design.md` and the user's screenshots/feedback as the source of truth.
- Default visual direction is dark-first and trust-first. Do not switch core flows between dark sign-in and light app shells unless the user explicitly asks for that change.
- Palette direction is deep indigo + electric violet + emerald. Do not introduce saffron, teal, or unrelated accent colors unless the user asks.
- Buttons must be unmistakably tappable:
  - primary action = solid emerald fill
  - brand action = solid violet fill
  - secondary action = outlined
  - never glass
  - never text-only when a primary CTA is intended
  - never put descriptive/helper copy inside the button label
- Inputs, cards, pills, and buttons must remain visually distinct from one another. A CTA must not share the same treatment as an input field.
- When the user reacts to a visual issue, fix the exact issue first. Do not expand the design concept or add extra flourish unless requested.
- Prefer preserving the user's existing approach over "improving" it with new patterns.

## State and living docs

Maintain when relevant:

- `README.md` for a stable overview.
- `HANDOFF.md` for current status and continuity.

Refresh when contradictions, omissions, flaky tests, or version uncertainty appear.

## Commands and checks

- Show a plan before large edits.
- Capture exit codes and logs.
- When installing packages, libraries, CLIs, or skills, prefer the latest stable version by default. Do not pin versions like `@2.1` unless the user explicitly requests it or the project already requires a specific version.
- Run impacted checks only:
  - `lint` on changed files
  - `typecheck` on touched modules
  - `test` on the nearest tests, then expand only if an upstream failure appears
- Stop on failure, summarize the root cause, and propose the smallest fix.
- If no automated checks apply, make that explicit and describe the manual validation performed.
- After each incremental change, execute the quickest verifying command from the applicable `AGENTS.md` before moving on.

## Skills

A skill is a set of local instructions stored in a `SKILL.md` file.

### Available skills

- `figma-implement-design`: Translate Figma nodes into production-ready code with 1:1 visual fidelity using the Figma MCP workflow. File: `/Users/ChandraShekar.Nallamilli/.codex/skills/figma-implement-design/SKILL.md`
- `gh-address-comments`: Address review or issue comments on the open GitHub PR for the current branch using `gh`. File: `/Users/ChandraShekar.Nallamilli/.codex/skills/gh-address-comments/SKILL.md`
- `gh-fix-ci`: Debug or fix failing GitHub PR checks that run in GitHub Actions using `gh`. File: `/Users/ChandraShekar.Nallamilli/.codex/skills/gh-fix-ci/SKILL.md`
- `interface-design`: Use for interface design work on dashboards, admin panels, apps, tools, settings pages, and data-heavy products. File: `/Users/ChandraShekar.Nallamilli/.codex/skills/interface-design/SKILL.md`
- `pdf`: Use when tasks involve reading, creating, or reviewing PDF files where rendering and layout matter. File: `/Users/ChandraShekar.Nallamilli/.codex/skills/pdf/SKILL.md`
- `skill-creator`: Guide for creating effective skills. File: `/Users/ChandraShekar.Nallamilli/.codex/skills/.system/skill-creator/SKILL.md`
- `skill-installer`: Install Codex skills into `$CODEX_HOME/skills` from a curated list or a GitHub repo path. File: `/Users/ChandraShekar.Nallamilli/.codex/skills/.system/skill-installer/SKILL.md`
- `ui-ux-pro-max`: Use for senior-level UI and UX direction in this workspace, including audits, redesigns, prototypes, interaction flows, and interface systems. File: `/Users/ChandraShekar.Nallamilli/tokens/.codex/skills/ui-ux-pro-max/SKILL.md`

### How to use skills

- Discovery: The list above includes both default skills and repo-local skills available in this workspace.
- Trigger rules: If the user names a skill, use that skill for the turn.
- For this repo, do not auto-apply UI/design skills for implementation work. Use the repo HLD, current code, and direct user feedback first. Only use a design skill if the user explicitly asks for it.
- Missing or blocked: If a named skill is not available or the path cannot be read, say so briefly and continue with the best fallback.
- Use skills with progressive disclosure:
  - Open the `SKILL.md`.
  - Read only enough to follow the workflow.
  - Resolve relative paths from the skill directory first.
  - Reuse referenced scripts, assets, and templates when they exist.
- Keep context small: summarize long sections instead of pasting them; only load extra files when needed.
- If a skill cannot be applied cleanly, state the issue, pick the next-best approach, and continue.
