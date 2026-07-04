# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:7510c1e2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->


## Build & Test

```bash
npm install && npm run dev        # dashboard at http://localhost:5173
npm run build                     # production build to dist/
python -m pytest tests/ -q        # scoring-engine tests
python scripts/scrape_letour.py --stage N   # scrape one stage
python scripts/compute_points.py && python scripts/build_data.py
```

## Architecture Overview

Static React dashboard (Vite + Tailwind + Recharts) on GitHub Pages, fed by a
Python scrape → compute → build pipeline committed to the repo. See README.md
for the full data-flow diagram, letour.fr classification codes, and the Tissot
scoring model. The dashboard reads exactly one file: `public/data/tdf.json`.

## Conventions & Patterns

- Design system is ported from the CarsAndBidsData project (CSS-variable
  theme tokens in `src/index.css`, exported via `src/tokens.js`).
- Rider join keys are `INITIAL|SURNAME` (see `compute_points.name_key`);
  unmatched scraped names surface as build_data warnings and are fixed via
  its `ALIASES` map.
- `data/raw/` holds real 2026 race data only; the 2025 placeholder scrape
  lives in `tests/fixtures/` for parser/scoring tests.
