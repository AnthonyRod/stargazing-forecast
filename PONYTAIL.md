# Ponytail — Global Plugin Reference

This project uses the **Ponytail** opencode plugin, installed globally on this machine. It installs the "lazy senior dev" persona into the agent: before writing code it climbs a ladder (does this need to exist → is it already here → standard library → native platform feature → installed dependency → one line → the minimum that works). It aims to cut ~50% of code, tokens, cost, and time while keeping validation, error handling, security, accessibility, and tests for risky logic. This document explains how to use it here and in future projects.

> Lazy, not negligent: trust-boundary validation, data-loss handling, security, and accessibility are never cut.

## Installation & Location

- **Scope:** Global (active in the agent in every project, not just this repo)
- **Package:** `@dietrichgebert/ponytail` (v5.1.0)
- **Config entry:** `~/.config/opencode/opencode.json` → `"plugin": ["@dietrichgebert/ponytail"]`
- **Installed code:** `~/.cache/opencode/packages/@dietrichgebert/ponytail@latest/node_modules/@dietrichgebert/ponytail/`
- **Ruleset prompt:** `skills/ponytail/SKILL.md` (same folder)
- **Install / update:** `opencode plugin @dietrichgebert/ponytail --global`

There is no separate package or OS dependency to install. The plugin injects the ruleset into every turn's system prompt and registers the commands/skills below.

## How It Activates

The plugin is always on once installed — no invocation needed. It appends the active-level ruleset to the system prompt on every turn and adds the `/ponytail*` commands. It is smart about reading first: it traces the real code flow before choosing a "lazier" solution, so it stays lazy about the *solution*, never about *reading*.

Switch levels or turn it off with `/ponytail`, or just say `stop ponytail` / `normal mode`.

## Modes (levels)

| Mode | Behavior |
|------|----------|
| `/ponytail lite` | Build what's asked; name the lazier alternative in one line |
| `/ponytail` (full, default) | The full ladder: YAGNI → stdlib → native → one line → minimum |
| `/ponytail ultra` | Deletion before addition; challenges the requirement before building |
| `/ponytail off` | Suppress the ruleset ("stop ponytail" / "normal mode" also work) |

No argument switches it back on at the default level if it was off; otherwise it reports the current level. Default mode is `full`.

## Commands

| Command | What it does |
|---------|--------------|
| `/ponytail [lite\|full\|ultra\|off]` | Set intensity, or report/toggle |
| `/ponytail-review` | Review current changes like the senior dev who gets paged when it breaks: bugs, security, load, risky code without tests, slow paths, and what to cut |
| `/ponytail-audit` | The same check across the whole repo, ranked most-important-first |
| `/ponytail-debt` | Harvest `shortcut:` comments into a tracked debt ledger so "later" doesn't become "never" |
| `/ponytail-gain` | Show the measured impact scoreboard from the benchmark |
| `/ponytail-help` | Quick reference card |

`/ponytail-review` accepts a target in plain words to narrow or widen it: `uncommitted`, `staged`, `branch`, or a PR link. Each review finding reports: **What this is**, **Problem**, **Fix**, **If we skip it**.

## Configuration

Default mode resolves in this order:

1. `PONYTAIL_DEFAULT_MODE` environment variable (`off` | `lite` | `full` | `ultra`)
2. Config file `~/.config/ponytail/config.json` (Windows: `%APPDATA%\ponytail\config.json`):
   ```json
   { "defaultMode": "lite" }
   ```
3. Fallback: `full`

Nothing is required. Config is global, so a level switch carries across projects.

## Quick Decision Guide

- **New feature / bug fix** → just work; ponytail is active. Reach for `/ponytail ultra` when the codebase has wronged you personally.
- **Before a PR** → `/ponytail-review` on uncommitted/staged/branch changes.
- **Inherited or unfamiliar repo** → `/ponytail-audit` (whole-repo, ranked).
- **Tracking deferred simplifications** → mark them with a `shortcut:` comment naming the ceiling + upgrade trigger, then run `/ponytail-debt`.
- **Need the 120-line class anyway?** Insist and it will build it — correctly, while looking at you.

## Usage in This Project (StarGazerForecast)

Plain HTML/CSS/JS weather/astronomy tool. Nothing special is needed — the ruleset is active every session. Useful habits here:

```bash
# Review the current change before committing
/ponytail-review uncommitted

# Periodically check the whole repo for bloat/bugs
/ponytail-audit

# If you defer a simplification, mark it and harvest later
#   // shortcut: linear scan is fine under ~100 stations; index if the list grows
/ponytail-debt
```

Because the stack has no framework, the ladder favors native browser features (`<input type="date">`, `Intl`, `fetch`, `AbortController`, CSS) over new dependencies.

## Notes & Boundaries

- Applies to the **agent's behavior**, not the OS: it never installs packages or modifies your system.
- Benchmark figures are **global averages**, not per-repo savings — the plugin will not print a per-repo number.
- `shortcut:` comments are deliberate decisions, not audit findings; `/ponytail-review` treats them as such.
- Source of truth: [github.com/DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail). Only install from that repo or the `@dietrichgebert/ponytail` npm scope.
- After changing the `plugin` entry in `opencode.json`, restart opencode for it to take effect.
