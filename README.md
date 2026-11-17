# html2figma

**English** | [简体中文](README.zh-CN.md)

**Turn an HTML phone prototype into an editable, clickable, scrollable Figma prototype — or build the HTML prototype first, guided by a spec.**

[Agent Skills spec](https://agentskills.io/specification) · Figma desktop · MIT

---

## Why this exists

Importing HTML into Figma is a solved problem; **making the result behave like the prototype is not**.

A typical import ends up as one long flattened strip per screen: text is clipped by `-webkit-line-clamp` but still drawn past its box, bottom navigation ends up at the end of a 1800px-long board, nothing scrolls, and every prototype link is gone. The file looks right in a screenshot and feels wrong the moment you press Present.

This skill captures the entire path we had to rediscover — import pipeline, font matching, reaction writing, viewport reshaping, Figma's plugin-API limits, and the verification loops that prove the result is actually correct.

## What you get

- **Editable layers** — every element is a Frame / Text / Vector / image fill, not a screenshot.
- **Real navigation** — every hotspot becomes an `ON_CLICK → NAVIGATE` reaction, verified by count *and* by replay.
- **Real scrolling** — 393×852 viewport frames with vertical overflow, matching how the phone actually behaves.
- **Persistent layers that persist** — bottom bars, top bars, FABs stay where they belong. Not hardcoded to docks: the skill tells the agent how to decide what should be fixed.
- **Pixel parity** — export-vs-reference MAE comparison with shadow-bleed cropping and shift search.
- **A pre-Figma checkpoint** — when no HTML prototype exists, the agent authors one to spec, renders every screen, and waits for your sign-off before touching Figma.

## How it works

```text
        ┌─────────────── no HTML yet ───────────────┐
        │ Phase 0  author HTML to spec               │
        │          → screenshots → user sign-off     │
        └──────────────────┬─────────────────────────┘
                           ▼
HTML prototype ──► Feed build ──► Font matching ──► Figma import ──► Split boards
                    (unclip,       (subset,          (open-htmltofigma)   (NN id · title)
                     bake clamp,    rename, install)
                     name layers)
                           │
                           ▼
                    Reactions ──► Viewport reshape ──► Scroll/fixed (API) ──► Verification
                    (bbox match,   (393×852, clip,     (Overflow,      (MAE, audit,
                     climb,         persistent layers   Fixed)          Present)
                     replay)        to viewport edge)
```

Every phase has its own acceptance check; you can stop and inspect at any boundary.

## Install

This repository is an [Agent Skills](https://agentskills.io/specification) package: a folder with `SKILL.md`, `references/`, and `scripts/`.

```bash
git clone https://github.com/ilovemajiaqi/html2figma.git html2figma   # or download and copy this folder
# pick the skills directory of your agent, e.g.:
#   Claude Code:        ~/.claude/skills/html2figma
#   ZCode / generic:    ~/.agents/skills/html2figma
#   project-scoped:     <project>/.agents/skills/html2figma
```

Any client that implements the Agent Skills spec can load it. The skill body is written in Chinese; the description includes English trigger keywords.

### Requirements

| Part | Needed for | Notes |
|------|-----------|-------|
| Figma **desktop** | import plugins, Prototype panel, Present | The web app cannot import local development plugins; published plugins work |
| [open-htmltofigma](https://github.com/kevicebryan/open-htmltofigma) (MIT) | HTML → Figma layers | **install separately** and pin a commit/tag; not bundled here |
| Node.js + Chrome/CDP | feed build & screenshots | any recent versions |
| Python `fontTools` | font subsetting/renaming | needed for exact font matching (Phase 3) |
| PowerShell (Windows) | bundled automation scripts | optional; macOS/Linux equivalents are not bundled |

## Usage

Just describe the task; the description is written to trigger on it:

- “把这个 HTML 原型转成 Figma 可编辑原型，dock 要固定在底部，能点击跳屏。”
- “Figma 里底部栏跑到长图最下面了，而且页面不能滚动，修一下。”
- “没有现成原型，先帮我做一版 HTML 手机原型，确认后再进 Figma。”

The agent follows `SKILL.md` and loads only the references it needs.

## Persistent layers, not just docks

The thing that stays on screen may be a bottom tab bar, a top navigation bar, a floating action button, a toast, or nothing at all. The skill includes a detection procedure (CSS positioning, z-index, cross-screen repetition, behavior) and a decision table:

| Layer semantics | Figma treatment |
|-----------------|-----------------|
| Always-on bottom/top bar, FAB | lift to viewport layer, `Position = Fixed` |
| Scrolls away with content | leave in content flow |
| Auto-hides on scroll | keep follow/hidden semantics or split into state screens — ask if unclear |
| Modal/sheet handle | belongs to that screen, not fixed |

When the HTML doesn't make the intent obvious, the skill instructs the agent to inspect behavior or ask, rather than guess.

## Repository layout

```text
html2figma/
├── SKILL.md                        # entry point: phases, decision tables, pitfalls
├── README.md                       # English (this file)
├── README.zh-CN.md                 # 简体中文
├── references/
│   ├── html-prototype-spec.md      # Phase 0 authoring standard + review gate
│   ├── pipeline.md                 # feed, truncation, fonts, import, reactions, reshape
│   ├── figma-ui-and-automation.md  # API vs UI limits, batch settings, device model, automation
│   └── verification.md             # MAE, reaction audit/replay, Present checks
├── scripts/
│   ├── rename_font.py              # subset + prefix font families (fontTools)
│   ├── install_font.ps1            # per-user install/uninstall + WM_FONTCHANGE (Windows)
│   ├── figma_win.ps1               # click/hover/keys/wheel/screenshot (Windows)
│   ├── uia.ps1                     # UIA enumerate/click/focus+keys (Windows)
│   └── crop.mjs                    # integer-safe PNG crop/zoom (cross-platform)
├── evals/evals.json                # representative trigger/workflow cases
├── CONTRIBUTING.md
├── CHANGELOG.md
└── LICENSE
```

## Quality gates

A run is only “done” when all three pass:

1. **Pixel** — 2× export vs reference, shadow-bleed cropped via `@dx,dy`, ±2px shift search. MAE here means the mean absolute RGB difference (0–255) over the overlapping viewport region, sampled every 2–3 px; 3–10 is normal for font antialiasing, >15 needs investigation. Thresholds are starting points from one project, not a standard.
2. **Interaction** — reaction count audit (`dangling == 0`) plus a replay using the same hit-and-climb logic (`ok == exp`, `wrong == 0`).
3. **Present** — three screenshots: initial (persistent layer anchored), after scrolling (content moved, layer didn't), after navigation (destination screen with correct active state).

Real-world baseline from the project this skill was extracted from: 51 screens, 438 hotspot definitions → 435 navigation actions after self-target filtering, MAE 4.05–10.51 per screen, scroll + fixed bottom bar verified in Present.

## Compatibility & limitations

- The documented workflow targets **Figma desktop**. The HTML/font/import steps are OS-independent; the bundled automation helpers are Windows-only, and macOS/Linux equivalents are not included (adapt with AppleScript/`screencapture`/`xdotool`, or follow the manual steps).
- Scrolling and fixed children **are API-settable**: `overflowDirection = 'NONE' | 'VERTICAL' | 'HORIZONTAL' | 'BOTH'`, and `numberOfFixedChildren = N` with the fixed layers as the leading children. The Prototype panel works as a fallback; the skill documents both paths.
- `open-htmltofigma` imports geometry from a rendered iframe; it strips scripts, so all interactions must be rewritten (the skill covers this).
- Figma web cannot import local development plugins; use the desktop app for that step.

## FAQ

**Why not just use the `.sketch` route?** It works, but it needs a custom extractor, loses flows on every import, and produces worse text metrics than building directly from the rendered DOM. The skill documents the DOM route because it is reproducible.

**Why does my text wrap differently in Figma?** Font substitution. Subset + rename + install the exact fonts before importing; the skill walks through it.

**Why bake truncation if Figma can truncate natively?** It can (`textTruncation='ENDING'` + `maxLines`), and that is the first thing to try. Baking is only for cases where the Figma line breaks must match the browser character-for-character; the skill documents both and tells the agent to compare before choosing.

**Why can't I scroll in Present?** Overflow wasn't set on the viewport frame, or the scrollable content is nested under a fixed layer. See the verification playbook.

**Why do my reactions disappear?** Cloning frames across pages and then writing reactions fails silently in bulk. Restructure in place; keep an archive page instead.

## Contributing

Issues and PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). If you have a project that exposed a new failure mode, a minimal reproduction (HTML snippet + expected vs actual Figma behavior) is worth more than a description. Please keep the skill body under ~500 lines and put detail into `references/`.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgements

- [open-htmltofigma](https://github.com/kevicebryan/open-htmltofigma) (MIT) for the HTML→Figma conversion core.
- The [Agent Skills specification](https://agentskills.io/specification) and Anthropic's skill-authoring guidance for the package format.
