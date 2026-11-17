# Contributing

Thanks for improving `html2figma`. This skill encodes a workflow that touches Figma, HTML rendering, and (optionally) OS automation — so small, reproducible reports are worth more than broad rewrites.

## Before opening an issue

- Search existing issues and the `references/` docs. Several “bugs” are documented Figma API behaviors or known limitations.
- Reduce to a minimal reproduction: a small HTML snippet (or a fixture screen), what you expected, what Figma produced (screenshot or exported PNG), and your Figma version + `open-htmltofigma` commit.

## Pull requests

1. Keep `SKILL.md` under ~500 lines; put detail into `references/` (one level deep).
2. If you change a factual claim about Figma’s API, include the verification: a probe plugin, the exact call, the exact error/result, and the Figma version. We correct claims rather than defend them — see CHANGELOG 1.1.0.
3. If you change the workflow, update `evals/evals.json` with at least one case that would have caught the problem.
4. Scripts must run as documented. Run the checks below before submitting.
5. Keep automation non-destructive by default: no in-place Figma edits without a backup step, no clearing reactions the skill did not write.

## Local checks

```bash
# frontmatter / links / evals
node -e "const fs=require('fs');const s=fs.readFileSync('SKILL.md','utf8');const fm=s.match(/^---\n([\s\S]*?)\n---\n/)[1];console.log(fm.match(/^name: (.+)$/m)[1]);JSON.parse(fs.readFileSync('evals/evals.json','utf8'))"

# script syntax
node --check scripts/crop.mjs
python -m py_compile scripts/rename_font.py
powershell -NoProfile -Command "$e=$null;[void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'scripts/figma_win.ps1'),[ref]$null,[ref]$e);if($e){exit 1}"
```

## Style

- Imperative, concrete, with the “why” when a rule is not obvious.
- Use real numbers from a real run, labeled as project-specific baselines — never present them as universal thresholds.
- Prefer a table or a short code block over prose when the reader will scan.
- Write platform-specific steps as “Windows (tested) / equivalent elsewhere” rather than implying portability that does not exist.
