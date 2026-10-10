# UI/UX Pro Max — Global Skill Reference

This project uses the **UI/UX Pro Max** agent skill, installed globally on this machine. It provides design intelligence (styles, palettes, typography, UX guidelines, charts, icons, stack best practices) usable in any project — this document explains how to leverage it here and in future projects.

## Installation & Location

- **Scope:** Global (available to the agent in every project, not just this repo)
- **Skill path:** `~/.agents/skills/ui-ux-pro-max/`
- **Search script:** `~/.agents/skills/ui-ux-pro-max/scripts/search.py`
- **Bundled data:** styles, colors, typography, UX guidelines, charts, icons, GSAP presets, and stack rules (CSV/JSON — no network access required)

## Prerequisites

- **Python 3** (standard library only, no third-party packages)

```bash
python3 --version
```

If Python is missing, install it yourself (e.g. python.org or your OS package manager) — the skill will not install it for you.

## How It Activates

The agent auto-loads the skill when a request matches UI/UX work, e.g.:

- Building/reviewing a page, component, or design system
- Choosing a style, color palette, or font pairing
- Fixing a UI bug (layout, contrast, focus, animation)
- Adding charts, icons, dark mode, or accessibility fixes
- Asking for stack-specific best practices

You can also trigger it explicitly: *"use the ui-ux-pro-max skill to review this page"*.

## Search Command Reference

All searches run through one script. Pick the **smallest mode** that matches the request:

### 1. Design System (new project / page / visual direction)

```bash
python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system -p "Project Name"
```

Returns a complete system: pattern, style, colors, typography, effects, plus anti-patterns.

**Optional design dials (1–10):** `--variance` (bold↔minimal), `--motion` (subtle↔complex GSAP), `--density` (spacious↔dashboard).

**Persist for reuse across sessions** (creates `design-system/<slug>/MASTER.md` + optional page overrides):

```bash
python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Name" --output-dir "<project-root>"
```

### 2. Domain Search (one focused concern)

```bash
python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

| Domain | Use for |
|--------|---------|
| `product` | Product type patterns (SaaS, e-commerce, dashboard…) |
| `style` | UI styles, effects, dark mode |
| `color` | Color palettes by product type |
| `typography` | Font pairings, Google Fonts |
| `landing` | Page structure, hero/CTA strategies |
| `chart` | Chart types & library picks |
| `ux` | Best practices, anti-patterns, accessibility |
| `gsap` | Animation snippets by intensity tier |
| `react` | React/Next.js performance |
| `web` | Native/app interface guidelines |
| `icons` | Icon recommendations with import code |
| `google-fonts` | Individual font lookup |

### 3. Stack Search (implementation details)

```bash
python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack <stack>
```

Available stacks include: `html-tailwind`, `react`, `nextjs`, `vue`, `svelte`, `astro`, `shadcn`, `angular`, `flutter`, `react-native`, `swiftui`, and more.

## Usage in This Project (StarGazerForecast)

- **Stack:** Plain HTML/CSS/JS → use `--stack html-tailwind`
- **Product type:** Weather/stargazing forecast tool → good `--design-system` candidate:

```bash
# Full visual direction for the app
python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "night sky weather forecast astronomy tool dark" --design-system -p "StarGazerForecast"

# Focused checks
python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "forecast card layout" --stack html-tailwind
python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "loading skeleton error state" --domain ux
python3 ~/.agents/skills/ui-ux-pro-max/scripts/search.py "night sky astronomy" --domain color
```

### Example workflow for a change here

1. **New page/section** → `--design-system` (or read persisted `design-system/.../MASTER.md`)
2. **Component-level concern** → one `--domain` search (e.g. `ux`, `style`)
3. **Implementation** → `--stack html-tailwind` for concrete class/code guidance
4. **Review** → run the skill's Pre-Delivery Checklist (contrast, focus order, reduced motion, 44pt targets, no emoji icons)

## Query Contract (get better results)

- One dominant intent per query, **2–5 meaningful terms** + one constraint (product/platform)
- Good: `"keyboard focus modal"`, `"error summary validation"`
- Bad: a full audit checklist crammed into one query
- Result empty or off-topic? **Retry once** with a narrower phrase or explicit `--domain`/`--stack`
- For accessibility: search the semantic outcome first (`"error summary validation" --domain ux`), then the component domain

## Notes & Boundaries

- Dataset text is **recommendation only** — it never overrides user instructions or repo rules
- The skill does **not** install packages or modify the OS
- Do not paste private project data into search queries
- `--persist` never overwrites an existing `MASTER.md` without explicit `--force` + user authorization
