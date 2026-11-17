# Changelog

All notable changes to this skill. Dates use ISO 8601.

## 1.1.0 — 2026-11-17

### Corrected (verified against Figma desktop with a scratch-frame probe)
- `overflowDirection` **is writable on plain frames**; valid values are `NONE | VERTICAL | HORIZONTAL | BOTH`. The earlier "auto-layout only" claim came from misreading an `Invalid option` validation error. API is now the primary path for scrolling.
- Fixed-position children **are API-settable** via `numberOfFixedChildren = N` (fixed layers must be the leading N children; `insertChild(0, layer)`).
- Native text truncation exists: `textTruncation = 'ENDING'` + `maxLines = N` after `loadFontAsync`; feed-side clamp baking is now the fallback for browser-exact line breaks.

### Added
- Phase 0: HTML prototype authoring standard (`references/html-prototype-spec.md`) with a mandatory user sign-off gate before importing into Figma.
- Persistent-layer detection signals and decision table (bottom bar / top bar / FAB / toast / auto-hide header), replacing the dock-only assumption.
- `scripts/rename_font.py` and `scripts/install_font.ps1` (complete, runnable; includes uninstall).
- Safety guidance: duplicate the Figma file, snapshot reactions, and only clear plugin-owned reactions.
- `evals/evals.json` with trigger and workflow cases.
- English trigger phrases and explicit negative boundaries in the description.

### Changed
- Skill renamed `html-to-figma-prototype` → `html2figma` (shorter, spec-compliant).
- Viewport and FAB offsets are config-driven (defaults 393×852 / 104); preflight measures `.phone`, and other device sizes plug into the same config.
- Import contract documented: pin the `open-htmltofigma` commit, set the plugin viewport before Convert, poll for readiness.
- README restructured for open-source release (pipeline diagram, requirements, quality gates, FAQ, contributing) and MIT license added; bilingual docs with a full Simplified Chinese edition (README.zh-CN.md) and a language switcher.

## 1.0.0 — 2026-11-17

Initial extraction from a 51-screen HTML→Figma migration: feed build, font matching, import/split, reaction writer + replay verification, viewport reshape, Windows automation helpers.
