# AGENTS.md

Gerard's weekly workout plan (Hugo static site + Tailwind CSS + vanilla JS), deployed to GitHub Pages.
Set checkoff on the today page is client-only localStorage, not synced anywhere.

## Commands

```bash
source bin/activate-hermit     # provides hugo, tailwindcss
uv run scripts/validate.py     # validate data files (also runs in CI before deploy)
uv run scripts/sync_exercises.py  # sync exercise GIFs from dataset (run after adding exercises)
hugo --minify                  # build to /public
hugo server                    # local preview
```

Deploy is automatic on push to `main`. CI fails if validation fails.

## Structure

- `data/schedule.yaml` — the weekly plan (source of truth for what happens each day).
- `data/exercises/{push,pull,legs,abs,functional}.yaml` — gym exercises; `running.yaml` — run workouts.
- `layouts/` — `index.html` (today: all 7 days rendered, JS picks one), `week.html` (next 7 days), `exercises.html` (catalog). Partials: `day-block`, `exercise-item`, `run-info`.
- `assets/js/main.js` — day selection, Friday push/legs alternation (anchor 2026-08-21 = week A = push), week reorder, set checkoff, focus mode (one exercise at a time). `static/sw.js` + `static/manifest.webmanifest` — PWA.
- `assets/css/main.css` — Tailwind v4 with CSS variable theme (dark-first, light via prefers-color-scheme).
- `scripts/sync_exercises.py` — syncs exercise demo GIFs from `hasaneyldrm/exercises-dataset` into `static/exercises/`. Sets `demo:` field on matched exercises. Uses curated name→dataset-name map (no fuzzy matching).
- `static/exercises/` — vendored 180×180 GIF demos. Media © GymVisual.

## Schema: data/schedule.yaml

`week:` must have all 7 keys `monday`–`sunday`. Each day:

| field | notes |
|---|---|
| `type` | `gym` \| `run` \| `rest` \| `flexible` (required) |
| `workout` | gym: exercise category (`push`/`pull`/`legs`/`abs`/`functional`); run: running workout `id` |
| `alternateWeekly` | gym only: second category; alternates with `workout` by week |
| `duration` | minutes (0 for rest) |
| `description`, `icon` | shown on cards |
| `includeAbs` | gym only: append first 3 abs exercises |
| `extra` | optional secondary block: `{type, workout, duration, description, icon}` |
| `options` | flexible/choice days: list of blocks like `extra` |

## Schema: data/exercises/*.yaml

Top level: `category`, `description`, `icon`, `exercises:` (or `workouts:` in running.yaml).

Exercise: `id`, `name`, `sets`, `reps` (int or string like `"45s"` or `"21-15-9"`) required; plus `muscle`,
`equipment`, `startingWeight` (kg), `notes`, `description` (multiline how-to), `demo`
(path under `static/`, e.g. `exercises/0025-EIeI8Vf.gif` — set by sync script),
`alternatives:` (list of `{id, name, equipment, description, demo?}`).

**Alternatives contract:** `alternatives:` stays in YAML as machine-readable data for agents
(hermes). The site renders exactly one exercise per slot. To change what's shown, promote the
alternative to the main entry and demote the current one to alternatives. Never add UI rendering
of alternatives.

Running workout: `id`, `name`, `type`, `duration` (string), `intensity` required; plus
`description`, `frequency`, `structure`, `tips` (list).

## Common workflows

- **Update a weight after a session**: edit `startingWeight` in the exercise's yaml, validate, commit.
- **Add/swap an exercise**: add to the category's `exercises:` list (or as an `alternative`), run `sync_exercises.py` to get GIF, run validate.
- **Change the schedule**: edit `data/schedule.yaml`; `workout` refs must resolve (validator checks).
- **Swap an alternative in**: move the alternative to the main exercise position in the YAML, demote the old main to alternatives. Run `sync_exercises.py` to update GIFs.

Always run `uv run scripts/validate.py && hugo --minify` before committing data edits.
Keep the site in English. Keep private data (logged weights, metrics, diet) out of this repo.

## Gotchas

- `now`/`Date` in templates is evaluated at BUILD time. Never render the weekday server-side;
  `index.html` renders all 7 `data-day` sections hidden and `assets/js/main.js` unhides today's
  (with a Friday A/B alternation computed from the `data-alt-anchor` date). The `#today-date`
  string is a server fallback that main.js overwrites; `<noscript>` unhides everything.
- If the Today page looks frozen or wrong: check that all 7 `data-day` sections are present and
  main.js loads (fingerprinted as `js/main.min.*.js`). Don't bake `now` into visible content.
- The favicon is an inline percent-encoded SVG data URI in `layouts/_default/baseof.html`;
  keep the encoding when editing it.
- `config.toml` disables taxonomies (`disableKinds = ["taxonomy", "term"]`) so /tags/ and
  /categories/ are not generated.
- For build checks use a fresh output dir (e.g. `/tmp/wb-check-NN`); never `rm -rf` in /tmp
  without explicit approval.
- Tailwind v4 via Hugo's `css.TailwindCSS` pipeline, no external CDNs or JS frameworks. JS stays vanilla.
- Focus mode stores `_pos` and `_focus` in the same per-day localStorage object as set checkoffs.
  Old entries without these keys just start at exercise 0, no migration needed. 14-day pruning covers cleanup.
